# Planejamento — Tino Estúdio v2

Documento vivo. Construído domínio por domínio a partir da leitura do código da v1.
Nada aqui é implementação — é decisão e registro.

**Status:** em construção · **Fases 0, 1 e 2 concluídas e publicadas**
**Última atualização:** 28/07/2026 (fim do dia)

---

## ⚠ Retrato dos dados — medido em produção em 28/07

Três suposições deste documento foram verificadas contra o banco e **duas
estavam erradas**. Os diagnósticos ficam em `scripts/` e podem ser repetidos.

### A Fase 1 é menor do que este plano supõe

`node scripts/diagnostico-datas.mjs`

| Coluna | Tipo real hoje | Sujeira encontrada |
|---|---|---|
| `reservations.reservationDate` | **`date`** — já é tipo real | **nenhuma** (41/41 ISO) |
| `reservations.endDate` | **`date`** | nenhuma (3/3) |
| `reservations.startTime` / `endTime` | `varchar(10)` | nenhuma (41/41 `HH:MM`) |
| `checkInTime` / `checkOutTime` | `varchar(10)` | nenhuma (3/3) |
| `reservations.studios` | `varchar(100)` | nenhuma — 41/41 array JSON válido |
| `rental_orders.reservationDate` | `varchar(20)` | **este continua sendo texto** |

O item "data e hora como strings separadas" **já está resolvido em
`reservations`**. Não há linha que não converta, então o backfill de
expand/contract é mecânico, sem regra de exceção a inventar. O que sobra é
`rental_orders.reservationDate` — que é o item 7 do Domínio 3, e segue valendo.

### O gerador por IA produziu 103 tarefas com data impossível

| Ano | Tarefas | Padrão |
|---|---|---|
| 2027 | 29 | todas em `2027-12-20` |
| 2029 | 30 | todas em `2029-06-15`, criadas no mesmo instante |
| 2031 | 44 | espalhadas pelo ano |

As 30 de 2029 saíram de uma geração só, às `2026-04-02 13:28:42`: o modelo
inventou o ano. Datadas anos à frente, **nunca chegaram ao Michael** — o que
elas cobriam (banheiros, cozinha, camarins, áreas externas) não foi feito
naqueles dias e ninguém foi avisado.

É a evidência concreta do argumento de 2.5 para geração determinística: regra
escrita erra de forma previsível e corrigível; modelo improvisando erra
diferente a cada vez. **Apagadas em 28/07** (nenhuma estava marcada como
concluída, então não se perdeu histórico de execução).

### O que a execução encontrou e o plano não previa

Achados de 28/07 que mudam o documento. Cada um está com teste e commit.

| Achado | Onde | Estado |
|---|---|---|
| **Tino Rental quebrado desde 20/05** | `rental_order_items` ficou com `inventoryId` (dado real) e `rentalItemId` (zerado). O código lê a nova, e a antiga é NOT NULL sem default: com o MySQL em modo estrito, criar pedido falhava | corrigido (0042), ligado **por nome** — os ids estavam deslocados em um, e copiar id ligaria Pranchão à Arara |
| **Preço dos extras vinha do cliente** | `extras.request` somava o `priceInCents` do pedido. Portal público e sem login: qualquer um pedia arara por R$ 0,01 | corrigido — servidor resolve preço, nome e unidade pelo id |
| **Kit cozinha lançava R$ 200 sem checar reserva** | `kitchen.requestKit` não verificava sequer se a reserva existia | corrigido na Fase 0 |
| **`paintingCost` não tinha caminho de código** | A rota de edição não aceitava campo de pintura. Os R$ 2.250 da EGREY foram digitados direto no banco | corrigido — os dois lados entram, com a margem visível |
| **`users` mentia** | Michael com `shift=afternoon` (é da manhã) e Luis como `role=user` (é sócio). Com o Sandro desativado, o Michael abriria o app sem tarefa nenhuma | corrigido em produção |
| **Falha de e-mail descartava pedido já gravado** | `extras.request` gravava, tentava enviar e estourava. O cliente pedia de novo e a comanda cobrava duas vezes | corrigido — falha de envio vira log |
| **Consumível não é perda** | Dos 13 itens do kit, 7 são consumíveis (café, açúcar, detergente). Contar não responde nada | `expectedQty` nulo os separa; 6 duráveis entram no inventário |
| **Diária parcial existe** | 28/05: Estúdio A vendido 10:00–15:00 e 17:00–19:00, duas reservas com um minuto de diferença. O plano assume diária de 12h | a checagem de conflito considera **horário**, não só data |

### O Sandro estava ativo no cadastro

A suspeita de 2.6 se confirmou pelo avesso: ele **não** tinha sido desativado,
por isso o gerador nunca travou. Corrigido em 28/07, junto com a guarda —
`aiAgent.ts` agora trata os turnos de forma independente, então turno
descoberto não derruba mais o turno coberto.

O turno da tarde passa a aparecer como descoberto, que é a verdade da operação
e o que a escala do Domínio 2 vai modelar.

---

## Índice de domínios

| # | Domínio | Status do mapa |
|---|---------|----------------|
| 1 | Reservas & Estúdios | mapeado, em revisão com o Tino |
| 2 | Rotina da equipe | mapeado, em revisão com o Tino |
| 3 | Tino Rental (equipamento) | mapeado, decidido |
| 4 | Consumíveis e Cozinha | mapeado dentro do Domínio 3 |
| 5 | WhatsApp IA e integrações | mapeado + especificação v2 |
| 6 | Portais e site público | em mapeamento |
| 7 | **Financeiro** (novo na v2) | em especificação |
| 8 | **Painéis internos** (Home e Visão Geral) | mapeado + proposta de reorganização |
| 9 | **Resultados e campanhas** (novo na v2) | especificado |

---

## Stack atual (v1)

React + Vite · tRPC · Drizzle ORM · MySQL · Railway · S3 (arquivos e PDFs)
Integrações: Google Calendar, Google Sheets (planilha financeira), Resend (e-mail), WhatsApp (agente com IA)
~36 mil linhas · 32 tabelas · 17 telas

---

# Matriz de permissões

**Aprovada por Guimel e Luis em 25/07.** Resolve uma pendência que atravessava quatro domínios e que estava registrada no HANDOFF como "resolvemos depois".

## Papéis

| Papel | Acesso | Quem |
|---|---|---|
| **Sócio** | Login | Guimel, Luis |
| **Funcionário** | Login | Michael, e o próximo contratado |
| **Fornecedor** | Login | Ronaldo, pintor, faxineira, ar condicionado, dedetização |
| **Cliente / produtor** | **Link com token, sem login** | Muda a cada job — criar conta seria atrito |

**Fornecedor não é uma coisa só.** O pintor e a faxineira ocupam vaga na escala: "o que é meu" é um turno com data. O Ronaldo não entra em escala; o que é dele são pedidos de equipamento com data de entrega. Mesmo login, conteúdo diferente.

## A matriz

| | Sócio | Funcionário | Fornecedor | Cliente / produtor |
|---|---|---|---|---|
| Reservas | Tudo | Agenda do dia | — | Só a própria |
| Valores de reserva | Tudo | — | — | Só o próprio |
| Financeiro | Tudo | — | — | — |
| Custo de fornecedor | Tudo | — | **Só o próprio** | — |
| Rotina / escala | Tudo | A própria | **Só o que é dele** | — |
| Marcar tarefa feita | Sim | Sim | Nas dele | — |
| Tino Rental — estoque | Tudo | Consulta e monta pedido | Só os pedidos dele | Catálogo e pedido |
| Preço de aluguel | **Só sócio edita** | Consulta | — | Vê o que é cobrado |
| Cadastros | Tudo | Não edita | — | — |
| Resultados e campanhas | Tudo | — | — | — |
| Configuração | Tudo | — | — | — |

## O que isso corrige

1. **Preço de aluguel volta a ser coisa de sócio.** Hoje `rental.ts` inteiro usa `protectedProcedure` — qualquer funcionário logado edita preço, apaga fornecedor e apaga pedido.
2. **O fornecedor vê o próprio custo e nada mais.** O Ronaldo precisa saber quanto vai receber, mas não pode ver quanto foi cobrado do cliente pelo mesmo item.
3. **O funcionário perde a capacidade de apagar cadastro**, mantendo a consulta e a montagem de pedido que ele usa no dia a dia.

---

# Proposta de escopo e faseamento

Primeira proposta, para os sócios reagirem. Cada fase existe porque a seguinte depende dela.

## A tensão central

Há duas urgências legítimas e elas competem:

| Urgência | Argumento |
|---|---|
| **Vender mais** | O site nunca foi divulgado, a média mensal caiu, e a meta é ocupar o espaço |
| **Parar de sangrar** | Reserva pode ser criada em cima de outra, itens somem sem controle, portais abertos permitem gastar dinheiro alheio |

**Recomendação:** não é escolher uma. É que campanha sem fundação é pior que campanha nenhuma — mais demanda chegando num sistema que aceita reserva duplicada, e numa operação de um funcionário só que já vira a noite para dar conta. O crescimento expõe a rachadura em vez de escondê-la.

**Caminho proposto:** instrumentar o site é barato e entra cedo (Fase 1), permitindo campanha em escala reduzida enquanto a fundação é corrigida. Campanha cheia só depois da Fase 2.

---

## Fase 0 — Agora (dias, não semanas)

Não é v2, é conserto. Nada aqui depende de decisão de produto.

| # | O quê | Por quê |
|---|---|---|
| 1 | Revogar a chave do Google Calendar exposta no histórico do Git | Está no HANDOFF, ainda não foi feito |
| 2 | Token de acesso nos portais + confirmação no "Fechar Comanda" | Hoje, adivinhar um código permite gastar dinheiro em nome do cliente |
| 3 | Verificar se o gerador de tarefas está retornando vazio | Com o Sandro desativado, o Michael pode ter parado de receber lista |
| 4 | Verificar contatos com a IA do WhatsApp pausada | Handoff pausa e nunca retoma |
| 5 | Banco de teste isolado | Testes rodam contra produção |
| 6 | Remover foto duplicada (uma linha) | Aparece em todas as páginas de estúdio |

## Fase 1 — Fundações

Nada aqui aparece na tela. Tudo o mais depende.

**Primeiro, uma decisão — não código:**

- [ ] **Unidade de locação.** Se eventos, workshops e gastronômico entram na v2, "diária de 12h das 07:00 às 19:00" morre. Isso muda o modelo de reserva, que é a base de todo o resto. **Decidir aqui ou refazer depois.**

**Depois:**

- ~~Data e hora como tipo real~~ — já é `date` em `reservations`, 41/41 sem sujeira. Resta `rental_orders.reservationDate` *(item 7 do Domínio 3)*
- Estúdios da reserva em tabela de junção, e estúdios vindos do cadastro, não do enum
- Catálogo único de itens — encerrar `rentalInventory` e `reservationExtras`
- Uma única regra de disponibilidade, considerando **período** e não data exata
- **Checagem de conflito na criação de reserva**
- Matriz de permissões *(pendente em quatro domínios)*
- Trilha de auditoria
- **Instrumentação do site:** gravar montagens do configurador com origem, e código curto que sobrevive ao `wa.me`

## Fase 2 — Parar de perder dinheiro ✅

- [x] **Kit cozinha no inventário periódico** — contagem semanal, sem multa. Cores de papel adiadas: rolo é consumido, não perdido, e o mecanismo pode não servir
- [x] Custo de fornecedor multiplicando por dias
- [x] Registrar o custo pago ao pintor — e a cobrança, que também não existia
- [x] Trava no desconto *(saiu na Fase 1)*
- [x] **Tabela de cobranças**, com as duas datas e a esteira de estados
- [x] Reserva cancelada deixa de entrar no financeiro

**Não depende dos provedores.** Mercado Pago e NFS-e entram nos campos de
referência externa; a esteira inteira funciona sem eles. O que trava sem a
decisão do NFS-e é emitir nota, não modelar.

## Fase 3 — Enxergar

- **Agenda de obrigações** — o painel de vigilância
- Home dos sócios deixa de ser menu e vira painel
- Visão Geral reorganizada, com **ocupação por estúdio**
- Despesas cadastradas, com as recorrentes projetadas
- Custo de cobertura de turno *(a conta que justifica a contratação)*

## Fase 4 — Operação

- ~~**Escala** no lugar de turno fixo por pessoa~~ *(✅ 29/07 — vaga, jornada esperada, e o custo virando despesa sozinho)*
- ~~Rotina determinística, lendo reservas em vez do Google Calendar~~ *(✅ 29/07 — gerador, tela de turno e planejamento leem reservas; a regra do fim de semana passa a olhar a próxima abertura)*
- ~~Pendência que não evapora, folga que redistribui~~ *(✅ 29/07 — arrasto com data de corte e teto por lista; folga sinaliza em vez de reatribuir)*
- ~~Viabilidade de virada e controle da tinta colorida~~ *(✅ 29/07 — avisa e provisiona, nunca recusa; reserva de vários dias não gera virada)*
- ~~Cadastro de pessoas com as quatro naturezas~~ *(✅ 29/07 — `natureza` no cadastro e tela única. **Login de fornecedor fica pendente**: é superfície de autenticação externa e pede passada própria, junto da matriz de permissões)*
- Acionamento de fornecedor por WhatsApp

## Fase 5 — Vender

**✅ Decisões (29/07):**

- **Uma vitrine forte, não quatro homes.** Três dos quatro segmentos são a conquistar e não têm foto nem case próprios; quatro páginas vazias convertem menos que uma cheia. As outras entram quando houver material de cada segmento.
- **A ação principal da vitrine é o Monte seu Tino.** É o que mais qualifica o contato, e já tem instrumentação de origem. Ela é a única ação creme da tela.
- **Combinações: as três que mais saem lideram a vitrine** *(respondido em 29/07)*: **A+B** (360m²), **A+B+C** (444m²) e **E+C** (144m²). A estrutura permite seis, mas as outras três não puxam a venda.

  **A e E sozinhos não estão na lista**, e é o achado que mais muda o desenho: a unidade de apresentação é a combinação, não o estúdio. Uma vitrine que liste quatro espaços e trate a soma como upsell inverte o que o negócio faz.
