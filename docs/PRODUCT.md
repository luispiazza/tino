# PRODUCT.md — Tino Estúdio

<!-- impeccable:product-schema 1 -->

Contexto de produto. Lido antes de qualquer decisão de design.

> **Estado:** aprovado por Guimel e Luis em 25/07/2026.
> Ampliado em 29/07/2026 com o que a execução da v2 apurou — nada do que estava
> aprovado foi alterado; as seções novas são de contexto de operação, restrição
> técnica e evidência.

---

## Plataforma

web

---

## O que é

Complexo de estúdios de foto e vídeo em São Paulo. Mais de 500m², duas entradas (Rua Camilo, 789 e Rua Marco Aurélio, 268), quatro espaços que se combinam entre si.

O diferencial declarado: **a flexibilidade de somar espaços**, com o complementar custando menos que um segundo estúdio cheio.

O produto digital é um ecossistema, não um site: vitrine pública, portais para o cliente e para o produtor, e um sistema interno de gestão de reservas, rotina e financeiro.

---

## Públicos

### 1. Produtor / cliente

Quem contrata e quem está no set. Quatro segmentos:

| Segmento | Estado |
|---|---|
| Moda e publicidade | Atual |
| Eventos | A conquistar |
| Workshops | A conquistar |
| Gastronômico | A conquistar |

**Todos operam no mesmo horário — 07:00 às 19:00, tratados como shooting.** Não há evento noturno: o estúdio não tem alvará. A diferença entre segmentos é de linguagem e apresentação, não de modelo de locação.

**Como chega:** busca no Google, Instagram, TikTok, indicação.

**O que precisa saber, em ordem:** o espaço serve para o que eu quero fazer? cabe? quanto custa? está livre na minha data?

**Como usa:** no set, pelo celular, com pressa, no meio de uma produção. Consulta pontual — "qual a tomada?", "cadê a planta?", "como chego?" — nunca leitura completa.

**Modo:** a vitrine **persuade**; os portais **operam**.

### 2. Funcionário

Hoje uma pessoa: Michael. Entra às 06:00, sai às 14:00 — uma hora antes do cliente chegar. Turno varia; às vezes manhã, às vezes tarde.

**Como usa:** celular, cedo, muitas vezes com as mãos ocupadas ou sujas. Precisa saber o que fazer agora e marcar como feito. Nada além disso.

**Modo:** **opera**. O design serve à tarefa. Alvos de toque grandes, hierarquia óbvia, zero decoração.

### 3. Sócios

Guimel e Luis. Cobrem turnos quando falta gente.

**Contratar um segundo funcionário segue sendo a intenção, sem data** *(confirmado em 29/07)*. Enquanto não acontece, turno descoberto é condição normal, não exceção — e o sistema precisa tratá-la como tal. Ver *Contexto de operação*.

**O que precisam:** saber o que exige ação hoje, e ver o placar do negócio — ocupação, caixa, o que está atrasado.

**Modo:** **opera**. Painel, não menu.

### 4. Fornecedor

Ronaldo (equipamento), pintor, faxineira, ar condicionado, dedetização. Fala com o sistema por WhatsApp, não por tela.

---

## Contexto de operação

Fatos da operação que qualquer tela precisa respeitar. Apurados na execução da v2, contra o banco de produção.

### Os espaços

| Código | Endereço | Papel |
|---|---|---|
| A | Rua Camilo, 789 | **Principal** — vendido sozinho |
| B | Rua Camilo, 789 | Complementar de A |
| C | Rua Camilo, 789 | Complementar de A e de E |
| E *(Casa Monstro)* | Rua Marco Aurélio, 268 | **Principal** — vendido sozinho |

**Complementar não é produto.** B e C nunca são vendidos sozinhos: são incremento sobre um principal. Qualquer tela que os apresente em pé de igualdade com A e E está apresentando errado — inclusive gráfico de ocupação, que deve ter barra própria só para os principais.

### O que mais sai *(confirmado em 29/07)*

| Combinação | Área |
|---|---|
| **A + B** | 360m² |
| **A + B + C** | 444m² |
| **E + C** | 144m² |

**A e E sozinhos não estão nessa lista**, e isso é a informação. O diferencial declarado — "a flexibilidade de somar espaços" — não é um argumento de venda sobre o produto: é o produto. Vender um principal isolado é a exceção, não o padrão.

