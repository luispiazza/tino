import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { router, protectedProcedure, socioProcedure } from "../trpc";
import { inventarioItens, inventarios, itens } from "../db/schema";
import { catalogoComDisponibilidade } from "../rental/disponibilidade";
import { auditar } from "../auditoria";

const itemInput = z.object({
  nome: z.string().min(1).max(100),
  unidade: z.string().min(1).max(20),
  precoCents: z.number().int().nonnegative(),
  custoFornecedorCentsDia: z.number().int().nonnegative().nullish(),
  fornecedorId: z.number().int().nullish(),
  qtdTotal: z.number().int().nonnegative().nullish(),
  /* definida = entra na contagem periódica; nula = consumível, fica fora */
  qtdEsperada: z.number().int().nonnegative().nullish(),
  multaPorUnidadeCents: z.number().int().nonnegative().nullish(),
});

/*
 * Domínio 3. Preço, nome e unidade sempre resolvidos pelo servidor.
 * Editar preço e apagar cadastro é socioProcedure — funcionário consulta
 * e monta pedido (a v1 deixava qualquer logado editar preço).
 */
export const rentalRouter = router({
  catalogo: protectedProcedure
    .input(
      z
        .object({
          dataInicio: z.string().date(),
          dataFim: z.string().date(),
          ignorarReservaId: z.number().int().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!input) {
        return (await ctx.db.select().from(itens).orderBy(asc(itens.nome))).map(
          (i) => ({ ...i, disponivel: i.qtdTotal })
        );
      }
      return catalogoComDisponibilidade(ctx.db, input);
    }),

  criarItem: socioProcedure
    .input(itemInput)
    .mutation(async ({ ctx, input }) => {
      const [item] = await ctx.db.insert(itens).values(input).returning();
      await auditar(ctx.db, ctx.session, "criar", "item", item.id, {
        nome: item.nome,
        precoCents: item.precoCents,
      });
      return item;
    }),

  atualizarItem: socioProcedure
    .input(itemInput.partial().extend({ id: z.number().int(), ativo: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...dados } = input;
      const [item] = await ctx.db
        .update(itens)
        .set(dados)
        .where(eq(itens.id, id))
        .returning();
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "atualizar", "item", item.id, {
        nome: item.nome,
        campos: Object.keys(dados),
      });
      return item;
    }),

  /* ---------- Inventário periódico (contagem, sem multa) ---------- */

  /*
   * Abre a contagem do dia com o esperado copiado do cadastro. Se já
   * existe inventário aberto, devolve o mesmo — a contagem acontece em
   * pé, no meio do serviço, e reabrir por engano não pode duplicar.
   */
  abrirInventario: protectedProcedure
    .input(z.object({ data: z.string().date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [aberto] = await ctx.db
        .select()
        .from(inventarios)
        .where(isNull(inventarios.fechadoEm))
        .orderBy(desc(inventarios.data))
        .limit(1);
      if (aberto) return aberto;

      const duraveis = await ctx.db
        .select()
        .from(itens)
        .where(and(eq(itens.ativo, true), isNotNull(itens.qtdEsperada)))
        .orderBy(asc(itens.nome));
      if (duraveis.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Nenhum item entra na contagem. Defina a quantidade esperada no cadastro.",
        });
      }

      const data =
        input.data ??
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
        }).format(new Date());

      return ctx.db.transaction(async (tx) => {
        const [inventario] = await tx
          .insert(inventarios)
          .values({ data })
          .returning();
        await tx.insert(inventarioItens).values(
          duraveis.map((i) => ({
            inventarioId: inventario.id,
            itemId: i.id,
            nomeItem: i.nome,
            qtdEsperada: i.qtdEsperada!,
          }))
        );
        await auditar(tx, ctx.session, "abrir", "inventario", inventario.id, {
          data,
          itens: duraveis.length,
        });
        return inventario;
      });
    }),

  inventarioAberto: protectedProcedure.query(async ({ ctx }) => {
    const [inventario] = await ctx.db
      .select()
      .from(inventarios)
      .where(isNull(inventarios.fechadoEm))
      .orderBy(desc(inventarios.data))
      .limit(1);
    if (!inventario) return null;
    const linhas = await ctx.db
      .select()
      .from(inventarioItens)
      .where(eq(inventarioItens.inventarioId, inventario.id))
      .orderBy(asc(inventarioItens.nomeItem));
    return { ...inventario, itens: linhas };
  }),

  contar: protectedProcedure
    .input(
      z.object({
        inventarioItemId: z.number().int(),
        qtdContada: z.number().int().nonnegative(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [linha] = await ctx.db
        .update(inventarioItens)
        .set({ qtdContada: input.qtdContada })
        .where(eq(inventarioItens.id, input.inventarioItemId))
        .returning();
      if (!linha) throw new TRPCError({ code: "NOT_FOUND" });
      return linha;
    }),

  /*
   * Fechar não cobra ninguém (decisão: contagem sem multa) — registra
   * o que faltou, que é o dado que faltava para saber o que repor.
   */
  fecharInventario: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const linhas = await ctx.db
        .select()
        .from(inventarioItens)
        .where(eq(inventarioItens.inventarioId, input.id));
      const faltantes = linhas
        .filter((l) => l.qtdContada !== null && l.qtdContada < l.qtdEsperada)
        .map((l) => ({
          item: l.nomeItem,
          falta: l.qtdEsperada - (l.qtdContada ?? 0),
        }));
      const [inventario] = await ctx.db
        .update(inventarios)
        .set({ fechadoEm: new Date() })
        .where(eq(inventarios.id, input.id))
        .returning();
      if (!inventario) throw new TRPCError({ code: "NOT_FOUND" });
      await auditar(ctx.db, ctx.session, "fechar", "inventario", inventario.id, {
        data: inventario.data,
        faltantes,
      });
      return { ...inventario, faltantes };
    }),

  historicoInventarios: socioProcedure.query(async ({ ctx }) => {
    const fechados = await ctx.db
      .select()
      .from(inventarios)
      .where(isNotNull(inventarios.fechadoEm))
      .orderBy(desc(inventarios.data))
      .limit(12);
    if (fechados.length === 0) return [];
    const linhas = await ctx.db
      .select()
      .from(inventarioItens)
      .where(
        inArray(
          inventarioItens.inventarioId,
          fechados.map((f) => f.id)
        )
      );
    return fechados.map((f) => {
      const meus = linhas.filter((l) => l.inventarioId === f.id);
      return {
        ...f,
        contados: meus.filter((l) => l.qtdContada !== null).length,
        total: meus.length,
        faltando: meus.reduce(
          (s, l) =>
            s +
            (l.qtdContada !== null
              ? Math.max(0, l.qtdEsperada - l.qtdContada)
              : 0),
          0
        ),
      };
    });
  }),
});
