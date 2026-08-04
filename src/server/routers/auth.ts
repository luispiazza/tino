import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { publicProcedure, protectedProcedure, router } from "../trpc";
import { usuarios } from "../db/schema";
import {
  cookieDeLogout,
  cookieDeSessao,
  criarSessao,
  encerrarSessao,
  verificarSenha,
} from "../auth";

export const authRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), senha: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [usuario] = await ctx.db
        .select()
        .from(usuarios)
        .where(eq(usuarios.email, input.email.toLowerCase()))
        .limit(1);

      /* mesma mensagem para e-mail e senha errados — não vaza cadastro */
      const credencialInvalida = new TRPCError({
        code: "UNAUTHORIZED",
        message: "E-mail ou senha incorretos",
      });
      if (!usuario || !usuario.ativo) throw credencialInvalida;
      if (!(await verificarSenha(input.senha, usuario.senhaHash)))
        throw credencialInvalida;

      const { token, expiraEm } = await criarSessao(ctx.db, usuario.id);
      ctx.resHeaders.append("Set-Cookie", cookieDeSessao(token, expiraEm));
      return { nome: usuario.nome, papel: usuario.papel };
    }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await encerrarSessao(ctx.db, ctx.session.token);
    ctx.resHeaders.append("Set-Cookie", cookieDeLogout());
    return { ok: true };
  }),

  /* quem sou eu — o front decide quais áreas aparecem pelo papel */
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.session) return null;
    const { nome, papel, usuarioId } = ctx.session;
    return { usuarioId, nome, papel };
  }),
});
