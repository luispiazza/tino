import { router } from "../trpc";
import { auditoriaRouter } from "./auditoria";
import { authRouter } from "./auth";
import { clientesRouter } from "./clientes";
import { estudiosRouter } from "./estudios";
import { pessoasRouter } from "./pessoas";
import { portaisRouter } from "./portais";
import { reservasRouter } from "./reservas";
import { escalaRouter } from "./escala";
import { rentalRouter } from "./rental";
import { financeiroRouter } from "./financeiro";
import { campanhasRouter } from "./campanhas";
import { whatsappRouter } from "./whatsapp";

export const appRouter = router({
  auditoria: auditoriaRouter,
  auth: authRouter,
  clientes: clientesRouter,
  estudios: estudiosRouter,
  pessoas: pessoasRouter,
  portais: portaisRouter,
  reservas: reservasRouter,
  escala: escalaRouter,
  rental: rentalRouter,
  financeiro: financeiroRouter,
  campanhas: campanhasRouter,
  whatsapp: whatsappRouter,
});

export type AppRouter = typeof appRouter;