- **A home é a mudança de maior risco e vai por último.** A ordem passa a ser: admin → portais → vitrine.


- Complementares deixam de ser produto; combinações viram a vitrine
- Redesenho das páginas de estúdio e ~~dos dois portais~~ *(portais ✅ 29/07)*
- ~~Resumo financeiro persistente no Portal do Produtor~~ *(✅ 29/07 — barra fixa no rodapé, com a composição do total)*
- Quatro homes por segmento
- Painel de resultados e campanhas
- **Campanha cheia**

## Fase 6 — Depois da v2

- Cobrança online (PIX, cartão) e emissão de nota fiscal
- WhatsApp multi-público, em ondas
- Integração bancária para baixa automática
- APIs de mídia para custo automático
- Integração de custo por linha de negócio

---

## Resumo do corte

| Fase | Nome | Entrega |
|---|---|---|
| 0 | Conserto | Risco imediato eliminado |
| 1 | Fundações | Sistema para de mentir |
| 2 | Sangria | Dinheiro para de vazar |
| 3 | Visão | Vocês enxergam o negócio |
| 4 | Operação | A rotina funciona sozinha |
| 5 | Venda | O site vende e mede |
| 6 | Depois | Automação financeira |

**v2.0 = Fases 0 a 5.** A Fase 6 é v2.1.

---

# Domínio 1 — Reservas & Estúdios

**Tabelas:** `reservations`, `studios`, `studioEquipment`, `studioGallery`, `studioRules`, `clients`, `reservationExtras`, `extraRequests`

## 1.1 O que funciona e se transporta para a v2

**Ficha técnica dos estúdios.** A tabela `studios` guarda área, m² de ciclorama, tipo de fundo, pé direito, amperagem, voltagem, tipo de tomada e conexão, cozinha item a item, mesas e lugares, plantas baixa e elétrica em PDF, banheiros (contagem, PCD, chuveiro), e as flags `isComplementary` / `isOutdoor` / `isHybrid` / `hasMovableCyclorama`. É um diferencial real — produtor não precisa ligar para perguntar. Preservar integralmente.

**Fechamento de comanda.** Fluxo completo: check-in/check-out → hora extra automática com tolerância de 30 min → extras → cores de papel → pintura de fundo infinito → kit cozinha → total → PDF no S3.

**Extras validam estoque.** `reservationExtras.rentalGroupId` liga o catálogo do portal ao Tino Rental, com checagem de disponibilidade por data antes de aceitar o pedido.

## 1.2 Problemas identificados no código

| # | Problema | Onde | Gravidade |
|---|----------|------|-----------|
| 1 | Criar reserva não verifica conflito de agenda | `routers.ts` `reservations.create` | Alta |
| 2 | Código da reserva é sequencial e é a única credencial dos portais públicos | `db.ts` `getNextReservationCode`, `producer.*` | Alta |
| 3 | Estúdios hardcoded em `z.enum(["A","B","C","E"])` apesar da tabela `studios` | `routers.ts` | Média |
| 4 | ~~Data e hora como strings separadas~~ — medido em 28/07: `reservationDate` e `endDate` já são `date`, e os horários estão todos em `HH:MM` | `schema.ts` `reservations` | Resolvido |
| 5 | `studios` da reserva é JSON dentro de `varchar(100)` em vez de tabela de junção | `schema.ts` | Média |
| 6 | Sem buffer de limpeza/montagem entre reservas | inexistente | A definir |
| 7 | Desconto fixo sem trava — total pode ficar negativo | `routers.ts` `reservations.create` | Baixa |
| 8 | Sem status de pagamento — `paymentMethod` é texto livre | `schema.ts` | Alta |
| 9 | Sem trilha de auditoria de alterações | inexistente | Média |

**Detalhe do item 1:** a função correta existe (`db.getConfirmedReservationsOverlapping`) mas é chamada em um único lugar — `whatsappTools.ts`. O agente de WhatsApp sabe checar disponibilidade; o painel admin não.

**Detalhe do item 2:** o formato é `T_DDMMYYYY` + letra sequencial (`T_01042026A`, `B`, `C`…). As rotas `producer.getByCode`, `producer.updateCheckInOut` e `producer.updatePainting` são `publicProcedure`. Quem adivinhar um código lê dados do cliente e valores, e altera check-in/check-out de reserva alheia — o que muda a hora extra cobrada.

## 1.3 Demandas do Tino para a v2

### D1 — Reescrever a UX das ações da linha de reserva

**Situação atual:** cada linha da tabela de reservas tem 8 botões de ícone de 12px, sem rótulo:

| Ícone | Ação |
|-------|------|
| `ExternalLink` | Abrir portal da reserva |
| `ClipboardList` | Portal do Produtor |
| `Mail` | Enviar reserva por e-mail (guarda estado `emailSent`) |
| `MessageCircle` | Enviar reserva por WhatsApp (guarda estado `whatsappSent`) |
| `PackagePlus` | Ver pedidos de extras |
| `ShoppingBag` | Gerar Rental para esta reserva |
| `Edit` | Editar |
| `Trash2` | Remover |

**Problemas concretos:**

- Ícones de 12px — muito abaixo do alvo de toque recomendado (44px)
- Oito ações no mesmo nível hierárquico: nada indica qual é a principal
- Ações de natureza diferente lado a lado — navegar, disparar mensagem ao cliente, editar, e **excluir** ocupam o mesmo peso visual
- Duas delas têm efeito externo irreversível (dispara e-mail/WhatsApp ao cliente) e ficam a um clique de distância, vizinhas da lixeira
- O estado "já enviado" existe no banco (`emailSent`, `whatsappSent`) mas só aparece no `title` do hover — invisível na varredura visual

**Direção proposta (a validar):** linha clicável abrindo painel lateral de detalhe, com as ações agrupadas por intenção — *Comunicação*, *Documentos*, *Portais*, *Gerenciar*. Na linha, no máximo uma ação primária e um menu de estouro. Estado de envio visível como selo, não como tooltip. Exclusão fora do alcance imediato.

**Decisão do Tino:** a ação principal é **enviar** (WhatsApp e e-mail). Os links dos dois portais passam a ir automaticamente dentro da mensagem de WhatsApp, então **copiar link deixa de ser tarefa** — os dois botões de portal saem do primeiro nível e viram acesso de conferência, dentro do detalhe.

**Encaminhamento:** a linha passa a ter uma ação primária de envio com estado visível (não enviado / enviado em DD/MM / reenviar), e o resto migra para o painel de detalhe. Excluir sai da linha.

### D2 — Pagamento, cobrança e nota fiscal integrados à reserva

Esta é a maior mudança estrutural da v2.

**O que o Tino quer:** no momento de criar a reserva, já definir a condição comercial completa — forma (à vista, crédito, depósito, PIX), se tem nota fiscal, e se o cliente exige PO antes do faturamento. A partir disso, o sistema emite a cobrança e a nota automaticamente e dispara por e-mail e WhatsApp junto com a confirmação: código PIX se for PIX, link de pagamento se for cartão. E na v2 isso alimenta um módulo financeiro com extrato atualizado.

**Constatação que muda o desenho:** hoje existe um único `totalAmount`, calculado na criação da reserva. Mas o valor final só se fecha na comanda, que soma hora extra, extras, cores de papel, pintura e kit cozinha. Ou seja, **uma reserva tem mais de um momento de cobrança** — o antecipado e o do fechamento. Um campo de pagamento na tabela `reservations` não comporta isso.

**Modelo proposto:** tabela `charges` (cobranças), 1 reserva → N cobranças. Cada cobrança carrega:

- tipo: `sinal` · `diária` · `fechamento` · `avulsa`
- valor, forma de pagamento, condição (à vista / parcelado em N)
- exige nota fiscal? exige PO?
- estado, percorrendo: `aguardando PO` → `PO recebido` → `cobrança emitida` → `paga` → `NF emitida` → `conciliada`
- referências externas: txid do PIX, link de pagamento, número/URL da NF

**Decisões tomadas (Guimel + Luis, 25/07):**

| Questão | Decisão |
|---|---|
| Sinal ou faturamento no fim? | **Faturar tudo no fechamento.** Não há cobrança antecipada |
| Provedor de cobrança | **Mercado Pago** |
| Provedor de NFS-e | Definir depois — já existe uma opção em vista |
| Um provedor ou dois? | **Dois separados** — cobrança e nota fiscal |
| Quem cobra o inadimplente? | **Os sócios**, manualmente. O sistema não cobra sozinho — **lembra** |
| Planilha do Google | **Descontinuada.** Tudo passa a ser feito no sistema |

### Consequências a registrar

**Faturar tudo no fechamento significa operar sem lastro.** Sem sinal, um no-show custa a diária inteira e não há valor retido para reter. A política de cancelamento passa a ser um acordo sem garantia financeira. Decisão comercial legítima — registrada aqui apenas para não ser redescoberta depois.

**Régua de lembretes com duas pontas.** O pedido é *"deixar o cliente sempre informado"*, então o lembrete não é só interno:

| Momento | Destinatário |
|---|---|
| Vencimento se aproximando | Cliente (aviso) + sócio (preparar) |
| Vencido | Cliente (cobrança) + sócio (agir) |

Ambos exigem template aprovado na Meta → soma-se ao inventário de 5.3.6.

**⚠️ Descontinuar a planilha implica migração, e isso não estava contado.** A aba `Receitas` tem 453 linhas de histórico e a `Despesas`, 137 lançamentos. Nada disso existe no banco. Antes de desligar a planilha é preciso decidir:

**✅ Decisão final (25/07): não importar nada anterior ao sistema.**

A planilha inteira vira arquivo morto. O financeiro começa vazio no dia em que o sistema entrar.

**Raciocínio:** a aba `Receitas` só tem cliente, código, vencimento e valor bruto — sem estúdio, sem data de shooting, sem composição do valor e sem data de pagamento. Esses lançamentos alimentariam o caixa mas não conseguiriam participar dos relatórios de ocupação nem de receita por linha de negócio. Somado ao trabalho manual de separar as diárias canceladas e reposicionar as quatro linhas fora da soma, o esforço não se pagava.

**Único requisito que isso cria:**

- [ ] **Informar o saldo em conta no dia da virada.** Um número. Sem ele o fluxo de caixa parte do zero e exibe um saldo que não existe

### D3 — Melhorar o calendário

Estado atual: grade mensal com chips de nome do cliente nos dias ocupados. Legenda de status (confirmada / pendente / cancelada) no rodapé.

**Observações iniciais:**

