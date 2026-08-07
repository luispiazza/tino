import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  clientes,
  estudios,
  itens,
  pessoas,
  reservas,
  usuarios,
  whatsappConfig,
  whatsappContatos,
  whatsappMensagens,
} from "@/server/db/schema";
import type { DB } from "@/server/db";
import { chaveTelefone, formatarTelefone, paraEnvio } from "@/server/whatsapp/telefone";
import { resolverIdentidade } from "@/server/whatsapp/identidade";
import { contextoDeHoje } from "@/server/whatsapp/agente";
import { montarConhecimento } from "@/server/whatsapp/conhecimento";
import { atender, garantirConfig } from "@/server/whatsapp/atendimento";
import { executarFerramenta } from "@/server/whatsapp/ferramentas";
import { criarBancoDeTeste, criarCaller, sessaoFake } from "./helpers";

let db: DB;

beforeEach(async () => {
  db = await criarBancoDeTeste();
  /* sem chave nem credencial: nenhum teste encosta em rede */
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_VERIFY_TOKEN;
});

const socio = () => criarCaller(db, sessaoFake("socio"));

describe("telefone — a chave que faz a identidade funcionar", () => {
  it("mesmo número em quatro formatos vira a mesma chave", () => {
    const esperada = chaveTelefone("11999350085");
    expect(esperada).not.toBeNull();
    /* como a Meta manda */
    expect(chaveTelefone("5511999350085")).toBe(esperada);
    /* como o cadastro guarda */
    expect(chaveTelefone("(11) 99935-0085")).toBe(esperada);
    /* cadastro antigo, sem o nono dígito */
    expect(chaveTelefone("1199350085")).toBe(esperada);
  });

  it("número curto demais não vira chave — melhor ninguém que a pessoa errada", () => {
    expect(chaveTelefone("99350085")).toBeNull();
    expect(chaveTelefone("")).toBeNull();
    expect(chaveTelefone(null)).toBeNull();
  });

  it("DDDs diferentes nunca colidem", () => {
    expect(chaveTelefone("11999350085")).not.toBe(chaveTelefone("21999350085"));
  });

  it("formata para leitura e monta o E.164 do envio", () => {
    expect(formatarTelefone("5511999350085")).toBe("(11) 99935-0085");
    expect(paraEnvio("(11) 99935-0085")).toBe("5511999350085");
    expect(paraEnvio("5511999350085")).toBe("5511999350085");
  });
});

describe("o agente sempre sabe que dia é hoje", () => {
  it("injeta a data de São Paulo em AAAA-MM-DD, não a do servidor em UTC", () => {
    const texto = contextoDeHoje();
    const hojeSP = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    expect(texto).toContain(hojeSP);
    /* sem isto, "dia 12" e "sexta que vem" viram chute do modelo */
    expect(texto).toContain("AAAA-MM-DD");
    expect(texto).toMatch(/\d{2}:\d{2}/);
  });
});

describe("identidade — o número resolve antes de qualquer resposta", () => {
  it("cliente cadastrado é reconhecido mesmo com formatação diferente", async () => {
    const [c] = await db
      .insert(clientes)
      .values({ nome: "Ana Produtora", telefone: "(11) 99935-0085" })
      .returning();

    const id = await resolverIdentidade(db, "5511999350085");
    expect(id.papel).toBe("cliente");
    expect(id.clienteId).toBe(c.id);
    expect(id.nome).toBe("Ana Produtora");
  });

  it("número fora de todo cadastro fica desconhecido, sem vínculo nenhum", async () => {
    const id = await resolverIdentidade(db, "5511988887777");
    expect(id).toEqual({
      papel: "desconhecido",
      clienteId: null,
      pessoaId: null,
      nome: null,
    });
  });

  it("equipe ganha do cadastro de clientes — sócio não vira cliente de si mesmo", async () => {
    const [p] = await db
      .insert(pessoas)
      .values({ nome: "Luis", natureza: "socio_executor", telefone: "11999350085" })
      .returning();
    await db.insert(usuarios).values({
      nome: "Luis",
      email: "luis@tinoestudio.com.br",
      senhaHash: "x:y",
      papel: "socio",
      pessoaId: p.id,
    });
    /* o mesmo telefone também está na carteira de clientes */
    await db
      .insert(clientes)
      .values({ nome: "Luis Cliente", telefone: "11999350085" });

    const id = await resolverIdentidade(db, "5511999350085");
    expect(id.papel).toBe("socio");
    expect(id.pessoaId).toBe(p.id);
    expect(id.clienteId).toBeNull();
  });

  it("fornecedor e funcionário saem da natureza do cadastro", async () => {
    await db.insert(pessoas).values([
      { nome: "Ronaldo", natureza: "fornecedor_recorrente", telefone: "11911110000" },
      { nome: "Bia", natureza: "funcionario", telefone: "11922220000" },
    ]);
    expect((await resolverIdentidade(db, "5511911110000")).papel).toBe("fornecedor");
    expect((await resolverIdentidade(db, "5511922220000")).papel).toBe("funcionario");
  });

  it("pessoa inativa deixa de ser reconhecida", async () => {
    await db.insert(pessoas).values({
      nome: "Ex-funcionário",
      natureza: "funcionario",
      telefone: "11933330000",
      ativo: false,
    });
    expect((await resolverIdentidade(db, "5511933330000")).papel).toBe("desconhecido");
  });
});

