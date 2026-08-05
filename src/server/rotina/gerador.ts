import { and, asc, desc, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import type { DB } from "../db";
import {
  estudios,
  reservaEstudios,
  reservas,
  tarefaTemplates,
  tarefas,
} from "../db/schema";

/*
 * O gerador determinístico do Domínio 2. Regra escrita erra de forma
 * previsível e corrigível; modelo improvisando erra diferente a cada
 * segunda-feira — as 30 tarefas datadas em 2029 estão no planejamento
 * como prova. Aqui não há LLM: reservas são a fonte única, os templates
 * codificam a frequência, e as regras de virada são as do Tino.
 *
 * Pendências em aberto (decisão dos sócios, não código):
 * - janela do fim de semana: hoje o gerador só pula sáb/dom sem
 *   shooting; "adiantar preparo na sexta" entra quando decidirem a
 *   antecedência (próximo dia útil ou N dias).
 */

const ARRASTO_CORTE_DIAS = 7;
const ARRASTO_TETO = 5;

const somarDias = (iso: string, dias: number) => {
  const d = new Date(iso + "T12:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

async function reservasDoDia(db: DB, data: string) {
  const linhas = await db
    .select({
      id: reservas.id,
      horaFim: reservas.horaFim,
      estudioId: reservaEstudios.estudioId,
    })
    .from(reservas)
    .innerJoin(reservaEstudios, eq(reservaEstudios.reservaId, reservas.id))
    .where(
      and(
        lte(reservas.dataInicio, data),
        gte(reservas.dataFim, data),
        ne(reservas.status, "cancelada")
      )
    );
  return linhas;
}

export async function gerarDia(db: DB, data: string) {
  /* idempotente: dia já gerado não gera de novo */
  const [jaGerada] = await db
    .select({ id: tarefas.id })
    .from(tarefas)
    .where(eq(tarefas.data, data))
    .limit(1);
  if (jaGerada) return { gerado: false as const };

  const doDia = await reservasDoDia(db, data);
  const temShootingHoje = doDia.length > 0;
  const estudiosOcupados = new Set(doDia.map((r) => r.estudioId));

  const diaSemana = new Date(data + "T12:00Z").getUTCDay();
  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
  /* fim de semana sem shooting: nada gera; a frequência empurra tudo
   * para a próxima abertura (segunda) sozinha */
  if (fimDeSemana && !temShootingHoje) return { gerado: false as const };

  const novas: (typeof tarefas.$inferInsert)[] = [];

  /* 1. templates por frequência e modo */
  const ativos = await db
    .select()
    .from(tarefaTemplates)
    .where(eq(tarefaTemplates.ativo, true))
    .orderBy(desc(tarefaTemplates.prioridade), asc(tarefaTemplates.id));
  const totalEstudios = (
    await db.select({ id: estudios.id }).from(estudios)
  ).length;

  for (const t of ativos) {
    if (t.modoShooting === "shooting" && !temShootingHoje) continue;
    if (t.modoShooting === "livre" && temShootingHoje) continue;
    if (
      t.requerEstudioVago &&
      totalEstudios > 0 &&
      estudiosOcupados.size >= totalEstudios
    )
      continue;

    /* frequência: roda se nunca rodou, ou se venceu o intervalo */
    const [ultima] = await db
      .select({ data: tarefas.data })
      .from(tarefas)
      .where(
        and(eq(tarefas.templateId, t.id), eq(tarefas.ehArrasto, false))
      )
      .orderBy(desc(tarefas.data))
      .limit(1);
    if (ultima && somarDias(ultima.data, t.frequenciaDias) > data) continue;

    novas.push({
      data,
      templateId: t.id,
      titulo: t.titulo,
      estado: "pendente",
    });
  }

  /* 2. a virada — a regra do Tino, condicional ao dia seguinte */
  const amanha = await reservasDoDia(db, somarDias(data, 1));
  if (temShootingHoje) {
    const fimDoDia = doDia
      .map((r) => r.horaFim)
      .sort()
      .at(-1)!;
    if (amanha.length > 0) {
      novas.push({
        data,
        titulo:
          "Virada: limpeza e preparo — amanhã tem shooting (mínimo 3h após o término)",
        horaPrevista: fimDoDia,
        estado: "pendente",
      });
    } else {
      novas.push({
        data,
        titulo: "Fechamento: recolher lixo e fechar — limpeza fica para amanhã",
        horaPrevista: fimDoDia,
        estado: "pendente",
      });
    }
  }

  /* 3. arrasto: pendência não evapora — corte de 7 dias, teto por lista */
  const pendentes = await db
    .select()
    .from(tarefas)
    .where(
      and(
        eq(tarefas.estado, "pendente"),
        eq(tarefas.ehArrasto, false),
        lt(tarefas.data, data),
        gte(tarefas.data, somarDias(data, -ARRASTO_CORTE_DIAS))
      )
    )
    .orderBy(asc(tarefas.data))
    .limit(ARRASTO_TETO);
  for (const p of pendentes) {
    novas.push({
      data,
      templateId: p.templateId,
      estudioId: p.estudioId,
      titulo: p.titulo,
      estado: "pendente",
      ehArrasto: true,
      dataOriginal: p.dataOriginal ?? p.data,
    });
  }

  if (novas.length > 0) await db.insert(tarefas).values(novas);
  return { gerado: true as const, tarefas: novas.length };
}