- O chip mostra o nome do cliente mas **não mostra qual estúdio** — com a checagem de conflito ausente (problema 1.2 #1), o calendário é hoje a única defesa contra reserva duplicada, e ele não dá a informação necessária para isso
- Só existe visão de mês; não há semana nem dia
- Mês com poucas reservas fica quase todo vazio, ocupando muita tela para pouca informação
- Reserva multi-dia aparece como dias soltos, não como faixa contínua

**Decisão (Guimel + Luis, 25/07):** o calendário responde **as três perguntas** — "o que tem hoje?", "esse dia está livre?" e "como está o mês?". Visões de **semana, mês e ano**.

- Semana — operação: o que acontece nos próximos dias, com estúdio e virada visíveis
- Mês — a visão atual, corrigida para mostrar o estúdio em cada reserva e faixa contínua em reserva multi-dia
- Ano — ocupação e sazonalidade; conversa direto com o placar do Domínio 8

**✅ Visão padrão ao abrir: mês.**

## 1.4 Decisões do Tino sobre os itens

**Sobre o que funciona:** as páginas de estúdio estão bem resolvidas em conteúdo. A melhoria é de **apresentação**, dentro do redesenho geral do site — a informação existe e é boa, falta layout à altura. Nada a remodelar no dado.

| # | Problema | Decisão |
|---|----------|---------|
| 1 | Sem checagem de conflito | **Ajustar** — sem dúvida |
| 2 | Código sequencial como credencial | **Ajustar**, preservando o código legível (ver abaixo) |
| 3 | Estúdios hardcoded | **Simplificar**, prioridade baixa — estúdio novo é improvável a curto prazo |
| 4 | Data/hora como string | **Já resolvido** em `reservations` (medido em 28/07, sem sujeira). Segue valendo em `rental_orders` |
| 5 | `studios` como JSON em varchar | **Ajustar** — aplicar a melhor prática |
| 6 | Buffer entre reservas | Em discussão — ver 1.5 |
| 7 | Desconto sem trava | **Ajustar** |
| 8 | Sem status de pagamento | **Ajustar**, conversando com o sistema financeiro do estúdio |
| 9 | Sem auditoria | **Ajustar** |

### Encaminhamento do item 2 — código da reserva

O código `T_01042026A` tem valor real: a equipe decora, ele vai na nota fiscal, e serve de referência falada. **Não se perde.** O que muda é o papel dele: hoje ele é simultaneamente identificador e senha. Na v2 separa-se em dois:

- **Código** (`T_01042026A`) — identificador humano. Continua na NF, nos e-mails, na conversa.
- **Token de acesso** — string opaca e aleatória, uma por portal (reserva e produtor), presente só na URL enviada ao cliente. Revogável, e com data de expiração após o fechamento da comanda.

Assim o código continua sendo adivinhável — e isso deixa de importar, porque adivinhar não abre nada.

## 1.5 Item 6 — buffer entre reservas (em discussão)

**O que é:** janela bloqueada entre o fim de uma reserva e o início da próxima, em que o estúdio existe mas não está à venda. A v1 não tem esse conceito.

**Por que importa neste projeto especificamente:**

1. **Pintura de fundo infinito** — já modelada (`paintingLayout`, `paintingColors`, `paintingCost`). Ciclorama pintado hoje não está pronto para outra cor amanhã às 07:00. Repintura e secagem são tempo real.
2. **Hora extra** — `checkOutTime` pode ultrapassar `endTime` (e é cobrado por isso). A reserva "termina" 19:00 e o cliente sai 22:45; a limpeza escorrega para a manhã seguinte.
3. **A rotina de zeladoria não conhece a agenda** — `dailyTasks` e os turnos existem como domínio isolado, sem nenhuma ligação com `reservations`. O buffer é o conceito que liga os dois.
4. **Estúdios complementares** — `isComplementary` + `parentStudioCodes`: bloquear um afeta o outro.
5. **Devolução de rental** — equipamento precisa voltar e ser conferido antes de ser prometido a outro cliente.

**Implementação provável:** minutos de setup/desmontagem por estúdio, mais regras condicionais (pintura soma X horas, vídeo soma Y). A checagem de conflito do item 1 passa a considerar reserva **+ buffer**.

**Como funciona hoje (resposta do Tino):** no olho, e a regra real é **condicional ao dia seguinte**:

- Terminou shooting **e amanhã tem shooting** → o estúdio precisa estar limpo e repintado de branco. O funcionário precisa de **no mínimo 3h** após o término.
- Terminou shooting **e amanhã não tem** → o funcionário da noite só recolhe lixo e fecha. Limpeza e pintura ficam para o dia seguinte.

Existem mais variáveis — a serem levantadas no Domínio 2 (Rotina da equipe).

**Correção importante (Tino):** buffer **não bloqueia venda**. A diária vendida é de 12h; passou disso, é hora extra. Se existe reserva no dia seguinte, o shooting **acontece** — a equipe vira a noite para limpar e pintar se for preciso. O estúdio nunca deixa de ser vendido por causa da virada.

Ou seja: o que a v1 não modela não é uma janela de bloqueio, é a **consequência operacional e de custo** da virada.

**Reformulação do conceito.** Não é "buffer", é **viabilidade de virada**. O sistema não deve impedir a reserva — deve **avisar** e **provisionar**:

> "Reserva criada no dia seguinte ao shooting T_13042026A, com pintura colorida. Isso gera turno noturno de limpeza + fornecedor de pintura (~5h). Custo estimado: R$ X."

**Variáveis que entram no cálculo da virada:**

| Situação | Consequência |
|----------|--------------|
| Amanhã tem shooting | Limpeza + repintura de branco, mínimo 3h, na noite anterior |
| Amanhã não tem shooting | Funcionário da noite só recolhe lixo e fecha; limpeza fica para o dia seguinte |
| Cliente estourou as 12h (hora extra) | Janela de limpeza encolhe — o trabalho começa mais tarde e a virada aperta |
| Pintura colorida do fundo infinito | **Fornecedor externo**, cerca de 5h. Depende de disponibilidade de terceiro **e da tinta ter chegado** |

**Consequências para a arquitetura:**

1. Hoje `dailyTasks` (rotina) e `reservations` (agenda) não se conhecem. Na v2 a rotina de zeladoria precisa ser **gerada a partir do calendário**, não mantida em paralelo.
2. A pintura colorida cria uma **dependência de fornecedor** no ato da reserva — precisa de agendamento e confirmação de terceiro, algo que hoje não existe em lugar nenhum do sistema.
3. **Lacuna encontrada no código:** `reservations.paintingCost` guarda o que se **cobra** do cliente (mão de obra), mas não existe campo para o que se **paga** ao fornecedor que executa. A margem da pintura é invisível hoje. O Tino Rental já resolve esse padrão com `totalSupplierCostCents` — o mesmo tratamento serve aqui, e alimenta o Domínio 7.

## 1.6 Regra comercial da pintura de fundo infinito

| | Branco | Colorido |
|---|---|---|
| Tinta | Custo **absorvido**, embutido na diária | **Cliente compra e entrega** no estúdio |
| Mão de obra | Equipe interna, dentro da rotina | **Cobrada** do cliente (`paintingCost`) |
| Execução | Equipe do estúdio | **Fornecedor externo**, ~5h |
| Prazo de entrega da tinta | — | **48h** antes do shooting · **24h** em regime de urgência |

**O que o sistema não sabe hoje:** que existe uma entrega do cliente com prazo. `paintingColors` guarda as cores escolhidas, mas nada acompanha se a tinta chegou. Se ela não chega, a pintura não acontece e o shooting é comprometido — e ninguém é avisado.

**Precisa existir na v2:**

- Prazo calculado a partir da data do shooting (48h padrão / 24h urgência)
- Estado da tinta: `aguardando` → `recebida` → `conferida`
- Alerta ao se aproximar do prazo sem recebimento — para o admin e para o cliente
- Registro de quem recebeu e conferiu no estúdio (vira tarefa da rotina — Domínio 2)
- Vínculo com o agendamento do fornecedor: sem tinta, não adianta ter pintor

**Respostas do Tino:**

- **Urgência não tem preço diferente.** O "regime de urgência" é um nome duro, usado como pressão para o cliente não atrasar a entrega. Comercialmente é idêntico. → Modelar como **prazo com nível de severidade**, não como produto ou tarifa.
- **Tinta fora do prazo = problema do cliente.** O estúdio cancela com o fornecedor de pintura, não cobra nada, e o cliente se vira no dia. → O estado precisa de um desfecho `cancelada por não entrega`, sem cobrança, e o cancelamento do fornecedor vira ação disparada pelo sistema.
- **Tinta que sobra normalmente fica no estúdio.**

**Fornecedores recorrentes identificados até aqui:** pintor (contratado pontualmente) e faxineira. Levantamento completo fica para o Domínio 7 (Financeiro).

- [ ] Detalhar as demais variáveis no Domínio 2
- [ ] Definir se o fornecedor de pintura entra como cadastro (à la `rentalSuppliers`) com agenda própria

## 1.7 Estado do Domínio 1

Mapeado e revisado com o Tino. Pendências que atravessam para outros domínios:

- Geração da rotina de zeladoria a partir da agenda → Domínio 2
- Levantamento de fornecedores e despesas → Domínio 7
- Provedores de cobrança e NFS-e → pesquisa dedicada, antes de fechar D2

---

# Domínio 2 — Rotina da equipe

**Tabelas:** `employees`, `taskTemplates`, `dailyTasks`, `timeRecords`, `daysOff`, `dailyPlans`, `weeklyReports`, `calendarEvents`
**Telas:** `MorningShift.tsx`, `AfternoonShift.tsx`, `Home.tsx`
**Motor:** `aiAgent.ts`, disparado por cron em `scheduledJobs.ts` (`0 3 * * *` UTC = 00:00 BRT)

## 2.1 O que já existe e é mais sofisticado do que parece

O modelo de tarefas é rico e já codifica boa parte das regras que o Tino descreveu verbalmente:

- `taskTemplates.shootingMode` — vale em dia de shooting, dia livre, ou ambos
- `taskTemplates.requiresStudioFree` — só agenda com estúdio vago
- `taskTemplates.frequencyDays` — diária, 2 dias, semanal, quinzenal, mensal
- `taskTemplates.requiresDependency` + `dependencyDescription` — depende de tarefa do outro turno
- `taskTemplates.estimatedMinutes`, `priority`, `dayOfWeek`, `blockType`
- `dailyPlans.dayType` — `shooting` ou `free`, com aprovação de sócio
- O agente calcula `isShootingTomorrow` **explicitamente para decidir a pintura**

A regra "se amanhã tem shooting, pinta hoje" já está no código.

## 2.2 Problemas encontrados

| # | Problema | Onde | Gravidade |
|---|----------|------|-----------|
| 1 | O gerador lê o Google Calendar, nunca a tabela `reservations` | `aiAgent.ts:55` | Alta |
| 2 | Um único funcionário por turno (`limit(1)`); sem o da manhã, o dia inteiro não gera | `db.ts:149` | Alta |
| 3 | Folga não redistribui — tarefas somem, ninguém assume | `aiAgent.ts:121,140` | Alta |
| 4 | Carry-over desligado com arrays vazios fixos; campos e prompt continuam no código | `aiAgent.ts:67-69` | Alta |
| 5 | Fim de semana sem shooting não gera nada | `aiAgent.ts:100` | Média |
| 6 | `MorningShift` e `AfternoonShift` ~85% duplicados | frontend | Média |
| 7 | Ponto (`timeRecords`) não conversa com folga, hora extra, nem financeiro | `schema.ts` | Média |
| 8 | Virada noturna não é registrável como tal | inexistente | Média |

**Detalhe do item 1 — duas fontes de verdade.** O agente faz `fetchCalendarEvents()` e deriva `isShooting` dos eventos do Google. Existe até uma variável chamada `hasReservationTomorrow`, calculada a partir de eventos de calendário, não de reservas — o nome mente. Como `reservations.calendarEventCreated` existe justamente porque a criação do evento pode falhar, uma reserva que não virou evento produz um dia "livre" para a rotina: sem tarefa de pintura, e o cliente chega ao ciclorama da cor anterior.

**Detalhe do item 4 — tarefa não feita evapora.**

```ts
// 5. Pendências do dia anterior — usadas APENAS como warning, NÃO como carry-over
const morningPending: never[] = [];
const afternoonPending: never[] = [];
```

Arrays vazios fixos. `dailyTasks.isCarryOver`, `originalDate` e o `yesterdayPendingWarning` do `dailyPlans` continuam no schema e no prompt da IA, mas nada os popula por esse caminho. Como o cron roda à meia-noite, o dia anterior sai do horizonte sem deixar rastro.

## 2.3 A descoberta que muda o desenho

**Pergunta feita ao Tino:** a conciliação das tarefas (a virada, quem faz o quê) acontece dentro do sistema?
**Resposta:** *"a gente combina por fora."*

Isso reposiciona todo o domínio. Existe uma máquina de planejamento sofisticada — geração por IA, modos de shooting, frequências, dependências — mas **a decisão real é tomada por conversa**, e o sistema recebe o resultado como checklist.

Consequências a encarar:

- Se o plano gerado não bate com o combinado, o funcionário marca uma lista que não descreve o que ele fez. O dado de execução vira ficção — e os `weeklyReports` gerados por IA em cima dele herdam a ficção.
- Boa parte da complexidade do `aiAgent.ts` pode estar sendo contornada diariamente sem que ninguém perceba.
- Antes de investir na v2, é preciso saber **se a lista gerada é seguida de fato**.

## 2.4 A bifurcação da v2

Duas direções possíveis, e elas levam a produtos diferentes:

**(A) Sistema como quadro de execução.** Assume que o plano é humano. O sistema mostra o que está previsto e o que está vencido por frequência, registra o que foi feito, e para de fingir que planeja. Aposenta o gerador por IA. Muito mais simples, muito mais honesto com a operação real.

**(B) Sistema como planejador de verdade.** Investe para ele ser confiável: lê `reservations` em vez do Calendar, conhece as regras de virada, redistribui na folga, cobre múltiplos funcionários por turno, propaga pendência. Aí a conversa por fora vira exceção, não regra.

## 2.5 Decisão final — Caminho B, com aprovação

**Revisão de 25/07 (Guimel + Luis):** a escolha inicial pelo caminho A foi revista. **Adotado o caminho B — sistema como planejador de verdade.**

**O caminho para o B passa pelo A.** Nada do que foi decidido em 2.5.1 abaixo se perde: um planejador que lê a fonte errada, perde tarefa pendente e não trata folga não é planejador — é gerador de erro em escala. Tudo aquilo continua sendo pré-requisito. O B acrescenta a camada de decisão: o sistema resolve quem faz o quê, calcula a virada e redistribui na folga.

### O risco do B, e o antídoto que já existe no código

Se o sistema errar com alguma frequência, a equipe volta a combinar por WhatsApp e a construção se perde. É assim que planejador automático morre.

A tabela `dailyPlans` já tem dois campos que ninguém usa:

```
approvedBy   — ID do usuário que aprovou
approvedAt   — quando aprovou
```

**Modelo adotado: o sistema propõe, o sócio confirma.** O plano do dia seguinte é montado pelas regras; os sócios revisam, ajustam se preciso, e aprovam antes de virar tarefa na mão do funcionário.

Vantagens:

- Entrega o valor do B sem a aposta do B
- A aprovação vira dado: se em três meses ninguém ajustou nada, afrouxa-se a etapa; se ajustam sempre, o sistema está errando e sabe-se onde

### O que se mantém do A

**Geração determinística, sem LLM.** As regras são expressáveis — 3h se amanhã tem shooting, pintura colorida aciona fornecedor, tinta tem prazo. Regra escrita erra de forma previsível e corrigível; modelo improvisando erra diferente a cada segunda-feira.

### ✅ Decisão final (25/07): **sem aprovação prévia** — o B roda direto

O plano gerado vai direto para o funcionário, sem etapa de confirmação do sócio.

**O que substitui a rede de proteção:** como as regras vão errar em algum dia atípico, o antídoto passa a ser a **facilidade de corrigir**. Requisitos que isso cria:

- Os sócios ajustam o dia em poucos toques, sem burocracia
- **Todo ajuste manual fica registrado** — sem isso não se descobre que a regra está errada, apenas que "o sistema é meio doido"
- O volume de ajustes vira métrica: muitos ajustes no mesmo tipo de dia significam regra a corrigir

- [ ] Relatório de ajustes manuais por tipo de dia

## 2.5.1 Decisão anterior — Caminho A *(substituída, mantida como registro)*

**Confirmado pelo Tino:** a lista gerada **é o guia do funcionário** — ele trabalha por ela. Isso agrava os problemas 1, 3 e 4 da tabela 2.2: ele confia numa lista que mente em três situações previsíveis (reserva sem evento no Calendar, tarefa não concluída, folga).

**Direção escolhida:** o sistema **não decide**; consertam-se as fundações para que ele pare de mentir. A decisão do excepcional continua com os sócios.

Precisão importante: "não decidir" não significa montagem manual da lista. A parte **mecânica** continua automática — os `taskTemplates` já codificam frequência, modo de shooting, dependência e necessidade de estúdio vago. Isso é regra, não decisão.

**O que sai:** a camada de LLM que improvisa o plano. Hoje o `aiAgent.ts` envia os templates ao modelo e recebe um plano de volta, o que torna a mesma segunda-feira capaz de gerar listas diferentes sem explicação. Substituir por geração determinística a partir dos templates torna a lista previsível, auditável e barata de manter.

**Escopo acordado do Domínio 2 na v2:**

- [x] Geração determinística a partir dos templates, sem LLM no caminho
- [x] Fonte única de verdade: ler `reservations`, não o cache `calendarEvents`
- [x] Pendência não evapora — tarefa não concluída reaparece e vira aviso ao sócio
- [x] Folga redistribui, ou no mínimo sinaliza que o turno ficou descoberto
- [x] Suporte a mais de um funcionário por turno
- [x] Decisão do excepcional (virada, quem fica as 3h, cobertura) permanece humana, com o sistema registrando o combinado
- [ ] Definir como o combinado por fora entra no sistema — tarefa avulsa? ajuste na lista do dia?
- [ ] Rever o `weeklyReports` gerado por IA: ele descreve execução; com a base corrigida, decidir se continua e em que formato

## 2.6 Respostas do Tino aos itens 2 e 5

### Item 2 — quadro de pessoas mudou

**Situação real:** hoje há **um único funcionário**, o Michael. O Sandro foi demitido. A demanda do turno dele é coberta pelos sócios (Guimel ou Luis), que recebem um extra por isso, ou repassada a um parceiro terceirizado.

**⚠️ Risco imediato, não é item de v2.** O gerador exige um funcionário ativo em **cada** turno:

```ts
if (!morningEmployee || !afternoonEmployee) {
  console.error("[AI Agent] Funcionários não encontrados");
  return [];
}
```

Se o Sandro foi desativado, `getEmployeeByShift("afternoon")` volta vazio e o gerador retorna lista vazia **para os dois turnos** — o Michael para de receber tarefas junto. Verificar se a lista dele ainda aparece. Se aparece, o Sandro segue marcado como ativo e o cadastro está mentindo.

**Sócios não existem como executores.** `employees` e `users` são tabelas separadas e o gerador só distribui para `employees`. O trabalho que os sócios assumem não é registrado, e o extra pago por ele também não.

### Cadastro pedido para a v2 — quatro naturezas distintas

| Natureza | Exemplo | Características |
|----------|---------|-----------------|
| **Funcionário** | Michael | Turno fixo, rotina diária, ponto, folga |
| **Sócio executor** | Guimel, Luis | Assume turno sob demanda, recebe extra — precisa aparecer como destinatário de tarefa e como custo |
| **Parceiro pontual** | Pintor, terceiro que cobre a tarde | Chamado sob demanda, custo por acionamento |
| **Fornecedor recorrente** | Limpeza, ar condicionado, dedetização | Periodicidade própria, gera lembrete e despesa recorrente |

**Observação de arquitetura:** os fornecedores recorrentes são **manutenção periódica**, e o motor para isso já existe — `taskTemplates.frequencyDays` já trata mensal, quinzenal e semanal. Nunca foi apontado para fornecedor externo, só para funcionário interno. Na v2, "está na hora de chamar o dedetizador" é o mesmo mecanismo de "está na hora de lavar as janelas".

**✅ Decisão (25/07): cadastro único de fornecedores, fora da aba Tino Rental.** O `rentalSuppliers` de hoje vive dentro do Rental porque só existia fornecedor de equipamento — e de fato **só o Ronaldo é fornecedor de equipamento**. Pintor, faxineira, ar condicionado e dedetização entram no mesmo cadastro, em seção própria.

Fornecedor passa a ter **login** (ver Matriz de permissões), enxergando apenas o que é dele — turno na escala, no caso dos de serviço; pedidos de equipamento, no caso do Ronaldo.

### Item 5 — fim de semana

**Situação real:** variável e dirigida pela agenda. Ou se adianta o preparo na sexta, ou se abre um turno no sábado para deixar pronto para segunda, quando há shooting na segunda.

**A regra atual está invertida.** O código pergunta "tem shooting **hoje**, no sábado?" e, se não, não gera nada. A pergunta certa é "tem shooting na **próxima abertura**?" — é isso que decide entre adiantar na sexta ou abrir turno no sábado. É a mesma lógica de virada do Domínio 1, olhando para frente em vez de para trás.

- [ ] Definir a janela de antecedência: o sistema olha só o próximo dia útil ou os próximos N dias?

## 2.7 Itens 6, 7 e 8 — a mudança estrutural

**Item 6 — telas de turno duplicadas:** ajustar. **Item 7 — ponto sem ciclo fechado:** ajustar.

**Item 8 — resposta do Tino:** cada funcionário tem **8h de jornada**. O Michael entra às **06:00** e sai às **14:00**. A cobertura do restante acontece por hora extra dele, ou pelos sócios assumindo o turno.

**Consequência para a virada:** as reservas começam tipicamente às 07:00, então a janela de preparo matinal é de **1 hora** — o Michael chega uma hora antes do cliente. Isso torna a virada da noite anterior ainda mais crítica: o que não ficou pronto à noite tem 60 minutos para acontecer. E existem reservas que começam **06:30** (ex.: `T_29042026A`), quando a janela some por completo e o cliente chega junto com o funcionário.

- [ ] O sistema deve alertar ao criar reserva que começa antes das 07:00?

### O modelo atual está errado, não só duplicado

Hoje `employees.shift` é atributo fixo **da pessoa** (o Michael *é* manhã), e existem duas telas, uma por turno, porque se assumia duas pessoas fixas. A realidade é outra: **o turno da tarde não tem dono** — é preenchido por hora extra do Michael, por um sócio, ou por um parceiro, conforme o dia.

**Confirmação do Tino (25/07):** *"Tem dia que o Michael entra de manhã e tem dia que ele entra de tarde, às vezes eles trocam."* O turno **não é atributo da pessoa** — nunca foi. `employees.shift` como enum fixo não descreve a operação em dia nenhum.

**⚠️ Além disso, os horários exibidos são texto fixo no código, não dado.** Não existe jornada em lugar nenhum do banco:

| Arquivo | Linha | Texto chumbado |
|---|---|---|
| `Home.tsx` | 150 | `06:00 — 08:00` |
| `Home.tsx` | 187 | `14:00 — 22:00` |
| `MorningShift.tsx` | 24–29 | `06:00 — 07:00`, `07:00 — 08:00`, `07:45 — 08:00` |
| `AfternoonShift.tsx` | 25, 30 | `14:00 — 15:00`, `21:00 — 22:00` |

Alguém digitou esses horários numa época, a operação mudou, e o texto ficou. Corrigir hoje exige mexer no código e publicar. É o mesmo padrão do diagnóstico geral: o dado deveria existir e não existe, então virou string.

**Modelo proposto — escala.** Um turno passa a ser uma *vaga* com data, horário e jornada esperada, ocupada por alguém: funcionário, sócio ou parceiro. Consequências:

- **Item 6 resolvido na raiz:** uma tela só, que mostra a escala de quem está logado. As duas telas de hoje codificam uma premissa que deixou de valer. O turno de sábado e o sócio cobrindo a tarde passam a caber sem código novo.
- **Item 7 resolvido:** `timeRecords` hoje registra entrada, saída e total, mas não tem contra o que comparar — não existe jornada esperada em lugar nenhum do schema. Com a jornada na escala, o cálculo de hora extra sai por diferença e vira despesa no Domínio 7.
- **Item 8 resolvido:** a virada noturna vira um turno extra na escala, com responsável e custo, ligado à reserva que a causou.

### O sócio executor é transitório — e o sistema deve medir isso

> *"Eu e meu sócio estarmos fazendo funções extras é provisório. Nossa meta é bombar o estúdio e ter dinheiro para ter o novo Sandro."*

O modelo de escala já comporta os dois cenários sem alteração: a vaga é preenchida por funcionário, sócio ou parceiro. Quando a contratação acontecer, muda apenas quem ocupa o slot.

**Requisito derivado:** o sistema deve responder *quanto custa hoje cobrir o turno vago* — a soma do extra pago aos sócios mais o custo do parceiro acionado. Esse valor já é orçamento de salário sendo gasto, hoje espalhado e invisível.

Com a escala registrando ocupante e custo por turno, a pergunta "quando dá para contratar?" deixa de ser sensação e vira conta: custo mensal atual da cobertura × custo de um funcionário fixo × ocupação necessária para fechar a diferença.

**✅ Feito (29/07): custo de cobertura de turno.** A escala é Fase 4, então não existe registro de quem cobriu qual turno — mas cobertura **é despesa**. Cada lançamento pode ser marcado com `cobreTurno` (hora extra do Michael, extra ao sócio, acionamento do parceiro), e a soma responde quanto de orçamento de salário já está sendo gasto espalhado.

A base de comparação — salário + encargos de um segundo funcionário — é **cadastro em `painel_config`**, não número no código: o valor muda com dissídio e mudança de regime. Zero significa "não informado", e aí o relatório mostra o custo **sem veredito**, em vez de comparar contra zero e concluir que contratar é sempre mais caro.

O veredito só afirma acima de 10% de diferença, e a tela declara o que a conta não mede: contratar acrescenta **capacidade** além de cobrir, e cobertura mais barata em dinheiro pode ser mais cara em tempo de sócio.
- [ ] Relatório: ocupação por estúdio (hoje inexistente — ver 1.8)

## 2.8 Estado do Domínio 2

Mapeado e revisado. Decisões tomadas: caminho A (sistema não decide, fundações corrigidas), geração determinística, escala no lugar de turno fixo, cadastro de pessoas com quatro naturezas.

Atravessa para outros domínios:

- Cadastro unificado ou separado de fornecedores → Domínio 3
- Hora extra, extra de sócio e custo de parceiro como despesa → Domínio 7
- Manutenção periódica (dedetização, ar condicionado) reusando `frequencyDays` → Domínio 3 ou 7

---

---

# Domínio 3 — Tino Rental (e Consumíveis)

**Tabelas:** `rentalItems`, `rentalItemGroups`, `rentalSuppliers`, `rentalOrders`, `rentalOrderItems`, `rentalInventory` (morta), mais `kitchenKitItems`, `kitchenKitRequests`, `paperColors`, `paperColorRequests`
**Router:** `server/routers/rental.ts` · **Tela:** `TinoRentalTab.tsx`

## 3.0 Contexto de negócio

O Tino Rental é uma linha de receita nova dentro do estúdio, com nome próprio. Lógica: sobre uma diária de R$ 3.000, cada R$ 500 de extras (arara, cadeira, etc.) é margem relevante. Exige logística de entrega e conferência item a item no fim do dia.

> *"Muitas coisas somem, perdi a conta de quantas vezes comprei cabide, prato, talher, copo."* — Tino

## 3.1 O que está bem feito

**Grupos abstraem o fornecedor.** O portal mostra "Arara" com disponibilidade somada; internamente são 2 do Tino e 2 do Ronaldo, com alocação priorizando o próprio. O cliente não precisa saber a origem.

**Snapshot nos itens do pedido.** `itemName`, `unit`, `penaltyPerUnitCents` e `costPerUnitCents` são copiados no momento do pedido — reajuste de preço hoje não reescreve o histórico de ontem. Prática correta e rara.

**Fluxo físico completo.** Entrega de manhã com assinatura do cliente, devolução conferida à tarde, registro de quem entregou e quem conferiu, `qtyMissing` calculado, multa por unidade e condição de devolução.

**É o único domínio com despesa modelada** (`costPerUnitCents`, `totalSupplierCostCents`) — padrão a ser reaproveitado no Domínio 7.

## 3.2 ⚠️ A descoberta central: a máquina está apontada para os itens errados

Os itens que somem — prato, talher, copo — **não estão no Tino Rental**. Estão no kit cozinha, que não tem controle algum.

| | Tino Rental | Kit cozinha |
|---|---|---|
| Estoque | `totalQty` numérico, disponibilidade calculada | `quantity` é **texto livre** ("12", "1 pacote", "250g") |
| Entrega | Registrada, com assinatura | Não existe |
| Conferência na volta | Item a item, com responsável | **Não existe** |
| Faltante | `qtyMissing` calculado | Não existe |
| Multa | Por unidade, com snapshot | Não existe |
| Preço | Por item | **R$ 200 fixo pelo kit inteiro** |

Pior: `kitchenKitRequests` tem apenas `reservationCode`, `priceInCents` e `createdAt`. **Não registra quais itens saíram.** Não é que a conferência falhe — não há contra o que conferir. O mesmo vale para `paperColorRequests`.

Conclusão: foi construída uma boa máquina de controle de perda e apontada para araras e pranchões — caros e difíceis de sumir. Os itens que somem de verdade, por serem pequenos, baratos e numerosos, ficaram de fora.

### ✅ Encaminhamento decidido (25/07) — medir, não cobrar

**Decisão do Tino: a perda do kit cozinha será apenas medida, não cobrada do cliente.**

**Consequência que muda o desenho:** sem cobrança, não é preciso saber *qual cliente* perdeu o copo. E a atribuição é justamente a parte cara — contar doze copos, talheres e pratos depois de cada shooting, todo dia, é a tarefa que se pula quando o dia aperta. Controle que se pula não mede nada.

**Dois regimes de controle, portanto:**

| Itens | Regime | Por quê |
|---|---|---|
| Araras, pranchões, equipamento do Rental | **Conferência por pedido**, com multa | Valor unitário justifica o trabalho de atribuir |
| Kit cozinha, cores de papel | **Inventário periódico**, sem multa | Sem cobrança, atribuição não serve para nada — e a contagem periódica custa uma fração |

O inventário periódico vira lançamento de perda no financeiro (Domínio 7) e alimenta a resposta da pergunta dos R$ 200: em dois ou três meses, comparando perda medida contra o arrecadado em kits, sabe-se se o preço cobre a reposição. Deixa de ser palpite.

**✅ Intervalo do inventário: semanal.**

## 3.3 Os sete pontos e as decisões

| # | Problema | Decisão |
|---|----------|---------|
| 1 | Reserva multi-dia não respeitada no estoque | **Arrumar** — ver 3.4 |
| 2 | Custo de fornecedor não multiplica por dias | **Arrumar** |
| 3 | `rentalInventory` é tabela morta; `reservationExtras` sobrevive em paralelo (migração inacabada, dois catálogos) | **Arrumar** |
| 4 | `getQtyCommitted` carrega o histórico inteiro do item, filtra em JS | **Arrumar** |
| 5 | Mesma lógica de disponibilidade escrita três vezes | **Arrumar** |
| 6 | Item danificado continua contando como disponível | **Arrumar** — dois destinos: baixa ou conserto com retorno ao estoque |
| 7 | `reservationDate` como `varchar` | **Arrumar** — é pré-requisito do item 1 |

**Detalhe do item 2:** o schema comenta "custo de repasse ao fornecedor por unidade/**dia**", mas o cálculo é `costPerUnit * qtyDelivered`, sem dias. Locação de três dias paga o parceiro como se fosse um — e essa é a única despesa que chega ao financeiro.

**Detalhe do item 7:** a data é guardada como texto. O banco não sabe que é um dia, aceita `"2026-4-5"` e `"13/04/2026"` na mesma coluna, e a única comparação confiável é igualdade exata. É por isso que o código só consegue perguntar "é o mesmo dia?" em vez de "está dentro do período?" — resolver o 7 é condição para resolver o 1.

## 3.4 Os extras chegam em ondas

> *"Não é de uma só vez que os extras entram, eles muitas vezes entram de forma gradual, até o dia da diária."*

O produtor recebe o portal, faz um primeiro pedido do que lhe vem à cabeça, no dia seguinte pede mais, depois pede a pintura de fundo infinito.

**Consequência:** disponibilidade precisa ser verificada **a cada adição**, não apenas no fechamento — entre uma onda e outra, outra reserva pode ter comprometido o estoque.

A estrutura aguenta metade disso: `extraRequests` é uma linha por pedido, então as ondas já ficam registradas. O que falta é a consolidação — hoje o funcionário monta **um** pedido de rental antes da entrega, sem nada ligando as ondas do cliente a esse pedido. É releitura manual.

**Modelo proposto:** as ondas empilham num pedido único que cresce; cada adição valida contra o **período inteiro** da reserva; no dia da entrega o funcionário confere uma lista só, que é a mesma lista da conferência de volta.

**Prazos de corte definidos:**

| Item | Prazo |
|---|---|
| Tinta colorida (entrega do cliente) | 48h — 24h em "regime de urgência" |
| Demais extras | **24h** antes da diária |

- [ ] Alerta na hora do pedido quando a origem do item for de terceiro: com 24h de antecedência sobra pouco tempo para acionar o parceiro se o estoque próprio acabou. Avisar, não bloquear.

**Acerto com fornecedores parceiros:** o Ronaldo é pago **mensalmente, em dia variável**.

Como `totalSupplierCostCents` já é registrado por pedido, o fechamento mensal pode ser gerado automaticamente — "Ronaldo, julho: R$ X, referente a estes 7 pedidos" — restando ao sócio confirmar o pagamento. Depende do item 2 (multiplicação por dias) estar corrigido, senão o valor sai subestimado.

→ Entra na agenda de obrigações do Domínio 7 como obrigação recorrente mensal de **data variável e valor calculado**, um quarto tipo além dos três já mapeados em 7.4.

---

# Domínio 5 — WhatsApp IA

**Tabelas:** `whatsappAiConfig`, `whatsappConversations`, `whatsappContacts`
**Arquivos:** `whatsappWebhook.ts`, `whatsappTools.ts`, `whatsappClient.ts`, `routers/whatsappAi.ts` · **Tela:** `WhatsAppAI.tsx`

## 5.1 O que está bem feito

**`lookup_reservation` é a melhor peça de segurança do sistema.** Só devolve os dados se o telefone de quem pergunta bater com o telefone da reserva. O portal web entrega os mesmos dados a qualquer um que digite o código na URL — a IA do WhatsApp é mais rigorosa que o site. Reforça a decisão do token separado tomada em 1.4.

**O handoff tem a guarda certa.** A instrução proíbe explicitamente a IA de confirmar reserva sozinha: coleta o que consegue e passa para humano. Numa IA que fala com cliente sobre dinheiro, essa é a linha que não pode ser cruzada.

**`check_availability` é a única consulta real de disponibilidade do sistema** (ver 2.2 item 1).

## 5.2 Os seis problemas

| # | Problema | Gravidade |
|---|----------|-----------|
| 1 | Dois agentes coexistem e já divergiram (`whatsappWebhook.ts` vs `routers/whatsappAi.ts`); só o primeiro ignora mensagem de grupo | Alta |
| 2 | `knowledgeBase` é texto digitado à mão, embora os dados existam estruturados em `studios`, `rentalItemGroups`, `paperColors` | Alta |
| 3 | `metaAccessToken` e `metaVerifyToken` em texto plano no banco | Alta |
| 4 | `aiPaused` não tem retomada automática — cada handoff aposenta a IA naquele contato para sempre | Alta |
| 5 | Só mensagem de texto; não envia imagem nem PDF (plantas do estúdio existem no S3) | Média |
| 6 | `whatsappConversations` cresce sem arquivamento | Baixa |

**Item 2 é o mesmo padrão do Domínio 2 e do 7:** o dado existe estruturado e quem precisa dele lê de uma cópia manual. Reajuste de preço no cadastro não chega à IA, e nenhum erro aparece.

## 5.3 Especificação v2 — agente multi-público

> *"Quero a melhor prática possível... preciso que seja impecável, e sempre que houver necessidade de um humano devemos ser avisados. Ele deve se comunicar com cliente, fornecedor, sócio, funcionário."*

### 5.3.1 Resolução de identidade — a base de tudo

Hoje `whatsappContacts` guarda apenas `remoteJid` e `contactName`. Para atender múltiplos públicos, **o número precisa resolver para um papel antes de qualquer resposta**, e as ferramentas disponíveis mudam por papel.

| Papel | Origem da identidade | Pode | Não pode |
|---|---|---|---|
| **Cliente / produtor** | `reservations.clientPhone`, `clients.phone` | Disponibilidade, dados da própria reserva, pedir extras, links dos portais | Ver outras reservas, ver custo de fornecedor, ver financeiro |
| **Fornecedor** | `rentalSuppliers` (precisa de campo de telefone estruturado) | Receber acionamento, confirmar ou recusar, consultar os próprios pedidos | Qualquer dado de cliente |
| **Funcionário** | `employees.phone` | Ver a própria escala e tarefas, marcar conclusão, registrar ponto | Dado financeiro, dado de cliente além do necessário à operação |
| **Sócio** | `users` com `role = admin` | Tudo, incluindo avisos de handoff e financeiros | — |
| **Desconhecido** | — | Informação pública e triagem | Qualquer dado privado — vai para handoff |

**Regra de ouro:** número não reconhecido nunca recebe dado privado. É o mesmo princípio que o `lookup_reservation` já aplica hoje — generalizado.

### 5.3.2 Handoff — três gatilhos, não um

Prática atual recomendada: o handoff é o maior determinante de satisfação em atendimento com IA, e é onde a maioria dos agentes perde valor — cliente que precisa repetir tudo após a transferência reporta satisfação muito menor.

Hoje existe **um** gatilho, e ele depende da própria IA decidir chamá-lo. Devem existir três:

1. **Pedido explícito** — o cliente pede um humano. Imediato, sem negociação.
2. **Confiança baixa** — a resposta cai abaixo de um limiar de certeza.
3. **Sentimento negativo por dois turnos seguidos** — cliente irritado não deve ser insistido por robô.

Mais os que o caso de negócio exige: intenção de fechar reserva, qualquer conversa sobre valor, reclamação, e pedido fora do escopo.

**O aviso ao humano deve carregar contexto, não só o alerta.** Quem assume precisa receber o histórico da conversa, a identidade resolvida, o motivo do handoff e o que a IA já coletou. Template já submetido à Meta pelo Tino.

- [ ] **Corrigir o problema 4 junto:** definir retomada da IA — por resolução manual, por tempo, ou por nova conversa iniciada pelo contato.

### 5.3.3 Guardrails — o que a IA nunca faz

- Nunca confirma reserva (já existe — manter)
- Nunca negocia preço nem concede desconto
- Nunca confirma pagamento como recebido
- Nunca emite ou promete nota fiscal
- Nunca revela dado de um contato a outro
- Nunca cancela nada
- Nunca promete disponibilidade sem consultar `check_availability`

### 5.3.4 Escopo em ondas

Recomendação corrente: começar com três a cinco intenções de alto volume e baixo risco, roteando todo o resto para humano. Agentes que tentam cobrir tudo no lançamento falham de forma visível e são desligados em torno de 90 dias.

| Onda | Público | Intenções |
|---|---|---|
| 1 | Cliente | Disponibilidade · dados da própria reserva · links dos portais |
| 2 | Fornecedor | Acionamento com confirmação ou recusa |
| 3 | Funcionário | Escala do dia · marcar tarefa concluída |
| 4 | Sócio | Consultas financeiras e operacionais |

### 5.3.5 Base de conhecimento viva

Substituir o texto digitado à mão por leitura direta das tabelas: ficha técnica de `studios`, preços de `rentalItemGroups` e `paperColors`, regras de `studioRules`. O texto livre permanece apenas para o que não é estruturado — tom de voz, política comercial, FAQ.

### 5.3.6 Inventário de templates da Meta

Cada tipo de mensagem iniciada pelo estúdio exige template próprio, aprovado previamente. Submeter todos de uma vez.

| Template | Destinatário | Gatilho |
|---|---|---|
| Aviso de handoff | Sócio | IA escalou *(já submetido)* |
| Confirmação de reserva + portais | Cliente | Reserva confirmada |
| Acionamento de fornecedor | Fornecedor | Pedido inclui item de terceiro |
| Lembrete de tinta | Cliente | Prazo de 48h/24h se aproximando |
| Cobrança de PO | Cliente | PO pendente há N dias |
| Cobrança de pagamento | Cliente | Passou da previsão |
| Escala / tarefa do dia | Funcionário | Início do turno |
| Fechamento mensal do parceiro | Fornecedor | Virada do mês |

### 5.3.7 Restrições da plataforma a respeitar

- **Janela de 24h:** mensagem livre só dentro de 24h da última mensagem do contato. Fora disso, apenas template aprovado.
- **Quality rating por template:** template de baixa qualidade tem entrega e ritmo de envio reduzidos pela Meta. Mensagem irrelevante ou frequente demais degrada a nota — o que reforça a ressalva de 7.A sobre não avisar demais.
- **Opt-out:** rejeições comuns na aprovação incluem conteúdo ambíguo e ausência de variável de saída.
- **Escala gradual de cota.**

- [ ] Confirmar as regras vigentes da Meta no momento da implementação — mudam com frequência.

---

# Domínio 8 — Painéis internos

Duas telas: a **Home** (`Home.tsx`) e a **Visão Geral** do admin (`AdminPanel.tsx`).

## 8.1 Home — é a tela dos sócios, não do funcionário

`Home.tsx` redireciona automaticamente quem tem turno definido para a tela do próprio turno. Só admin ou usuário sem turno chega a ver essa tela. Ou seja: é um **menu de navegação para as duas pessoas que menos precisam de menu**.

Problemas:

- **Não responde nada.** Às 13:50 de um sábado, mostra três portas iguais. Não diz se há shooting hoje, se o turno da manhã foi concluído, se ficou tarefa atrasada, se há tinta pendente ou PO em aberto.
- **O relógio ocupa um card inteiro** para informar a hora — a informação mais fácil de obter e a de maior destaque na tela.
- **Hierarquia plana:** "Painel Admin" tem o mesmo peso visual que um turno, sendo de outra natureza.
- **A foto ocupa um terço da tela**, escura demais para comunicar, com artefato de corte na borda esquerda.
- **Só dois turnos possíveis** — premissa já derrubada em 2.7.
- **Horários chumbados no código** (ver 2.7).

**Encaminhamento:** a Home dos sócios **é** o painel de vigilância pedido em 7.4. Não é uma tela a mais — é a mesma.

## 8.2 Visão Geral — o diagnóstico

As informações são válidas. O problema é hierarquia e acionabilidade.

### A informação mais importante está no rodapé

> *"Média mensal caiu 39% em 2026 vs 2025 (8.4 vs 13.8 diárias/mês)"*

Considerando que a meta declarada é maximizar ocupação, essa é a frase mais importante do negócio. Está em texto pequeno, com emoji, abaixo de um gráfico, no fim da página — enquanto **"Reservas Hoje: 1"** ocupa um card grande no topo. A hierarquia está invertida: o fácil de ver está grande, o que exige atenção está pequeno.

### ⚠️ E esse número provavelmente está errado

2026 exibe 76 diárias e média de **8.4/mês**. 76 ÷ 9 = 8,44 — está dividindo por **nove meses**, e a fonte declara `2024-01 a 2026-09`.

Em 25/07/2026, agosto e setembro mal começaram a ser vendidos. O realizado está sendo dividido por um período que inclui dois meses futuros quase vazios, e comparado com 2025 dividido por doze meses completos.

**A queda de 39% está superestimada.** A comparação correta é período contra período — janeiro a julho de 2026 contra janeiro a julho de 2025.

- [ ] Recalcular com os dados reais para saber a queda verdadeira

### Sobre a fonte Google Calendar

**Não é erro.** O sistema não existe desde a fundação do estúdio; o calendário é o único registro do histórico anterior. Legítimo.

**Mas exige decisão:** a partir da entrada do sistema, a fonte deve ser a tabela de reservas. O gráfico precisa **emendar as duas** — calendário até a data de virada, sistema depois. Caso contrário haverá dois números para o mesmo mês, ou dependência eterna de alguém alimentar o calendário à mão.

- [ ] Definir a data de virada entre as fontes

### Demais problemas

| Problema | Observação |
|---|---|
| **Um terço da tela é navegação** | Oito cards de "Acesso Rápido", com a barra de menu logo acima levando aos mesmos lugares |
| **Cards redundantes** | "Reservas no Mês: 9" e "Confirmadas: 9" — mesmo número, dois cards |
| **"Receita Estimada"** | Faturamento previsto, não caixa. Com pagamento de 30 a 120 dias, não diz nada sobre dinheiro disponível |
| **Meta desconectada** | 15 locações por estúdio × 4 estúdios = 60 diárias/mês, contra histórico de ~14/mês. Barra que vive em 13% ensina a ignorar barras |
| **Meta incompleta** | Mostra só Estúdio A e E; o gráfico ao lado tem movimento em B e C |
| **Lembrete estático** | "Lembre-se de produzir conteúdo das reservas!" não tem dado por trás — vira invisível em duas semanas |
| **Nada é acionável** | A página inteira é retrovisor. Não há pendência, atraso, nem cobrança a fazer |

## 8.3 Proposta de reorganização

**Princípio:** ação primeiro, operação depois, placar em seguida, histórico por último. Navegação sai do corpo da página — já está no menu.

### Bloco 1 — Precisa de você

O painel de vigilância de 7.4. **Só aparece o que exige ação.** Nada previsto para hoje significa bloco vazio com "tudo em dia" — e isso é informação boa, visível.

- PO pendente há N dias
- Tinta colorida não entregue, com prazo se aproximando
- Conta a pagar vencendo ou vencida
- Tarefa de ontem não concluída
- Fornecedor acionado sem resposta
- Pagamento atrasado
- Reserva sem nota emitida

Ordenado por urgência. Cada item leva direto à ação, não a uma tela de listagem.

### Bloco 2 — Hoje e amanhã

- Agenda de hoje: horário, cliente, **estúdio**, status
- Amanhã, com destaque quando exigir virada (limpeza + pintura)
- Quem está de turno hoje, segundo a escala

O estúdio precisa aparecer — é a informação que falta hoje no calendário e a única defesa contra reserva duplicada enquanto a checagem de conflito não existir.

### Bloco 3 — O mês (o placar)

- **Ocupação por estúdio** — dias vendidos sobre dias disponíveis. Métrica que hoje não existe em lugar nenhum e que é o placar direto da meta de rentabilizar o espaço
- **Receita em três números:** prevista · recebida · atrasada. Substitui "Receita Estimada"
- **Comparativo com o mesmo período do ano anterior** — período contra período

### Bloco 4 — Tendência

O comparativo anual, com a média corrigida e as fontes emendadas. Fica por último: é contexto, não ação.

### O que sai da tela

- Os oito cards de Acesso Rápido (vão para o menu)
- O relógio
- Os cards redundantes
- O lembrete estático de conteúdo

---

# Domínio 6 — Portais e site público

**Telas:** `LandingPage.tsx` (476 linhas) · `MonteSeuTino.tsx` (907) · `StudioPublicPage.tsx` (637) · `ReservationPortal.tsx` · `ProducerPortal.tsx`

## 6.1 A estrutura do complexo

Mais de 500m², com entrada em duas ruas (Rua Camilo, 789 e Rua Marco Aurélio, 268). Os estúdios se somam.

| Estúdio | Papel | Depende de |
|---|---|---|
| **A** | Principal | — |
| **E** | Principal | — |
| **B** | Complementar | A |
| **C** | Complementar | A **e** E |

> *"É difícil explicar para um outsider que só quer um estúdio, mas ao mesmo tempo é isso que encanta todo mundo — essa flexibilidade de ir somando, e o valor não ser de outro estúdio cheio."* — Tino

**⚠️ Inconsistência de dados:** o registro do Estúdio E tem `parentStudioCodes: "C"` com `isComplementary: false` (`routers.ts:1631`). Está invertido — é o C que é complementar ao E. Hoje não quebra nada, porque o filtro do configurador só considera `isComplementary: true`, mas é dado sujo.

- [ ] Corrigir `parentStudioCodes` do E

## 6.2 O problema central: complementar apresentado como produto

> *"As pessoas muitas vezes não entendem que não se pode locar o B e o C sozinhos."*

**Diagnóstico:** não é falha de explicação, é a vitrine. Uma página de "todos os estúdios" mostrando A, B, C e E como quatro cards equivalentes **é uma promessa de que se pode comprar qualquer um dos quatro**. As pessoas entendem exatamente o que o layout diz. Nenhum texto explicativo resolve, porque texto compete com estrutura visual — e estrutura sempre vence.

### Quatro mudanças, em ordem de impacto

**1. O nome é a causa raiz.** "Estúdio B" promete que é um estúdio. Se nunca é vendido sozinho, o próprio nome cria a expectativa que a equipe passa o dia desfazendo. *Anexo*, *Expansão* ou *Área* resolvem mais que qualquer parágrafo explicativo.

**2. Complementar sai da listagem.** A vitrine mostra o que se pode locar: A e E. Expansão não fica na prateleira ao lado do produto.

**3. Complementares aparecem dentro do principal.** Na página do A: *"300m². Com o Anexo B, vira 450m²."* Com foto do conjunto, não do espaço isolado.

**4. Vender combinações, não peças.** A unidade de apresentação passa a ser o resultado da soma:

> A · A+B · A+C · A+B+C · E · E+C

Sete opções, cada uma com metragem, foto e descrição. O visitante escolhe um resultado pronto em vez de montar um quebra-cabeça cujas regras desconhece. O Monte seu Tino deixa de ser onde ele *aprende* a regra e passa a ser onde ele *refina* uma escolha já compreendida.

**Consequência técnica:** o C é compartilhado entre A e E. Locado com o A, fica indisponível para o E. Nada no sistema trata isso hoje — é o buraco de checagem de conflito do Domínio 1 com uma camada extra de dependência.

## 6.3 Monte seu Tino

Fluxo atual em 3 passos: **1)** escolher a entrada → **2)** selecionar estúdios daquela entrada (principal + complementares) → **3)** resumo com datas e dados, gerando uma mensagem de WhatsApp.