Consequência para a vitrine: a unidade de apresentação é a **combinação**, com área total e preço próprios. Uma vitrine que liste quatro estúdios e trate a soma como upsell inverte o que o negócio faz.

### O ciclo do dia

- **Janela de operação: 07:00 às 19:00.** Sem alvará para evento noturno.
- **Virada** é o intervalo entre um shooting e o seguinte: limpeza e repintura de branco, com **mínimo de 3 horas** após o fim do anterior. Só existe virada quando há shooting nos dois dias.
- **Turnos:** manhã e tarde. Michael é da manhã. A tarde está descoberta desde a saída do Sandro, e é coberta por hora extra, sócio ou parceiro conforme o dia.

### Pintura

Cliente que pede fundo colorido paga a pintura e o retorno ao branco: **cerca de R$ 1.500 no total, R$ 750 cada sentido**, variando com o caso. O pintor é normalmente **Jairo Fernandes**.

A demanda de pintura **aparece depois da reserva**, às vezes dias depois — por isso não pertence ao formulário de reserva.

### O ciclo do dinheiro

- Do shooting ao recebimento pode levar **até 90 ou 120 dias**.
- O prazo frequentemente **não corre a partir do shooting, e sim da emissão da nota** — que depende da PO, que o cliente controla. É por isso que "90 dias" viram indeterminados.
- Código de reserva: `T_DDMMYYYYX` (data + letra sequencial).
- **O financeiro vive hoje numa planilha** (`TINO - Fluxo de caixa 2026.xlsx`), fora do sistema.

### A reconstrução

O sistema **está no ar e atende clientes reais durante toda a v2**. Nada pode ser desligado para ser reescrito: mudança entra por expansão, com o antigo funcionando até o novo assumir.

---

## Capacidades e restrições

### Técnicas

- React + Vite · tRPC · Drizzle ORM · MySQL (Railway) · S3 · shadcn/ui (estilo *new-york*, 53 componentes instalados) · vitest.
- **Push na `main` faz deploy automático.** A migração precisa rodar em produção **antes** do código que depende dela: o Drizzle emite lista explícita de colunas, então código novo contra schema velho não degrada — quebra a query inteira.
- O `/admin` exige login.
- Integração de WhatsApp por template da Meta.

### Regras de negócio já modeladas

- **Cobrança** percorre `aguardando_po → po_recebido → emitida → paga → nf_emitida → conciliada`, com `cancelada` a partir de qualquer estado anterior à conciliação. Nota depois do pagamento e pagamento depois da nota são ambos válidos.
- **Âncora de prazo:** cada cobrança guarda `prazoDias` e `ancora` (`shooting` ou `emissao_nf`). Ancorada na nota, a previsão de recebimento é nula até a nota existir — e isso é informação, não lacuna.
- **Dois regimes, sempre.** Cada lançamento guarda a data do serviço (competência) e a data do pagamento (caixa). O sistema não escolhe um regime; a tela alterna.
- **Acesso aos portais:** o código da reserva identifica, o token opaco autentica. Reservas anteriores ao token seguem aceitas sem ele.
- **Régua do painel é cadastro, não código** — ajustar o que aparece no bloco de vigilância não exige deploy.

### Decididas em 29/07

- **A planilha não será migrada.** O financeiro do sistema começa do zero numa data de virada; a planilha vira arquivo histórico, consultado quando precisar. Migrar as 590 linhas traria junto as inconsistências de fórmula documentadas em `PLANEJAMENTO-V2.md` §7.2.
- **Lembrete de conta vai para os dois sócios**, sem dono por despesa.
- **Conta de valor variável fica sem valor** até a conta chegar. A projeção do mês fica com um buraco do tamanho da luz, e isso é preferível a um número inventado que passa a ser tratado como real.

### Em aberto — não presumir

- **Anibal** recebe uma linha na distribuição da planilha, mas **não é sócio**. A natureza desse pagamento não está definida. Não tratar como distribuição de lucro sem confirmar.
- Provedor de NFS-e.
- Saldo bancário na data de virada.
- Custo de reposição dos 6 itens duráveis do kit cozinha.

---

## Evidências disponíveis

O que existe de real, e o que **não** existe e não pode ser inventado.

| Existe | Onde |
|---|---|
| ~40 reservas reais | banco de produção |
| Preços de locação e de itens | `rental_items` — fonte da verdade |
| Histórico financeiro de 2026 | planilha: 453 linhas de receita, 137 de despesa |
| Fornecedores, inventário, kit cozinha | banco de produção |

