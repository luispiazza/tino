import { router } from "../trpc";
import { auditoriaRouter } from "./auditoria";
import { authRouter } from "./auth";
import { clientesRouter } from "./clientes";
import { estudiosRouter } from "./estudios";
import { reservasRouter } from "./reservas";
import { escalaRouter } from "./escala";
import { rentalRouter } from "./rental";
import { financeiroRouter } from "./financeiro";
import { campanhasRouter } from "./campanhas";

export const appRouter = router({
  auditoria: auditoriaRouter,
  auth: authRouter,
  clientes: clientesRouter,
  estudios: estudiosRouter,
  reservas: reservasRouter,
  escala: escalaRouter,
  rental: rentalRouter,
  financeiro: financeiroRouter,
  campanhas: campanhasRouter,
});

export type AppRouter = typeof appRouter;