### ⚠️ O configurador descarta tudo que descobre

O passo 3 monta uma URL `wa.me` com o texto do pedido e redireciona. **Nada é gravado no banco.**

Consequência — hoje não se sabe:

- quantas pessoas montaram uma combinação e **não** enviaram
- qual combinação é a mais pedida
- por qual entrada as pessoas entram mais
- a taxa de conversão de quem chega ao passo 3

Uma ferramenta de configuração é uma fonte de dados de demanda — diz o que o mercado quer do espaço antes de alguém perguntar. A atual descarta isso a cada visita, e um titubeio no último clique apaga o interesse sem deixar rastro.

- [ ] Gravar cada montagem, mesmo incompleta

### Não verifica disponibilidade

A data é escolhida no passo 3 sem nenhuma checagem. A consulta já existe e funciona — é a ferramenta `check_availability` usada pela IA do WhatsApp. O configurador poderia mostrar a data livre na hora.

### O argumento comercial está invisível

O que encanta, segundo o Tino, é somar espaço sem pagar como se fosse outro estúdio cheio. O configurador não mostra preço nem indica que o complementar tem valor diferente. A pessoa monta e sai sem ver a vantagem que faz o modelo funcionar.

**✅ Decisão (25/07): preço só no WhatsApp**, a partir da montagem que a pessoa fez. Nada de valor no site.