describe("base de conhecimento viva — o problema 2 da v1", () => {
  it("monta a ficha do cadastro e nunca expõe custo de fornecedor", async () => {
    await db.insert(estudios).values({
      codigo: "A",
      nome: "Estúdio A",
      areaM2: 200,
      visaoGeral: "Pé-direito alto com ciclorama.",
      specs: [{ rotulo: "Energia", valor: "60a" }],
      caracteristicas: ["Camarim exclusivo"],
    });
    await db.insert(itens).values({
      nome: "Arara",
      unidade: "diária",
      precoCents: 5000,
      custoFornecedorCentsDia: 3000,
    });

    const texto = await montarConhecimento(db);
    expect(texto).toContain("Estúdio A");
    expect(texto).toContain("200 m²");
    expect(texto).toContain("60a");
    expect(texto).toContain("Camarim exclusivo");
    expect(texto).toContain("Arara");
    /* preço de tabela entra; custo de repasse jamais */
    expect(texto).toContain("50,00");
    expect(texto).not.toContain("30,00");
  });

  it("marca o complementar para a IA não vender B sozinho", async () => {
    const [a] = await db
      .insert(estudios)
      .values({ codigo: "A", nome: "Estúdio A" })
      .returning();
    const [b] = await db
      .insert(estudios)
      .values({ codigo: "B", nome: "Estúdio B", ehComplementar: true })
      .returning();
    await db
      .insert(await import("@/server/db/schema").then((m) => m.estudioDependencias))
      .values({ estudioId: b.id, dependeDeId: a.id });

    const texto = await montarConhecimento(db);
    expect(texto).toContain("nunca é vendido sozinho");
  });
});

describe("atendimento — as portas antes de a IA falar", () => {
  const msg = (wamid: string, texto = "oi") => ({
    telefone: "5511999350085",
    nomePerfil: "Ana",
    texto,
    wamid,
  });

  it("a mesma mensagem reentregue pela Meta não é atendida duas vezes", async () => {
    await atender(db, msg("wamid.AAA"));
    await atender(db, msg("wamid.AAA"));

    const linhas = await db.select().from(whatsappMensagens);
    expect(linhas).toHaveLength(1);
  });

  it("com a IA desligada, grava a conversa e não responde", async () => {
    await atender(db, msg("wamid.BBB"));
    const linhas = await db.select().from(whatsappMensagens);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].autor).toBe("contato");

    const [contato] = await db.select().from(whatsappContatos);
    expect(contato.papel).toBe("desconhecido");
    expect(contato.ultimaMensagemEm).not.toBeNull();
  });

  it("o papel é reescrito quando o cadastro muda, sem reprocessar nada", async () => {
    await atender(db, msg("wamid.CCC"));
    expect((await db.select().from(whatsappContatos))[0].papel).toBe("desconhecido");

    await db.insert(clientes).values({ nome: "Ana", telefone: "11999350085" });
    await atender(db, msg("wamid.DDD"));

    const [contato] = await db.select().from(whatsappContatos);
    expect(contato.papel).toBe("cliente");
    expect(contato.clienteId).not.toBeNull();
  });

  it("conversa com humano no comando não recebe resposta da IA", async () => {
    /* o contato nasce com a IA desligada, para o agente não entrar aqui */
    await atender(db, msg("wamid.EEE"));

    const daqui2h = new Date();
    daqui2h.setHours(daqui2h.getHours() + 2);
    await db.update(whatsappContatos).set({ iaPausadaAte: daqui2h });
    await garantirConfig(db);
    await db.update(whatsappConfig).set({ iaAtiva: true }).where(eq(whatsappConfig.id, 1));

    await atender(db, msg("wamid.FFF", "e aí?"));

    const linhas = await db.select().from(whatsappMensagens);
    expect(linhas).toHaveLength(2);
    /* as duas são do contato: a IA ficou quieta */
    expect(linhas.every((l) => l.autor === "contato")).toBe(true);
  });

  it("pausa vencida devolve a conversa à IA sozinha — o problema 4 da v1", async () => {
    await atender(db, msg("wamid.GGG"));

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    await db.update(whatsappContatos).set({ iaPausadaAte: ontem });
    await garantirConfig(db);
    await db.update(whatsappConfig).set({ iaAtiva: true }).where(eq(whatsappConfig.id, 1));

    await atender(db, msg("wamid.HHH", "voltei"));

    const [contato] = await db.select().from(whatsappContatos);
    expect(contato.iaPausadaAte).toBeNull();
  });
});

