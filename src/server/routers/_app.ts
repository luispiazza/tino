import { router } from "../trpc";
import { reservasRouter } from "./reservas";
import { escalaRouter } from "./escala";
import { rentalRouter } from "./rental";
import { financeiroRouter } from "./financeiro";
import { campanhasRouter } from "./campanhas";

export const appRouter = router({
  reservas: reservasRouter,
  escala: escalaRouter,
  rental: rentalRouter,
  financeiro: financeiroRouter,
  campanhas: campanhasRouter,
});

export type AppRouter = typeof appRouter;