Passa a ser decisão consciente, não omissão. Consequência: o funil do Domínio 9 mede até o clique para o WhatsApp; dali em diante a conversão depende do atendimento — e é por isso que a montagem precisa chegar junto na conversa (ver 6.6).

### A entrada como primeiro passo

Decisão deliberada, tomada depois de tentativas anteriores — a entrada é o que torna a lógica de combinação inteligível.

**Risco:** pede-se uma decisão antes de dar a informação para decidi-la. Quem chega querendo "um estúdio" pensa em tamanho, ciclorama e luz natural, não em rua.

**Alternativa a considerar:** um passo zero com a planta do complexo inteiro, as duas entradas marcadas e os estúdios visíveis. A pessoa entende a geografia primeiro; escolher a entrada vira decisão informada.

### Entradas chumbadas no código

`"camilo"` e `"marco aurelio"` estão fixas em `MonteSeuTino.tsx` — mesma questão dos estúdios no enum (Domínio 1, item 3).

## 6.4 Páginas de estúdio

**Ativo forte:** a ficha técnica é o melhor conteúdo do site — área, ciclorama, pé-direito, amperagem, voltagem, tipo de tomada e conexão, cozinha, plantas, banheiros. Produtor não precisa ligar para perguntar.

**Problema de hierarquia:** "todas as informações são importantes" é justamente a questão. Com tudo no mesmo peso, o visitante precisa ler tudo para achar o que veio ver.

