import { eq, isNotNull, and } from "drizzle-orm";
import type { DB } from "../db";
import {
  clientes,
  pessoas,
  usuarios,
  whatsappConfig,
  whatsappContatos,
} from "../db/schema";
import { chaveTelefone } from "./telefone";

export type PapelWhatsapp =
  | "cliente"
  | "fornecedor"
  | "funcionario"
  | "socio"
  | "desconhecido";

export interface Identidade {
  papel: PapelWhatsapp;
  clienteId: number | null;
  pessoaId: number | null;
  nome: string | null;
}

/*
 * §5.3.1 — a resolução de identidade é a base de tudo: o número vira papel
 * ANTES de qualquer resposta, e é o papel que decide quais ferramentas o
 * agente recebe.
 *
 * Regra de ouro: número não reconhecido nunca recebe dado privado. É o que
 * o `lookup_reservation` da v1 já fazia bem — aqui generalizado para todos
 * os públicos, em vez de viver dentro de uma ferramenta só.
 *
 * A comparação é por chave (DDD + 8 dígitos) e não por igualdade de texto:
 * o cadastro guarda o que a pessoa digitou, a Meta manda E.164.
 */
export async function resolverIdentidade(
  db: DB,
  telefone: string
): Promise<Identidade> {
  const chave = chaveTelefone(telefone);
  const nada: Identidade = {
    papel: "desconhecido",
    clienteId: null,
    pessoaId: null,
    nome: null,
  };
  if (!chave) return nada;

  /* sócio primeiro: o número do aviso responde como sócio mesmo sem cadastro */
  const [config] = await db
    .select({ telefoneAviso: whatsappConfig.telefoneAviso })
    .from(whatsappConfig)
    .limit(1);
  if (config?.telefoneAviso && chaveTelefone(config.telefoneAviso) === chave) {
    return { papel: "socio", clienteId: null, pessoaId: null, nome: null };
  }

  /*
   * Cadastro de pessoas ganha do de clientes: o sócio que também é cliente
   * de si mesmo enxerga tudo, não o subconjunto do cliente.
   */
  const equipe = await db
    .select({
      id: pessoas.id,
      nome: pessoas.nome,
      telefone: pessoas.telefone,
      natureza: pessoas.natureza,
      ativo: pessoas.ativo,
    })
    .from(pessoas)
    .where(and(isNotNull(pessoas.telefone), eq(pessoas.ativo, true)));

  const pessoa = equipe.find((p) => chaveTelefone(p.telefone) === chave);
  if (pessoa) {
    const [usuario] = await db
      .select({ papel: usuarios.papel })
      .from(usuarios)
      .where(and(eq(usuarios.pessoaId, pessoa.id), eq(usuarios.ativo, true)))
      .limit(1);

    const papel: PapelWhatsapp =
      usuario?.papel === "socio"
        ? "socio"
        : pessoa.natureza === "funcionario" || pessoa.natureza === "socio_executor"
          ? "funcionario"
          : "fornecedor";

    return { papel, clienteId: null, pessoaId: pessoa.id, nome: pessoa.nome };
  }

  const carteira = await db
    .select({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone })
    .from(clientes)
    .where(isNotNull(clientes.telefone));

  const cliente = carteira.find((c) => chaveTelefone(c.telefone) === chave);
  if (cliente) {
    return {
      papel: "cliente",
      clienteId: cliente.id,
      pessoaId: null,
      nome: cliente.nome,
    };
  }

  return nada;
}

/**
 * Acha ou cria o contato e reescreve o papel a cada mensagem — cadastro
 * muda (o desconhecido de ontem virou cliente hoje) e o papel acompanha,
 * sem ninguém precisar reprocessar nada.
 */
export async function registrarContato(
  db: DB,
  telefone: string,
  nomePerfil: string | null
) {
  const identidade = await resolverIdentidade(db, telefone);
  const agora = new Date();

  const [contato] = await db
    .insert(whatsappContatos)
    .values({
      telefone,
      nome: identidade.nome ?? nomePerfil,
      papel: identidade.papel,
      clienteId: identidade.clienteId,
      pessoaId: identidade.pessoaId,
      ultimaMensagemEm: agora,
    })
    .onConflictDoUpdate({
      target: whatsappContatos.telefone,
      set: {
        nome: identidade.nome ?? nomePerfil,
        papel: identidade.papel,
        clienteId: identidade.clienteId,
        pessoaId: identidade.pessoaId,
        ultimaMensagemEm: agora,
      },
    })
    .returning();

  return { contato, identidade };
}