describe("ferramentas — a guarda que o portal web não tem", () => {
  async function cenario() {
    const [ana] = await db
      .insert(clientes)
      .values({ nome: "Ana", telefone: "11999350085" })
      .returning();
    const [bruno] = await db
      .insert(clientes)
      .values({ nome: "Bruno", telefone: "11988887777" })
      .returning();
    await db.insert(reservas).values({
      codigo: "T_01092026A",
      clienteId: bruno.id,
      dataInicio: "2026-09-01",
      dataFim: "2026-09-01",
      horaInicio: "08:00",
      horaFim: "18:00",
      status: "confirmada",
      tokenPortalProdutor: "f".repeat(64),
    });
    const [contato] = await db
      .insert(whatsappContatos)
      .values({ telefone: "5511999350085", papel: "cliente", clienteId: ana.id })
      .returning();
    return { ana, bruno, contato };
  }

  const ctxDe = (contatoId: number, clienteId: number | null) => ({
    db,
    contatoId,
    telefone: "5511999350085",
    nomeContato: "Ana",
    clienteId,
    telefoneAviso: null,
    retomadaHoras: 24,
  });

  it("saber o código da reserva alheia não abre os dados dela", async () => {
    const { ana, contato } = await cenario();
    const alheia = await executarFerramenta(
      ctxDe(contato.id, ana.id),
      "buscar_reserva",
      { codigo: "T_01092026A" }
    );
    /* nada da reserva vaza: nem token de portal, nem data, nem estado */
    expect(alheia.texto).not.toContain("f".repeat(64));
    expect(alheia.texto).not.toContain("2026-09-01");
    expect(alheia.texto).not.toContain("confirmada");
    expect(alheia.texto).toContain("Não é desta pessoa");

    /*
     * E a resposta é indistinguível da de um código inventado — senão a
     * própria negativa confirmaria que a reserva existe.
     */
    const inventada = await executarFerramenta(
      ctxDe(contato.id, ana.id),
      "buscar_reserva",
      { codigo: "T_99999999Z" }
    );
    expect(inventada.texto.replace("T_99999999Z", "X")).toBe(
      alheia.texto.replace("T_01092026A", "X")
    );
  });

  it("número sem cadastro não recebe dado de reserva nenhum", async () => {
    const { contato } = await cenario();
    const r = await executarFerramenta(ctxDe(contato.id, null), "buscar_reserva", {});
    expect(r.texto).toContain("não está ligado a nenhum cadastro");
    expect(r.texto).not.toContain("T_01092026A");
  });

  it("o dono vê a própria reserva, com o link do portal", async () => {
    const { bruno } = await cenario();
    const [dele] = await db
      .insert(whatsappContatos)
      .values({ telefone: "5511988887777", papel: "cliente", clienteId: bruno.id })
      .returning();

    const r = await executarFerramenta(ctxDe(dele.id, bruno.id), "buscar_reserva", {});
    expect(r.texto).toContain("T_01092026A");
    expect(r.texto).toContain("/portal/produtor/");
  });

  it("disponibilidade sai da regra única e enxerga o conflito", async () => {
    const [a] = await db
      .insert(estudios)
      .values({ codigo: "A", nome: "Estúdio A" })
      .returning();
    const [cliente] = await db
      .insert(clientes)
      .values({ nome: "Ana", telefone: "11999350085" })
      .returning();
    const [reserva] = await db
      .insert(reservas)
      .values({
        codigo: "T_10092026A",
        clienteId: cliente.id,
        dataInicio: "2026-09-10",
        dataFim: "2026-09-10",
        horaInicio: "08:00",
        horaFim: "18:00",
        status: "confirmada",
      })
      .returning();
    await db
      .insert(await import("@/server/db/schema").then((m) => m.reservaEstudios))
      .values({ reservaId: reserva.id, estudioId: a.id });
    const [contato] = await db
      .insert(whatsappContatos)
      .values({ telefone: "5511999350085", papel: "cliente", clienteId: cliente.id })
      .returning();

    const ocupado = await executarFerramenta(
      ctxDe(contato.id, cliente.id),
      "consultar_disponibilidade",
      {
        estudios: ["A"],
        data_inicio: "2026-09-10",
        data_fim: "2026-09-10",
        hora_inicio: "09:00",
        hora_fim: "12:00",
      }
    );
    expect(ocupado.texto).toContain("OCUPADOS: A");

    /* horário disjunto no mesmo dia não conflita — diária parcial existe */
    const livre = await executarFerramenta(
      ctxDe(contato.id, cliente.id),
      "consultar_disponibilidade",
      {
        estudios: ["A"],
        data_inicio: "2026-09-10",
        data_fim: "2026-09-10",
        hora_inicio: "19:00",
        hora_fim: "22:00",
      }
    );
    expect(livre.texto).toContain("LIVRES: A");
  });

  it("escalar pausa a IA com prazo e registra o handoff com contexto", async () => {
    const { ana, contato } = await cenario();
    const r = await executarFerramenta(ctxDe(contato.id, ana.id), "escalar_para_humano", {
      motivo: "fechar_reserva",
      resumo: "Quer o A no dia 12/09, das 9h às 18h.",
    });
    expect(r.escalou).toBe(true);

    const [atualizado] = await db
      .select()
      .from(whatsappContatos)
      .where(eq(whatsappContatos.id, contato.id));
    expect(atualizado.iaPausadaAte).not.toBeNull();
    expect(atualizado.iaPausadaAte!.getTime()).toBeGreaterThan(Date.now());

    const pendentes = await socio().whatsapp.conversas();
    expect(pendentes[0].handoff?.motivo).toBe("fechar_reserva");
    expect(pendentes[0].handoff?.resumo).toContain("12/09");
    expect(pendentes[0].iaPausada).toBe(true);
  });
});