- [ ] Levantar qual pergunta mais chega no WhatsApp **depois** de a pessoa ter visto a página — é o que a página não está respondendo

### 🐛 Foto duplicada no navegador de fotos

`StudioPublicPage.tsx:153`:

```ts
const allPhotos = [
  ...(studio.heroImageUrl ? [studio.heroImageUrl] : []),
  ...(studio.gallery ?? []).map(g => g.imageUrl).filter(Boolean),
];
```

A capa é concatenada com a galeria inteira. Quando a capa também está cadastrada na galeria — o caso normal — ela aparece duas vezes. Ocorre também na listagem de estúdios. Correção: remover repetidas por URL.

## 6.7 Portal da Reserva e Portal do Produtor

`ReservationPortal.tsx` (1.154 linhas) · `ProducerPortal.tsx` (1.368 linhas)

### O que funciona

**O mapa de arredores é um diferencial real.** As categorias não são genéricas — ao lado de mercado, padaria e farmácia existem **elétrica** e **tinta**. Alguém pensou no que uma produção precisa às onze da manhã quando queima um cabo ou acaba a tinta.

- [ ] **Oportunidade:** hoje o mapa só aparece *depois* do fechamento, dentro do portal da reserva. É argumento de venda visível apenas para quem já comprou. Levar para a página pública de estúdio — "o entorno resolve" pesa para quem nunca produziu na região

**O fluxo de comanda é completo** (ver 1.1) e os "botões de chamada de serviço" no topo do Portal do Produtor são a ação rápida bem posicionada.

### Rolagem infinita nos dois

| Portal | Seções empilhadas | Navegação interna |
|---|---|---|
| Reserva | 15 | Nenhuma |
| Produtor | 14 | Nenhuma |

O Portal da Reserva empilha: como chegar · abas de estúdio · avisos outdoor e híbrido · descrição · banner de complementar · números · infraestrutura · cozinha · elétrica · galeria · plantas · mapa de arredores com filtros · regras.

**O uso real é pontual.** Ninguém lê o portal inteiro — chega-se com uma pergunta específica ("como eu chego?", "qual a tomada?", "cadê a planta?"). Em quinze seções, no celular, isso é rolar até achar. O conteúdo é excelente e o acesso a ele é ruim.

- [ ] Índice, navegação por seção ou busca

### 🔴 Portal do Produtor: o total aparece depois dos gastos

Ordem atual das seções:

> extras → kit cozinha → cores de papel → pintura → **resumo financeiro** → fechar comanda

O produtor toma **todas** as decisões de gasto antes de ver quanto somam — e está gastando dinheiro do cliente dele. Não existe nenhum elemento fixo na tela (`sticky` não aparece em lugar nenhum do arquivo).

**Encaminhamento:** resumo persistente, sempre visível, atualizando a cada pedido. É a diferença entre o produtor se assustar no fechamento e decidir com consciência.

### 🔴 "Fechar Comanda" dispara sem confirmação

```ts
onClick={() => closeComanda.mutate({ code })}
```

Um clique fecha a comanda, gera o PDF e grava `commandaClosed` com a data. **Irreversível**, no fim de uma página de 1.368 linhas, sem perguntar nada.

### 🔴 Aqui o código adivinhável deixa de ser questão de privacidade

No Portal da Reserva, adivinhar o código expõe dados — passivo.

No Portal do Produtor, adivinhar o código permite **gastar dinheiro**: pedir extras, cores e pintura, alterar check-in e check-out (o que muda a hora extra cobrada) e **fechar a comanda de uma reserva alheia**.

**Isso reposiciona a prioridade do token de acesso (1.4): não é melhoria de segurança, é risco financeiro direto.**

### Confirmações do que já foi mapeado

- As seções "Extras já solicitados" e "Cores já solicitadas" mostram as **ondas de pedido** na tela como histórico, sem consolidação — exatamente o diagnóstico de 3.4
- Os dois portais duplicam `formatDate`, `getDayOfWeek`, `getProductionLabel` e `parseStudios` verbatim; o comentário no próprio arquivo admite que o layout é idêntico (já no HANDOFF)

## 6.5 Quatro homes por segmento, e SEO

### Contexto: o site ainda não foi divulgado

Não houve campanha. Consequência prática: **não existe dado de comportamento** para embasar decisões de layout, e não há como responder "o que as pessoas mais perguntam depois de ver a página".

**⚠️ Isso inverte uma prioridade.** Divulgar quatro homes num site que não mede nada — o configurador não grava montagens (6.3), não há relatório de conversão (8.2) — significa gastar em campanha e terminar com a mesma dúvida do começo: qual segmento vale perseguir. **Instrumentar é pré-requisito da divulgação, não melhoria posterior.**

- [ ] Gravar montagens do configurador **antes** da campanha
- [ ] Marcar origem do visitante por segmento

### Os quatro segmentos (confirmados)

