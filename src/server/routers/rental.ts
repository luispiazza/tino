import { router, protectedProcedure, socioProcedure } from "../trpc";

/*
 * Domínio 3. Preço, nome e unidade sempre resolvidos pelo servidor.
 * Editar preço e apagar cadastro é socioProcedure — funcionário consulta
 * e monta pedido.
 */
export const rentalRouter = router({
  catalogo: protectedProcedure.query(async () => {
    return [];
  }),

  editarPreco: socioProcedure.mutation(async () => {
    throw new Error("não implementado");
  }),
});