describe("webhook — o handshake e o que nunca vira conversa", () => {
  async function rota() {
    return import("@/app/api/whatsapp/webhook/route");
  }
  const get = (params: string) =>
    new Request(`http://local/api/whatsapp/webhook?${params}`);

  it("sem credenciais no serviço, nem responde ao handshake", async () => {
    const { GET } = await rota();
    const r = GET(get("hub.mode=subscribe&hub.verify_token=x&hub.challenge=123"));
    expect(r.status).toBe(503);
  });

  it("token errado é recusado; o certo devolve o desafio da Meta", async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1";
    process.env.WHATSAPP_ACCESS_TOKEN = "t";
    process.env.WHATSAPP_VERIFY_TOKEN = "segredo-do-webhook";
    const { GET } = await rota();

    expect(
      GET(get("hub.mode=subscribe&hub.verify_token=errado&hub.challenge=123")).status
    ).toBe(403);

    const ok = GET(
      get("hub.mode=subscribe&hub.verify_token=segredo-do-webhook&hub.challenge=123")
    );
    expect(ok.status).toBe(200);
    await expect(ok.text()).resolves.toBe("123");
  });

});

describe("admin — quem pode mexer", () => {
  it("funcionário não lê nem configura o atendimento", async () => {
    const func = criarCaller(db, sessaoFake("funcionario"));
    await expect(func.whatsapp.config()).rejects.toThrow();
    await expect(func.whatsapp.conversas()).rejects.toThrow();
    await expect(func.whatsapp.salvarConfig({ iaAtiva: true })).rejects.toThrow();
  });

  it("a tela nunca devolve o valor de uma credencial", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "segredo-que-nao-pode-vazar";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "1182100684996514";

    const { credenciais } = await socio().whatsapp.config();
    expect(credenciais.accessToken).toBe(true);
    expect(JSON.stringify(credenciais)).not.toContain("segredo-que-nao-pode-vazar");
    /* identificador público volta inteiro: serve para conferir na Meta */
    expect(credenciais.phoneNumberId).toBe("1182100684996514");
  });

  it("devolver para a IA limpa a pausa e fecha o handoff", async () => {
    const [contato] = await db
      .insert(whatsappContatos)
      .values({ telefone: "5511999350085", papel: "cliente" })
      .returning();
    await executarFerramenta(
      {
        db,
        contatoId: contato.id,
        telefone: "5511999350085",
        nomeContato: null,
        clienteId: null,
        telefoneAviso: null,
        retomadaHoras: 24,
      },
      "escalar_para_humano",
      { motivo: "pedido_explicito", resumo: "pediu humano" }
    );

    await socio().whatsapp.retomarIa({ contatoId: contato.id });

    const conversas = await socio().whatsapp.conversas();
    expect(conversas[0].handoff).toBeNull();
    expect(conversas[0].iaPausada).toBe(false);
  });
});