Moda e publicidade *(atual)* · Eventos · Workshops · Gastronômico

### Uma base de dados, quatro lentes

A ficha técnica já atende os quatro segmentos — o que muda é o que importa em cada um. Todos os campos já existem no cadastro de `studios`:

| Segmento | O que sobe ao topo | Campos |
|---|---|---|
| Moda e publicidade | Ciclorama, pé-direito, energia, camarim | `cycloramaM2`, `ceilingHeightM`, `energyAmps`, `backdropType` |
| Eventos | Capacidade, banheiros, acessibilidade, as duas entradas | `diningSeats`, `bathroomsCount`, `hasPCDBathroom`, `areaM2` |
| Workshops | Mesas e lugares, tomadas, área, luz | `diningTables`, `diningSeats`, `outletType`, `isOutdoor` |
| Gastronômico | Cozinha completa, bancada, água | `hasStove`, `hasOven`, `hasFridge`, `hasMicrowave`, `hasCutlery` |

**Não são quatro sites — é um conjunto de dados com quatro lentes.** O segmento decide o que sobe ao topo, qual foto aparece, que linguagem se usa e qual prova social entra. A ficha é a mesma.

**Decisão de arquitetura:** o segmento deve ser **cadastro, não código**. Com quatro páginas feitas à mão, um quinto segmento vira desenvolvimento; com segmento cadastrado, vira conteúdo.

**Estrutura escolhida:** páginas separadas por segmento, cada uma com sua URL — é para onde a campanha daquele público aponta. Estúdios e configurador são compartilhados, adaptando linguagem.

### SEO — o que funciona e o que não funciona

> *"Queria ter um SEO forte no site, com palavras que mudam na home conforme a pesquisa da pessoa no Google."*

**Na busca orgânica isso é impossível.** O Google não repassa o termo de busca ao site desde a migração para HTTPS — é o *"not provided"*. Visita vinda de resultado natural chega sem nenhuma pista do que foi digitado.

**No tráfego pago funciona**, e tem nome: *dynamic keyword insertion*. O Google Ads passa o termo por parâmetro na URL e a página o lê para trocar o texto.

**Cuidado:** página que muda de assunto conforme o parâmetro, sem conteúdo real por trás, é tratada como página-porta pelo Google. Rende no curto prazo e cobra depois.

**Dois mecanismos, dois propósitos:**

| Canal | Mecanismo |
|---|---|
| **Orgânico** | Quatro páginas reais, cada uma disputando os termos do seu segmento com conteúdo de verdade |
| **Pago** | Troca dinâmica de palavras rodando *sobre* essas mesmas páginas, com texto padrão quando o parâmetro não vier |

**Ativo de SEO já existente e não aproveitado:** a ficha técnica. "Ciclorama de 54m²", "pé-direito de 10 metros", "60 amperes", "PTV + Camlock" — conteúdo específico, factual e único, que praticamente nenhum concorrente publica. É exatamente o tipo de busca longa que traz visitante pronto para fechar.

### Tráfego pago confirmado — requisitos que isso cria

Haverá campanha paga. Como a verba entra desde o começo, a instrumentação deixa de ser desejável e passa a ser condição de partida.

- [ ] **Atribuição por campanha:** cada montagem do configurador e cada contato gravado com origem (segmento, campanha, termo). Sem isso não há como saber qual segmento paga a própria campanha
- [ ] **Parâmetro de palavra-chave na URL**, com texto padrão de fallback para quando não vier
- [ ] **Conversão definida:** o que conta como resultado — montagem concluída? clique para o WhatsApp? reserva fechada? Precisa estar decidido antes de investir
- [ ] **Do clique à reserva:** hoje o rastro morre no `wa.me`. Para saber quanto custou cada reserva, a origem precisa sobreviver até a reserva confirmada no sistema
- [ ] Evitar página-porta: cada página de segmento precisa de conteúdo próprio real, não apenas a palavra trocada

## 6.6 Campanhas multicanal

Haverá campanha em **Google, Instagram e TikTok**.

**Google e redes são intenções opostas.** Quem busca no Google já procura estúdio — chega pronto, e o clique se avalia pela conversão. Instagram e TikTok são descoberta: a pessoa não procurava nada. Para um espaço de 500m² com ciclorama e pé-direito de 10 metros, é provavelmente o canal mais forte para encantar, mas o retorno é diferido.

**Consequência:** os canais não podem ser julgados pelo mesmo critério. Avaliar TikTok com a régua do Google leva a desligá-lo cedo demais.

### 🔴 O buraco de atribuição no `wa.me`

O Monte seu Tino termina redirecionando para `wa.me`. **Nesse pulo, toda a origem se perde** — não importa quantos parâmetros a campanha carregue. O resultado seria custo por clique de vários canais sem nenhuma forma de saber qual virou reserva.

**Correção proposta (barata, resolve de uma vez):**

1. Antes de redirecionar, **gravar a montagem** no banco com a origem — canal, campanha, termo, segmento
2. Gerar um **código curto** para a montagem
3. Incluir o código no texto da mensagem do WhatsApp
4. Quando a conversa virar reserva, o código costura reserva ↔ campanha

Efeito colateral útil: a IA do WhatsApp passa a reconhecer a origem do contato — ela já sabe buscar por código.

- [ ] A estratégia de canal em si (o que dizer, quanto investir, que formato) é conversa à parte, fora do planejamento de sistema

## 6.0 Demanda registrada antecipadamente: novos públicos

> *"Variações de home para públicos diferentes do estúdio: eventos, workshops, eventos gastronômicos, etc. — fora moda e publicidade que atualmente atendemos."* — Tino

Hoje o estúdio atende **moda e publicidade**. A v2 quer abrir para **eventos, workshops e eventos gastronômicos**, com variações de home por público.

### ✅ Decisão (Guimel + Luis, 25/07) — o modelo de locação **não** muda

**Eventos e workshops acontecem das 07:00 às 19:00, no horário do estúdio, e são tratados como shooting.**

**Não haverá evento noturno inicialmente — o estúdio não tem alvará para isso.** Restrição legal, não limitação de sistema.

**Consequência: o maior risco do plano saiu.** A diária de 12h continua válida, o modelo de reserva permanece intacto, e a Fase 1 fica destravada. Nada precisa ser revisitado nos Domínios 1 e 2 por conta dos públicos novos — a diferença entre segmentos passa a ser de **apresentação e linguagem**, não de modelo de dados.

O que permanece variando por segmento: que campos da ficha técnica sobem ao topo, que fotos aparecem, que linguagem se usa (ver 6.5).

- [ ] Reavaliar se e quando o alvará para evento noturno for obtido

---

# Domínio 9 — Resultados e campanhas (novo na v2)

Painel no admin que responde a pergunta de fundo do projeto: **como rentabilizar o espaço**. Depende inteiramente de a instrumentação de 6.3 e 6.6 existir.

## 9.1 O funil

```
visita → montagem iniciada → montagem concluída → clique no WhatsApp → conversa → reserva fechada
```

Cada degrau diagnostica uma coisa diferente:

| Queda entre | O que indica |
|---|---|
| Visita → montagem | A home não convenceu |
| Montagem → conclusão | O configurador confunde, ou falta preço |
| Conclusão → WhatsApp | Hesitação no último passo |
| WhatsApp → reserva | Atendimento ou indisponibilidade |

Hoje não se sabe em qual degrau a perda acontece.

**Cortes:** por **canal** (Google · Instagram · TikTok · orgânico · direto) e por **segmento** (moda e publicidade · eventos · workshops · gastronômico).

## 9.2 Os três números que só existem se gravarmos as montagens

**Combinações mais pedidas.** Se metade das montagens é A+B, isso é informação de produto — talvez A+B deva ser vendido como unidade, com nome próprio.

**Demanda reprimida.** O configurador captura a data desejada. Data pedida que já estava ocupada é venda que não pôde ser feita. Esse número responde a pergunta mais importante do negócio: **o gargalo é demanda ou é capacidade?**

- Muita gente pedindo datas ocupadas → o problema não é campanha, é espaço e operação
- Ninguém pedindo → é demanda mesmo, e a campanha é o caminho certo

**Estúdio mais pedido × mais locado.** A diferença mostra o que está sendo deixado na mesa.

## 9.3 Custo de mídia

Google, Meta e TikTok têm API, mas a v1 deve começar com **lançamento manual do gasto mensal por canal**. Pouco trabalho, entrega rápida, e já produz o custo por reserva. Integração depois, se justificar.

**Conexão com o Domínio 7:** verba de mídia é despesa — entra na agenda de obrigações como qualquer outra saída recorrente.

## 9.4 Pendências

- [ ] Definir o que conta como conversão: montagem concluída? clique no WhatsApp? reserva fechada?
- [ ] Definir se o painel é acessível só aos sócios (provável — entra na matriz de permissões)

---

# Domínio 7 — Financeiro (novo na v2)

Aba nova no admin, pedida pelo Tino. Substitui/absorve a Planilha Financeira do Google Sheets hoje conectada ao painel.

**Escopo declarado:**

- Valores a entrar (contas a receber)
- Valores que saíram (contas a pagar / despesas)
- O que já foi pago
- O que está pendente de pagamento
- Fluxo de caixa

**Insumo recebido:** `TINO - Fluxo de caixa 2026.xlsx` — 4 abas (Fluxo de Caixa, Receitas, Receitas Indiretas, Despesas). Análise em 7.2.

## 7.A O requisito que define o módulo

> *"As planilhas não estão completas e atualizadas, não estamos dando conta de fazer tudo sozinhos na mão."* — Tino

**Princípio de projeto, acima de qualquer decisão de modelagem:** o que depender de digitação diária não será mantido. A planilha não falhou por ser planilha — falhou por exigir alimentação manual constante de duas pessoas que tocam um estúdio. Uma tela mais bonita com a mesma exigência apodrece igual.

**Critério de sucesso do módulo:** quanto dele se mantém sozinho.

O que já é automático (está no banco, com valor e data): reservas, comandas, extras, cores de papel, kit cozinha, rental. Isso é o grosso da receita e hoje sai do sistema para virar linha de planilha movida à mão.

O que exige humano: confirmar entrada de dinheiro (a menos que se integre banco ou provedor de cobrança), lançar valor de conta variável quando chega, e despesas avulsas. O papel do lembrete é transformar cada uma dessas em uma confirmação de dez segundos no dia certo — não numa sessão de planilha no fim do mês que nunca acontece.

**Ressalva de desenho, a respeitar nas telas:** se o painel avisar demais, param de olhar. Um sistema que cobra trinta coisas por dia vira ruído e morre pelo mesmo motivo que a planilha.

## 7.0 O que o sistema já faz com dinheiro hoje

### A integração com o Google Sheets (`server/googleSheets.ts`)

Só existe **uma aba: "Receitas"**. Nenhuma despesa é escrita.

Estrutura da linha: `A` = Cliente · `B` = Código da reserva · `C` = Vencimento · `D`–`O` = Janeiro a Dezembro · linha `Total` no fim.

Quando a reserva é criada, o sistema insere a linha antes do `Total` e escreve o valor **na coluna do mês da data da reserva**. Quando a comanda fecha, `updateReservationInSheet()` reescreve a mesma célula com o valor final.

**Observação relevante:** a planilha lança pela **data do serviço**, ou seja, opera em regime de **competência** — não de caixa, que é o que o Tino disse precisar. A coluna `C` guarda o vencimento, mas nada registra quando o dinheiro efetivamente entrou.

### Limitações da planilha atual

1. **Só receita.** Sem despesas não existe fluxo de caixa — só faturamento.
2. **Competência, não caixa.** O valor cai no mês do shooting, não no mês do pagamento.
3. **Não registra pagamento.** Há "vencimento"; não há "pago em". O sistema não sabe o que entrou.
4. **Um valor por reserva por mês.** Reserva que atravessa meses, ou pagamento parcelado, não cabe na estrutura.
5. **Falha silenciosa.** Se o OAuth do Google cair, o append é pulado com um `console.warn` e retorna `false`. A reserva existe no sistema e **não existe na planilha**, sem aviso a ninguém.
6. **Acoplada ao layout.** A linha é localizada pelo código na coluna B e pela palavra "Total" na coluna A. Edição manual da planilha quebra a integração.

### Receita que o sistema conhece mas a planilha não discrimina

Tudo abaixo entra embutido no valor final quando a comanda fecha — sem separação de origem, o que impede saber quanto cada linha de negócio fatura:

| Origem | Campo |
|--------|-------|
| Diária do estúdio | `reservations.dailyRate` × dias, menos desconto |
| Hora extra do cliente | `reservations.overtimeCost` |
| Pintura (mão de obra) | `reservations.paintingCost` |
| Extras do portal | `extraRequests.totalInCents` |
| Cores de papel | `paperColorRequests` × `paperColors.priceInCents` |
| Kit cozinha | `kitchenKitRequests` × `kitchenKitItems.priceInCents` |
| Tino Rental | `rentalOrders`, `rentalOrderItems.priceInCents` |
| Multas de devolução | `rentalOrders.totalPenaltyCents` |

### Despesa: quase tudo é invisível

| Despesa | Existe no sistema? |
|---------|--------------------|
| Repasse a fornecedor de equipamento | **Sim** — `rentalOrders.totalSupplierCostCents` |
| Mão de obra do pintor | Não |
| Faxineira | Não |
| Ar condicionado, dedetização | Não |
| Hora extra do Michael | Não |
| Extra pago aos sócios pela cobertura de turno | Não |
| Parceiro que cobre o turno da tarde | Não |
| Custos fixos (aluguel, energia, água, internet) | Não |

Só uma única despesa está modelada em todo o sistema. Tudo o mais que sai vive fora dele.

## 7.2 A planilha atual — `TINO - Fluxo de caixa 2026.xlsx`

### Estrutura

**Aba `Fluxo de Caixa`** — matriz de 12 meses, consolidando tudo:

