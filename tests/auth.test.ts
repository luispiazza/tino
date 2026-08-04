import { beforeEach, describe, expect, it } from "vitest";
import { usuarios, sessoes } from "@/server/db/schema";
import type { DB } from "@/server/db";
import { appRouter } from "@/server/routers/_app";
import { hashSenha, resolverSessao, COOKIE_SESSAO } from "@/server/auth";
import { criarBancoDeTeste, criarCtx } from "./helpers";

let db: DB;

beforeEach(async () => {
  db = await criarBancoDeTeste();
  await db.insert(usuarios).values({
    nome: "Luis",
    email: "luis@tino.com",
    senhaHash: await hashSenha("segredo123"),
    papel: "socio",
  });
});

describe("auth.login", () => {
  it("cria sessão e grava o cookie na resposta", async () => {
    const ctx = criarCtx(db);
    const caller = appRouter.createCaller(ctx);
    const r = await caller.auth.login({
      email: "luis@tino.com",
      senha: "segredo123",
    });
    expect(r).toEqual({ nome: "Luis", papel: "socio" });

    const cookie = ctx.resHeaders.get("set-cookie");
    expect(cookie).toContain(`${COOKIE_SESSAO}=`);
    expect(cookie).toContain("HttpOnly");

    const token = cookie!.split(";")[0].split("=")[1];
    const session = await resolverSessao(db, token);
    expect(session?.papel).toBe("socio");
    expect(session?.nome).toBe("Luis");
  });

  it("senha errada e e-mail inexistente dão a mesma resposta", async () => {
    const caller = appRouter.createCaller(criarCtx(db));
    const erros: string[] = [];
    for (const tentativa of [
      { email: "luis@tino.com", senha: "errada" },
      { email: "naoexiste@tino.com", senha: "segredo123" },
    ]) {
      await caller.auth.login(tentativa).catch((e) => erros.push(e.message));
    }
    expect(erros).toHaveLength(2);
    expect(erros[0]).toBe(erros[1]);
  });

  it("usuário desativado não entra", async () => {
    const { eq } = await import("drizzle-orm");
    await db
      .update(usuarios)
      .set({ ativo: false })
      .where(eq(usuarios.email, "luis@tino.com"));
    await expect(
      appRouter
        .createCaller(criarCtx(db))
        .auth.login({ email: "luis@tino.com", senha: "segredo123" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("sessão", () => {
  it("sessão expirada não resolve", async () => {
    await db.insert(sessoes).values({
      token: "a".repeat(64),
      usuarioId: 1,
      expiraEm: new Date(Date.now() - 1000),
    });
    expect(await resolverSessao(db, "a".repeat(64))).toBeNull();
  });

  it("logout encerra a sessão", async () => {
    const ctx = criarCtx(db);
    await appRouter
      .createCaller(ctx)
      .auth.login({ email: "luis@tino.com", senha: "segredo123" });
    const token = ctx.resHeaders.get("set-cookie")!.split(";")[0].split("=")[1];

    const ctxLogado = criarCtx(db, await resolverSessao(db, token));
    await appRouter.createCaller(ctxLogado).auth.logout();
    expect(await resolverSessao(db, token)).toBeNull();
  });
});
