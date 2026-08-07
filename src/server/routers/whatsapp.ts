import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { router, socioProcedure } from "../trpc";
import {
  whatsappConfig,
  whatsappContatos,
  whatsappHandoffs,
  whatsappMensagens,
} from "../db/schema";
import { auditar } from "../auditoria";
import { garantirConfig } from "../whatsapp/atendimento";
import { estadoCredenciais, enviarTexto, verificarStatus } from "../whatsapp/cliente";
import { montarConhecimento } from "../whatsapp/conhecimento";

/*
 * A URL do webhook sai do host que está servindo ESTA página, nunca de
 * variável de ambiente. O campo existe para ser colado no App Dashboard
 * da Meta: uma URL derivada de `NEXT_PUBLIC_SITE_URL` aponta para o
 * domínio público — que pode não ser o deploy que está rodando — e o
 * erro é silencioso, porque a tela mostra um endereço plausível que
 * simplesmente não recebe nada.
 */
function urlDoWebhook(req: Request): string {
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    new URL(req.url).host;
  const protocolo =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}/api/whatsapp/webhook`;
}

/*
 * Domínio 5 no admin. Tudo aqui é `socioProcedure`: configuração de
 * atendimento, histórico de conversa e resposta ao cliente não são coisa
 * de funcionário — é a lição da v1, em que qualquer login editava tudo.
 */
export const whatsappRouter = router({
  /*
   * A aba Conexão. Credencial nunca sai do servidor: o que volta é se ela
   * chegou, não o valor. Phone Number ID e WABA ID são identificadores
   * públicos e voltam inteiros — quem precisa deles precisa conferir.
   */
  config: socioProcedure.query(async ({ ctx }) => {
    const config = await garantirConfig(ctx.db);
    return {
      config,
      credenciais: estadoCredenciais(),
      webhookUrl: urlDoWebhook(ctx.req),
    };
  }),

  verificarStatus: socioProcedure.mutation(() => verificarStatus()),

  /* o que a IA realmente lê do cadastro — sem isso é fé, não configuração */
  conhecimento: socioProcedure.query(({ ctx }) => montarConhecimento(ctx.db)),

  salvarConfig: socioProcedure
    .input(
      z.object({
        iaAtiva: z.boolean().optional(),
        saudacao: z.string().max(1000).nullish(),
        systemPrompt: z.string().max(20000).nullish(),
        politica: z.string().max(20000).nullish(),
        limitarHorario: z.boolean().optional(),
        horaInicio: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "use HH:MM")
          .nullish(),
        horaFim: z
          .string()
          .regex(/^\d{2}:\d{2}$/, "use HH:MM")
          .nullish(),
        mensagemForaHorario: z.string().max(1000).nullish(),
        telefoneAviso: z.string().max(20).nullish(),
        retomadaHoras: z.number().int().min(1).max(720).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await garantirConfig(ctx.db);
      const [config] = await ctx.db
        .update(whatsappConfig)
        .set({ ...input, atualizadoEm: new Date() })
        .where(eq(whatsappConfig.id, 1))
        .returning();
      await auditar(ctx.db, ctx.session, "atualizar", "whatsapp_config", 1, {
        campos: Object.keys(input),
      });
      return config;
    }),

  /*
   * A lista de conversas: quem falou por último em cima, com o motivo do
   * handoff aberto quando existe. Handoff pendente é a informação que
   * decide o dia — não pode estar escondida dentro da conversa.
   */
  conversas: socioProcedure.query(async ({ ctx }) => {
    const contatos = await ctx.db
      .select()
      .from(whatsappContatos)
      .orderBy(desc(whatsappContatos.ultimaMensagemEm))
      .limit(100);
    if (contatos.length === 0) return [];

    const ids = contatos.map((c) => c.id);

    /* última mensagem de cada contato, numa consulta só */
    const ultimas = await ctx.db
      .selectDistinctOn([whatsappMensagens.contatoId], {
        contatoId: whatsappMensagens.contatoId,
        texto: whatsappMensagens.texto,
        autor: whatsappMensagens.autor,
        criadaEm: whatsappMensagens.criadaEm,
      })
      .from(whatsappMensagens)
      .where(inArray(whatsappMensagens.contatoId, ids))
      .orderBy(whatsappMensagens.contatoId, desc(whatsappMensagens.criadaEm));

    const pendentes = await ctx.db
      .select({
        contatoId: whatsappHandoffs.contatoId,
        motivo: whatsappHandoffs.motivo,
        resumo: whatsappHandoffs.resumo,
        criadoEm: whatsappHandoffs.criadoEm,
      })
      .from(whatsappHandoffs)
      .where(isNull(whatsappHandoffs.resolvidoEm));

    const agora = new Date();
    return contatos.map((c) => ({
      ...c,
      iaPausada: Boolean(c.iaPausadaAte && c.iaPausadaAte > agora),
      ultima: ultimas.find((u) => u.contatoId === c.id) ?? null,
      handoff: pendentes.find((h) => h.contatoId === c.id) ?? null,
    }));
  }),

  mensagens: socioProcedure
    .input(z.object({ contatoId: z.number().int() }))
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(whatsappMensagens)
        .where(eq(whatsappMensagens.contatoId, input.contatoId))
        .orderBy(asc(whatsappMensagens.criadaEm))
        .limit(200)
    ),

  /*
   * Responder pelo admin assume a conversa: a IA para naquele contato pelo
   * prazo configurado. Dois atendentes na mesma conversa é pior do que
   * nenhum, e o prazo garante que a IA volte sem ninguém lembrar dela.
   */
  responder: socioProcedure
    .input(
      z.object({
        contatoId: z.number().int(),
        texto: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [contato] = await ctx.db
        .select()
        .from(whatsappContatos)
        .where(eq(whatsappContatos.id, input.contatoId))
        .limit(1);
      if (!contato) throw new TRPCError({ code: "NOT_FOUND" });

      const config = await garantirConfig(ctx.db);
      const { wamid, erro } = await enviarTexto(contato.telefone, input.texto);

      await ctx.db.insert(whatsappMensagens).values({
        contatoId: contato.id,
        autor: "humano",
        texto: input.texto,
        wamid,
        erro,
      });

      const ate = new Date();
      ate.setHours(ate.getHours() + config.retomadaHoras);
      await ctx.db
        .update(whatsappContatos)
        .set({ iaPausadaAte: ate })
        .where(eq(whatsappContatos.id, contato.id));

      await auditar(
        ctx.db,
        ctx.session,
        "responder",
        "whatsapp_contato",
        contato.id,
        { erro }
      );

      /*
       * O envio pode falhar (janela de 24h vencida, template exigido). O
       * erro volta como resultado, não como exceção: a mensagem já está
       * gravada e a tela precisa dizer o que houve.
       */
      return { erro };
    }),

  /** Devolve a conversa à IA e fecha o handoff pendente. */
  retomarIa: socioProcedure
    .input(z.object({ contatoId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(whatsappContatos)
        .set({ iaPausadaAte: null })
        .where(eq(whatsappContatos.id, input.contatoId));

      await ctx.db
        .update(whatsappHandoffs)
        .set({ resolvidoEm: new Date(), resolvidoPor: ctx.session.nome })
        .where(
          and(
            eq(whatsappHandoffs.contatoId, input.contatoId),
            isNull(whatsappHandoffs.resolvidoEm)
          )
        );

      await auditar(
        ctx.db,
        ctx.session,
        "retomar_ia",
        "whatsapp_contato",
        input.contatoId
      );
      return { ok: true };
    }),
});
