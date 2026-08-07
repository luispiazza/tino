import { and, desc, eq, inArray, gte } from "drizzle-orm";
import type { DB } from "../db";
import {
  estudios,
  reservaEstudios,
  reservas,
  whatsappContatos,
  whatsappHandoffs,
} from "../db/schema";
import { buscarConflitos, complementaresSemBase } from "../reservas/disponibilidade";
import { montarComanda } from "../reservas/comanda";
import { enviarAvisoHandoff } from "./cliente";
import { formatarTelefone } from "./telefone";

/*
 * Formato de function calling da OpenAI — é o que o gateway do Forge
 * espera, e o mesmo que a v1 usava. Tipo local em vez de SDK: a única
 * coisa que este arquivo precisa saber do LLM é o formato do envelope.
 */
export interface FerramentaLLM {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ContextoFerramentas {
  db: DB;
  contatoId: number;
  telefone: string;
  nomeContato: string | null;
  clienteId: number | null;
  telefoneAviso: string | null;
  retomadaHoras: number;
  /*
   * Chega pronta de quem atendeu o pedido, nunca lida do ambiente aqui.
   * É o endereço que vai na mão do cliente dentro do link do portal, e
   * um domínio chutado como padrão dá 404 sem ninguém ficar sabendo.
   */
  baseUrl: string;
}

/*
 * Onda 1 (§5.3.4): cliente — disponibilidade, dados da própria reserva,
 * links dos portais. Todo o resto vai para humano. A recomendação da
 * própria especificação é começar com três a cinco intenções de alto
 * volume e baixo risco: agente que tenta cobrir tudo no lançamento falha
 * de forma visível e é desligado em torno de 90 dias.
 */
export const ferramentasCliente: FerramentaLLM[] = [
  {
    type: "function",
    function: {
      name: "consultar_disponibilidade",
      description:
        "Verifica se um ou mais estúdios estão livres num período. Use SEMPRE " +
        "antes de dizer qualquer coisa sobre data livre — nunca prometa " +
        "disponibilidade de cabeça. Devolve os estúdios livres e os ocupados.",
      parameters: {
        type: "object",
        properties: {
          estudios: {
            type: "array",
            items: { type: "string" },
            description: 'Códigos dos estúdios, como ["A", "B"].',
          },
          data_inicio: { type: "string", description: "AAAA-MM-DD" },
          data_fim: {
            type: "string",
            description: "AAAA-MM-DD. Igual à inicial se for um dia só.",
          },
          hora_inicio: {
            type: "string",
            description: "HH:MM. Use 08:00 se a pessoa não especificou.",
          },
          hora_fim: {
            type: "string",
            description: "HH:MM. Use 18:00 se a pessoa não especificou.",
          },
        },
        required: [
          "estudios",
          "data_inicio",
          "data_fim",
          "hora_inicio",
          "hora_fim",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_reserva",
      description:
        "Dados das reservas de quem está falando, com os links dos portais. " +
        "Só devolve reserva cujo telefone bate com o do contato — nunca a de " +
        "outra pessoa, mesmo que o código seja informado.",
      parameters: {
        type: "object",
        properties: {
          codigo: {
            type: "string",
            description:
              "Código da reserva (T_DDMMAAAAX). Omita para listar as próximas.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escalar_para_humano",
      description:
        "Passa a conversa para uma pessoa do estúdio e avisa o sócio. Use " +
        "sempre que: pedirem um humano, falarem em fechar reserva, perguntarem " +
        "valor de diária, reclamarem, você ficar em dúvida sobre a resposta, ou " +
        "o assunto sair do que você pode resolver. Depois de chamar, avise a " +
        "pessoa que alguém do estúdio assume a conversa.",
      parameters: {
        type: "object",
        properties: {
          motivo: {
            type: "string",
            enum: [
              "pedido_explicito",
              "confianca_baixa",
              "sentimento_negativo",
              "fechar_reserva",
              "valor",
              "reclamacao",
              "fora_de_escopo",
            ],
          },
          resumo: {
            type: "string",
            description:
              "O que a pessoa quer e o que você já apurou (datas, estúdios, " +
              "nome, contexto). Quem assumir lê isto para não perguntar tudo " +
              "de novo.",
          },
        },
        required: ["motivo", "resumo"],
      },
    },
  },
];

type Motivo = (typeof whatsappHandoffs.motivo.enumValues)[number];

/** Sinaliza que a conversa saiu da IA — o orquestrador para de responder. */
export interface ResultadoFerramenta {
  texto: string;
  escalou: boolean;
}

export async function executarFerramenta(
  ctx: ContextoFerramentas,
  nome: string,
  entrada: Record<string, unknown>
): Promise<ResultadoFerramenta> {
  switch (nome) {
    case "consultar_disponibilidade":
      return { texto: await disponibilidade(ctx, entrada), escalou: false };
    case "buscar_reserva":
      return { texto: await minhasReservas(ctx, entrada), escalou: false };
    case "escalar_para_humano":
      return { texto: await escalar(ctx, entrada), escalou: true };
    default:
      return { texto: `Ferramenta desconhecida: ${nome}`, escalou: false };
  }
}

/* A regra única de disponibilidade — a mesma que o admin e a vitrine usam. */
async function disponibilidade(
  ctx: ContextoFerramentas,
  entrada: Record<string, unknown>
): Promise<string> {
  const codigos = (entrada.estudios as string[] | undefined)?.map((c) =>
    String(c).trim().toUpperCase()
  );
  if (!codigos?.length) return "Informe ao menos um código de estúdio.";

  const encontrados = await ctx.db
    .select({ id: estudios.id, codigo: estudios.codigo, nome: estudios.nome })
    .from(estudios)
    .where(inArray(estudios.codigo, codigos));

  if (encontrados.length === 0) {
    return `Nenhum estúdio com os códigos ${codigos.join(", ")}. Confira o cadastro.`;
  }

  const consulta = {
    dataInicio: String(entrada.data_inicio),
    dataFim: String(entrada.data_fim),
    horaInicio: String(entrada.hora_inicio),
    horaFim: String(entrada.hora_fim),
    estudioIds: encontrados.map((e) => e.id),
  };

  const [conflitos, semBase] = await Promise.all([
    buscarConflitos(ctx.db, consulta),
    complementaresSemBase(
      ctx.db,
      encontrados.map((e) => e.id)
    ),
  ]);

  const ocupados = new Set(conflitos.map((c) => c.estudioId));
  const livres = encontrados.filter((e) => !ocupados.has(e.id));
  const tomados = encontrados.filter((e) => ocupados.has(e.id));

  const linhas = [
    `Período ${consulta.dataInicio} a ${consulta.dataFim}, das ${consulta.horaInicio} às ${consulta.horaFim}:`,
    livres.length
      ? `LIVRES: ${livres.map((e) => `${e.codigo} (${e.nome})`).join(", ")}`
      : "LIVRES: nenhum",
    tomados.length
      ? `OCUPADOS: ${tomados.map((e) => e.codigo).join(", ")}`
      : "OCUPADOS: nenhum",
  ];
  if (semBase.length) {
    linhas.push(
      `ATENÇÃO: ${semBase.join(", ")} é complementar e não é vendido sozinho — ` +
        "precisa entrar junto do estúdio base."
    );
  }
  linhas.push(
    "Não confirme reserva. Se a pessoa quiser fechar, chame um humano."
  );
  return linhas.join("\n");
}

/*
 * A melhor peça de segurança da v1, mantida: só devolve os dados se quem
 * pergunta for o dono da reserva. O portal web entrega os mesmos dados a
 * qualquer um que digite o código na URL; aqui a IA é mais rigorosa.
 */
async function minhasReservas(
  ctx: ContextoFerramentas,
  entrada: Record<string, unknown>
): Promise<string> {
  if (!ctx.clienteId) {
    return (
      "Este número não está ligado a nenhum cadastro de cliente. Não revele " +
      "dado de reserva: peça o nome e chame um humano para confirmar quem é."
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const condicoes = [eq(reservas.clienteId, ctx.clienteId)];
  const codigo = entrada.codigo ? String(entrada.codigo).trim() : null;
  if (codigo) condicoes.push(eq(reservas.codigo, codigo));
  else condicoes.push(gte(reservas.dataFim, hoje));

  const lista = await ctx.db
    .select()
    .from(reservas)
    .where(and(...condicoes))
    .orderBy(desc(reservas.dataInicio))
    .limit(5);

  if (lista.length === 0) {
    return codigo
      ? `Nenhuma reserva ${codigo} neste cadastro. Não é desta pessoa — não dê nenhum dado dela.`
      : "Nenhuma reserva futura neste cadastro.";
  }

  const vinculos = await ctx.db
    .select({
      reservaId: reservaEstudios.reservaId,
      codigo: estudios.codigo,
    })
    .from(reservaEstudios)
    .innerJoin(estudios, eq(reservaEstudios.estudioId, estudios.id))
    .where(
      inArray(
        reservaEstudios.reservaId,
        lista.map((r) => r.id)
      )
    );

  return lista
    .map((r) => {
      const salas = vinculos
        .filter((v) => v.reservaId === r.id)
        .map((v) => v.codigo)
        .join(", ");
      const linhas = [
        `Reserva ${r.codigo} — ${r.status}`,
        `Estúdios: ${salas || "—"}`,
        `De ${r.dataInicio} a ${r.dataFim}, das ${r.horaInicio} às ${r.horaFim}`,
      ];
      /* comanda dá o total já fechado; valor em negociação não é assunto da IA */
      const comanda = montarComanda(r);
      if (comanda.totalCents !== null) {
        linhas.push(
          `Total da comanda: ${(comanda.totalCents / 100).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}`
        );
      }
      if (r.tokenPortalProdutor) {
        linhas.push(
          `Portal do produtor (extras e check-in): ${ctx.baseUrl}/portal/produtor/${r.tokenPortalProdutor}`
        );
      }
      if (r.tokenPortalReserva) {
        linhas.push(
          `Portal da reserva: ${ctx.baseUrl}/portal/reserva/${r.tokenPortalReserva}`
        );
      }
      return linhas.join("\n");
    })
    .join("\n\n");
}

/*
 * §5.3.2 — o aviso carrega contexto, não só o alerta: quem assume recebe a
 * identidade resolvida, o motivo e o que a IA já coletou. Cliente que
 * precisa repetir tudo depois da transferência reporta satisfação bem menor.
 */
async function escalar(
  ctx: ContextoFerramentas,
  entrada: Record<string, unknown>
): Promise<string> {
  const motivo = String(entrada.motivo ?? "fora_de_escopo") as Motivo;
  const resumo = String(entrada.resumo ?? "").trim() || "sem resumo";

  const [handoff] = await ctx.db
    .insert(whatsappHandoffs)
    .values({ contatoId: ctx.contatoId, motivo, resumo })
    .returning();

  /* pausa com prazo — a IA volta sozinha, ao contrário da v1 */
  const ate = new Date();
  ate.setHours(ate.getHours() + Math.max(ctx.retomadaHoras, 1));
  await ctx.db
    .update(whatsappContatos)
    .set({ iaPausadaAte: ate })
    .where(eq(whatsappContatos.id, ctx.contatoId));

  if (ctx.telefoneAviso) {
    const aviso = [
      `Atendimento no WhatsApp precisa de você (${motivo.replace(/_/g, " ")}).`,
      `Contato: ${ctx.nomeContato ?? "sem nome"} — ${formatarTelefone(ctx.telefone)}`,
      resumo,
      `${ctx.baseUrl}/admin/whatsapp`,
    ].join("\n");

    const { erro } = await enviarAvisoHandoff(ctx.telefoneAviso, aviso);
    if (!erro) {
      await ctx.db
        .update(whatsappHandoffs)
        .set({ avisoEnviadoEm: new Date() })
        .where(eq(whatsappHandoffs.id, handoff.id));
    }
  }

  return "Handoff registrado e sócio avisado. Diga à pessoa que alguém do estúdio assume a conversa e encerre.";
}