**Não existe, e não deve ser fabricado:**

- **Nenhuma cobrança lançada.** A tabela é nova; os números do financeiro estarão vazios até alguém usar.
- **Nenhum depoimento, case ou logotipo de cliente.** A vitrine não tem prova social para exibir.
- **Custo de reposição do kit cozinha está zerado** — não é R$ 0, é *não informado*.
- **O cache `calendar_events` está vazio.** Qualquer gráfico histórico que dependa dele depende, na verdade, de uma chamada ao vivo da API do Google.
- **As tarefas não vêm sendo marcadas** porque o uso foi suspenso até o sistema novo ficar pronto. Baixa conclusão no período **não é sinal de produto**.
- **A pintura de fundo não vinha sendo registrada.** Existe uma única reserva com pintura na base, e isso **não** quer dizer que pintura seja rara — aconteceu bem mais do que isso. O registro começa em **29/07/2026**. Frequência, margem ou receita de pintura calculadas sobre datas anteriores medem a falta do registro, não o negócio.

> **Padrão que já enganou duas vezes:** coluna vazia não é evento ausente. Aconteceu com a conclusão de tarefas e com a pintura. Antes de ler um número baixo como sinal de negócio, confirmar se o registro existia.

---

## Voz

**Direta e técnica, sem locução de vendas.**

O ativo do Tino é a ficha técnica — ciclorama de 54m², pé-direito de 10 metros, 60 amperes, PTV + Camlock. Quem contrata estúdio entende esses números e decide por eles. A voz certa é a de quem sabe o que está falando e respeita quem está do outro lado.

- Número específico vale mais que adjetivo. "300m² com ciclorama de 54m²" bate "espaço amplo e versátil"
- Frase curta. Produtor lê no set, não na poltrona
- Sem exclamação, sem urgência fabricada, sem "incrível" e "perfeito"
- Português direto, sem jargão de agência

**Vocabulário da casa** — usar estes termos, não sinônimos: *shooting* (não "sessão"), *virada* (não "transição"), *complementar* (não "extra" nem "adicional"), *diária*, *comanda*, *PO*.

**Marca:** o logotipo usa Avenir e não é ligado na interface. Toda a interface é IBM Plex.

---

## Anti-referências

Coisas que o Tino **não** deve parecer:

- **Software de gestão genérico.** O tema atual do admin (roxo/rosa vibrante, cantos muito arredondados, bordas a 50% de opacidade) foi copiado de outro sistema e não tem relação com a marca. Sai na v2.
- **Site de coworking.** Fotos de pessoas sorrindo em reunião, "espaços que inspiram", linguagem de startup.
- **Interface que compete com a imagem.** O produto é foto e vídeo. Cor decorativa na tela é ruído contra o portfólio.
- **Vícios de interface gerada por IA:** bege de IA, serif itálica de display, card dentro de card, gradiente roxo, ícone em quadradinho colorido, rótulo em aba lateral, ponto pulsante.
- **Painel que avisa demais.** Trinta alertas por dia viram zero alertas olhados.

---

## Princípios de decisão

Herdados do planejamento da v2 e válidos para o design:

1. **O que exigir digitação diária não será mantido.** Duas pessoas tocam o estúdio. Toda tela deve reduzir entrada manual, não criar.
2. **Ação antes de retrovisor.** Painel mostra primeiro o que exige decisão hoje; histórico é contexto.
3. **Toda cor carrega informação.** Nenhuma cor decorativa — âmbar significa atenção, vermelho significa atrasado, verde significa em dia.
4. **Uma ação principal por tela.** O resto vai para o detalhe.
5. **Ação irreversível pede confirmação e não fica ao alcance do polegar.**
6. **Alerta que não muda não é alerta.** Avisar todos os dias sobre uma condição permanente — a tarde descoberta, por exemplo — treina a pessoa a ignorar o bloco inteiro, e junto com ele o que importa. Um item só aparece se existe algo a fazer hoje a respeito.

---

## Acessibilidade e uso real

Não há norma externa exigida; as restrições vêm da cena de uso.

- **Alvo de toque ≥ 44px** em ferramenta interna. Michael usa às 06:00, no celular, com as mãos ocupadas.
- **Só tema escuro.** Não há modo claro e não está previsto.
- **Cor nunca carrega significado sozinha** — sempre acompanhada de rótulo ou texto.
- Contraste mínimo 4,5:1 para corpo de texto, 3:1 para texto grande.
