import { desc } from "drizzle-orm";
import { router, socioProcedure } from "../trpc";
import { auditoria } from "../db/schema";

/* Quem alterou o quê — leitura de sócio, os últimos 200 registros. */
export const auditoriaRouter = router({
  listar: socioProcedure.query(({ ctx }) =>
    ctx.db
      .select()
      .from(auditoria)
      .orderBy(desc(auditoria.id))
      .limit(200)
  ),
});