| Linha | Conteúdo | Origem |
|---|---|---|
| 2 | Saldo Anterior | `=` CONTA CORRENTE do mês anterior (linha 36) |
| 3 | Receitas Estúdio | `=Receitas!<mês>454` |
| 4 | Receitas Indiretas | `='Receitas Indiretas'!<mês>33` |
| 7 | **Receitas** | soma |
| 9–13 | Sandro, Michael (+3 vagas) | digitado |
| 14 | **Salários** | soma |
| 15 | Simples Nacional | `= Receitas Estúdio × 9,7%` |
| 16 | Parcelamento | digitado |
| 17 | **Impostos** | soma |
| 18–21 | Luz, Água, Vivo, Contador | digitado |
| 22 | Custos Gerais | `=Despesas!<mês>139` |
| 25 | **Despesas** operacionais | soma |
| 26–27 | Aluguel Camilo, Aluguel Casa Monstro | digitado |
| 29 | **Imóvel** | soma |
| 30–32 | Guimel, Luis, Anibal | digitado |
| 33 | **Distribuição** | soma |
| 34 | **Despesas totais** | `= 14+17+25+29+33` |
| 36 | **CONTA CORRENTE** | `= Receitas − Despesas` |

**Aba `Receitas`** — 453 linhas de job: `Job` · `SKU` (código da reserva) · `Vencimento` · 12 colunas de mês. É nela que a integração do app escreve.

**Aba `Receitas Indiretas`** — 31 linhas. Mistura naturezas diferentes: aporte de sócio (Guimel R$ 5.000 e R$ 12.538,26), seguro (Santander), empréstimo (Pronampe). **Aporte e empréstimo não são receita** — são financiamento. Somados como receita, distorcem a leitura de rentabilidade. O Simples Nacional felizmente incide só sobre a linha 3 (Receitas Estúdio), então o cálculo do imposto não é afetado.

**Aba `Despesas`** — 137 linhas de lançamento avulso, uma por gasto, com o mês na coluna correspondente. Descrições no padrão `"Eletropaulo 20/01"`, `"Pix Guimel 08/01"`, `"Jeffersom Ar condicionado"`.

### Despesas fixas identificadas (matéria-prima do cadastro de obrigações)

| Despesa | Valor observado | Natureza |
|---|---|---|
| Aluguel Camilo | R$ 14.000/mês | Fixa |
| Aluguel Casa Monstro | R$ 3.240,55/mês | Fixa |
| Salário Michael | R$ 3.000/mês | Fixa |
| Simples Nacional | 9,7% da receita | Condicional à receita |
| Luz (Eletropaulo) | variável, múltiplas contas | Variável |
| Água | variável | Variável |
| Vivo | ~R$ 170–350 | Semi-fixa |
| Contador | ~R$ 485–520 | Fixa |
| Seguros (Yelum, Santander) | R$ 271,56 / R$ 730,90 | Fixa |
| Pronampe | — | Empréstimo |
| Ar condicionado (Jeffersom) | R$ 1.100 | Sob demanda |
| Gás, mercado, materiais | avulso | Variável |

### Inconsistências encontradas nas fórmulas

Registradas para não serem herdadas pelo módulo novo. **Não são a causa raiz** — a planilha simplesmente não está atualizada dia a dia, por falta de mão de obra.

1. **`Receitas!454` soma até a linha 449, e há dados até a 453.** Quatro reservas fora do alcance, somando R$ 9.160 (`T_26072026A`, `T_25092026A`, `T_29072026A`, `T_08082026A`). Segundo o Tino, são diárias canceladas ou linhas que ele ainda precisa mover para o mês de recebimento correto — trabalho manual, não bug silencioso.
2. **`Despesas!139` começa em `B3`, mas há dado na linha 2** (R$ 566,71 em janeiro, nunca somado).
3. **Ranges de `Despesas!139` divergem por mês:** janeiro para na linha 64, fevereiro/março e setembro–dezembro na 109, abril–agosto na 137. Qualquer lançamento novo de janeiro depois da linha 64 desaparece do total.
4. **`Fluxo de Caixa!7` é inconsistente:** janeiro, fevereiro, março e dezembro somam `linha 3:6` (sem saldo anterior); abril a novembro somam `linha 2:6` (com saldo anterior). Meses diferentes calculam receita de formas diferentes.
5. **`Fluxo de Caixa!C29`** usa `SUM(C26+C27)` enquanto os demais meses usam `SUM(x26:x28)`.
6. **Cabeçalhos de mês são datas soltas com anos misturados** (2021, 2022, 2024, 2025, 2026) num arquivo de 2026.
7. **`Despesas!D138` (Pronampe) referencia `'Fluxo de Caixa'!D9`**, que é o salário do Sandro. Provável fórmula quebrada.

## 7.3 O ciclo do dinheiro — do shooting ao recebimento

> *"Desde quando o shooting entra até quando é pago, isso pode demorar até 90 dias em alguns casos."*

### A condição de pagamento pertence a quem paga, não à reserva

Hoje `clients` guarda nome, e-mails, telefone e CNPJ — nenhuma condição comercial. Por isso tudo é redigitado a cada reserva.

Os dois extremos relatados pelo Tino cabem em **dois parâmetros**:

| Caso | Prazo | Âncora |
|---|---|---|
| Cliente à vista com desconto | 0 dias | data do shooting |
| Coca-Cola | 120 dias | **emissão da nota** |

O prazo é trivial. A **âncora** é o que importa, porque define quem controla o relógio. No segundo caso a contagem só começa na emissão da nota, que só acontece depois da PO — que o cliente controla. Daí os "90 dias" virarem indeterminados: são o prazo *mais* o tempo que a PO demorou.

### Três partes numa reserva

Prática comum: o estúdio presta serviço a uma produtora, mas a nota é emitida direto ao cliente final para evitar bitributação. A v1 tateia isso com `contactName` e `clientName`, e o próprio comentário de `clients` diz *"nome da produtora / cliente"* — um campo para dois papéis.

| Papel | Quem é | Função |
|---|---|---|
| **Contratante** | A produtora | Com quem se negocia |
| **Tomador / pagador** | Pode ser o cliente final | Recebe a nota e paga — **é dele que vem a condição de pagamento** |
| **Contato** | O produtor, pessoa física | Quem está no set |

Como o pagador muda de job para job com a mesma produtora, ele é escolhido **na reserva**, puxando prazo e âncora do cadastro dele, com possibilidade de sobrescrever. Efeito colateral útil: gera o histórico de com quais clientes finais cada produtora trabalha.

### Esteira de estados

```
Reserva confirmada
  → Shooting realizado (valor fechado na comanda)
  → [se exige PO] Aguardando PO → PO recebida
  → Nota emitida            ← inicia a contagem do prazo
  → Aguardando pagamento    ← previsão = data da âncora + prazo
  → Recebido
```

Desvios: **cancelada** (sai do financeiro — hoje a integração escreve na planilha mesmo assim, ignorando `reservations.status`) e **atrasado** (passou da previsão).

**A previsão de recebimento é calculada, não digitada**, e se recalcula quando o evento-âncora acontece. No dia em que a nota da Coca-Cola é emitida, o valor migra sozinho para 120 dias depois — que é exatamente o "subir a linha pro mês certo" feito à mão hoje.

Pergunta que passa a ser consulta e hoje é investigação: **quanto está parado esperando PO?**

## 7.4 Agenda de obrigações — o coração do módulo

> *"Precisamos de algo que nos lembre sempre de tudo."*

O módulo não é um relatório, é **vigilância**. E o motor já existe no sistema: `taskTemplates.frequencyDays`, o mesmo que lembra de lavar as janelas toda semana. Conta de luz vencendo dia 20 é a mesma mecânica, com valor e com dinheiro do outro lado.

Três tipos de obrigação, cada um com um lembrete diferente:

| Tipo | Exemplos | Comportamento do lembrete |
|---|---|---|
| **Data e valor conhecidos** | Aluguéis, Vivo, contador, salário | Avisa e pede confirmação de pagamento |
| **Data conhecida, valor não** | Luz, água | "Chegou a conta? lança o valor" |
| **Condicional a evento** | Simples Nacional (9,7% ao fechar o mês), emissão de nota, **cobrança de PO** | Nasce de outra coisa ter — ou não ter — acontecido |

A terceira categoria é a mais valiosa: é onde se perde dinheiro por esquecimento. PO não cobrada não vira nota, que não vira o prazo, que não vira recebimento.

**Forma do módulo:** agenda única de obrigações, entradas e saídas no mesmo lugar, ordenada por data, mostrando o que precisa de ação hoje e o que está atrasado. Extrato e fluxo de caixa saem dela como consequência, não como objetivo.

**Decisões em aberto:**

**✅ Decisão (29/07): o lembrete vai para os dois, sempre.** Guimel e Luis veem toda conta no painel, sem dono por despesa. Ninguém pode alegar que não viu, e não há decisão de roteamento a tomar no cadastro.

**✅ Decisão (29/07): conta variável fica sem valor até chegar.** Luz e água aparecem como "chegou a conta? lança o valor", sem número estimado. A projeção do mês fica com um buraco do tamanho da luz — e isso é preferível a um número inventado que o sócio passa a tratar como real. Quando houver histórico no banco, a estimativa pode ser reavaliada.
**✅ Decisão (25/07): aporte de sócio e empréstimo ganham categoria própria**, separada de receita. Hoje estão somados em `Receitas Indiretas` como se fossem faturamento, o que distorce a leitura de rentabilidade. Na v2 são **financiamento**: entram no caixa, ficam fora do resultado.
- [ ] Discriminar receita por linha de negócio (locação · rental · extras · consumíveis) — hoje tudo vira um valor só

## 7.5 Conciliação bancária por extrato

**✅ Decisão (25/07):** a baixa de pagamento **não** virá de integração bancária nem de confirmação manual pura. Haverá uma função de **conciliação por upload de extrato** — planilha ou CSV — para casar receitas e despesas com o que efetivamente entrou e saiu da conta.

Resolve a pendência anterior de forma barata: dá o saldo real em caixa sem depender de API de banco.

### ⚠️ Ponto de atenção — o Mercado Pago não deposita o valor da cobrança

O adquirente repassa o **líquido**, já descontada a taxa, e frequentemente **agrupa várias vendas num repasse só**. A linha do extrato quase nunca vai bater com o valor da reserva, e um casamento simples por valor falha justamente nas receitas.

A conciliação precisa tratar duas naturezas distintas:

| Natureza | Comportamento | Exemplo |
|---|---|---|
| **Casamento exato** | Valor e data batem com o lançamento previsto | Aluguel, salário, conta de luz, contador |
| **Repasse de adquirente** | Um crédito agrupado e líquido, que precisa ser desmembrado em várias cobranças e na taxa | Mercado Pago |

A taxa desmembrada vira despesa própria — e passa a ser mensurável, coisa que hoje não existe.

**✅ Conta: Santander PJ.** Verificar o formato exato de exportação (OFX e CSV) na implementação.
- [ ] Definir a regra de casamento: automático por valor + data, com confirmação manual do que não bater
- [ ] Decidir se o extrato do Mercado Pago é importado à parte, para desmembrar os repasses

**Ligação com o Domínio 1:** a tabela `charges` proposta em D2 é a fonte natural das contas a receber. Toda cobrança emitida a partir de uma reserva já nasce como lançamento previsto no financeiro, e a baixa acontece quando o provedor de pagamento confirma. As saídas (despesas, repasse a fornecedor do Tino Rental) precisam de origem própria — o `rentalOrders.totalSupplierCostCents` já existe e é candidato.

**Decisões em aberto:**

- [x] **Regime: os dois.** Cada lançamento guarda duas datas — a do serviço (competência) e a do pagamento (caixa). O relatório alterna entre as duas visões em vez de o sistema escolher uma. Ver 7.1.
**✅ Decisão (29/07): categorias redesenhadas, em dois eixos.** A planilha agrupa por "Salários · Impostos · Despesas · Imóvel · Distribuição", o que mistura *o que é* com *como se comporta* — aluguel e salário se comportam igual e são coisas distintas; luz e ar-condicionado são ambos custo do imóvel e se comportam de formas opostas. Na v2 são dois campos: `categoria` (o que é, para ler o resultado) e `natureza` (como se comporta, define o lembrete).

Onze categorias de operação: Imóvel · Utilidades · Pessoas · Serviços · Manutenção · Operação · Fornecedor · Impostos · Seguros · Marketing · Financeiro.

Mais duas que **não entram no resultado**, e é aqui que a planilha erra: **Distribuição** (Guimel, Luis, Anibal) é lucro saindo, não custo de operar; **Financiamento** (aporte de sócio, Pronampe) é dinheiro entrando sem ser venda. Hoje aporte e empréstimo estão somados em `Receitas Indiretas` como faturamento — um mês ruim com aporte parece um mês bom. O caixa vê tudo; o resultado vê só operação.
- [ ] Conciliação bancária: manual, importação de OFX/extrato, ou via API do provedor de cobrança?
- [ ] Quem enxerga o financeiro? Presumivelmente só sócios — entra na matriz de permissões.

## 7.1 Caixa vs. competência

Duas formas de responder "quanto o estúdio faturou em abril?".

Exemplo: reserva de R$ 3.000 no dia 28/04, cliente paga em 15/05.

- **Regime de caixa** — conta quando o dinheiro entra. Abril: R$ 0. Maio: R$ 3.000.
- **Regime de competência** — conta quando o serviço acontece. Abril: R$ 3.000. Maio: R$ 0.

Nenhum dos dois é mais correto; servem a perguntas diferentes. Caixa responde "tenho dinheiro para pagar as contas deste mês?". Competência responde "abril foi um mês bom?".

**Encaminhamento:** não escolher. Cada lançamento guarda a **data do serviço** e a **data do pagamento**, e a tela do financeiro alterna entre as duas visões. Escolher um regime na modelagem jogaria fora informação que não se recupera depois.

---

---
