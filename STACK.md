# Stack — Tino Estúdio v2

Decidido em 04/08/2026 (Luis). Projeto iniciado do zero; dos documentos da
v1 aproveita-se a estrutura de domínios e as decisões de produto
(`docs/PLANEJAMENTO-V2.md`, `docs/PRODUCT.md`), não o código.

## Decisões

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **Next.js (App Router), app único** | Três superfícies num só deploy: `(site)` com SSR — o SEO orgânico depende da ficha técnica no HTML —, `(portais)` por token e `admin` com login |
| Banco | **PostgreSQL (Railway)** | Tipos reais de data/hora e enums nativos — resolve na raiz o problema de data-como-texto da v1 |
| ORM | **Drizzle** | Migrações explícitas; migração roda antes do código que depende dela |
| API | **tRPC v11** | Type-safety ponta a ponta; a matriz de permissões vira middleware central (`socioProcedure`, `fornecedorProcedure`) |
| Validação | **Zod** | Preço, nome e unidade sempre resolvidos no servidor |
| UI | **Tailwind v4 + shadcn/ui, preset oficial** (estilo nova, base neutral, dark) | Tema pronto, sem design próprio. Só dois toques de marca: IBM Plex e o creme no `--primary`. Telas montadas com os blocks oficiais (`shadcn add dashboard-01`, `login-*`, sidebar, charts) |
| Criação de front | **Plugin `frontend-design` ativo, sempre** | Toda tela (admin, portais, vitrine) é criada em sessão com o plugin `frontend-design@claude-plugins-official` carregado — instalado em 04/08, escopo de usuário |
| Mobile | **Admin mobile-first + PWA; encapsulamento futuro via Capacitor** | O admin nasce instalável (manifest, standalone, tema escuro). O app de celular será um invólucro Capacitor apontando para a URL de produção — um código só, sem fork. Lembretes: Web Push agora; notificação nativa entra com o invólucro |
| CMS | **Nenhum — o banco é o CMS** | Ficha técnica, preços e segmentos são cadastro editado no admin. CMS externo criaria a segunda fonte de verdade que o planejamento condena |
| Arquivos | **S3** | PDFs de comanda, plantas, galeria |
| E-mail | **Resend** | Falha de envio vira log, nunca descarta o pedido |
| Cobrança | **PIX direto na conta, sem provedor** | Decidido em 04/08 (substitui Mercado Pago de 25/07 — adiado junto com cartão e link de pagamento). A conciliação por extrato identifica o recebimento; PIX sem identificação é associado manualmente. NFS-e segue em aberto |
| WhatsApp | **Meta Cloud API + agente (Claude)** | LLM só na borda do WhatsApp; geração de rotina é determinística, sem LLM |
| Testes | **Vitest** | Banco de teste isolado desde o dia 1 |
| Deploy | **Railway** | Push na `main` publica; migração antes do código |

## Princípios herdados (valem para código)

1. O que exigir digitação diária não será mantido.
2. Uma única regra de disponibilidade — todos consultam a mesma procedure.
3. Nunca duas fontes de verdade para o mesmo dado.
4. Código identifica, token opaco autentica (portais sem login).
5. Financeiro guarda sempre as duas datas: serviço (competência) e pagamento (caixa).
6. O sistema avisa e provisiona; nunca recusa venda (viabilidade de virada).

## Decisões de produto do alinhamento (04/08)

- **Front único, acesso por papel.** Não há telas por turno nem por pessoa: o
  admin é um só, e o papel do login decide quais áreas aparecem (funcionário:
  agenda do dia e consulta de rental; sócio: tudo). A restrição vive nos
  middlewares do tRPC, não em telas separadas.
- **Tarefa pertence ao estúdio, não à pessoa.** A lista do dia é uma timeline
  cronológica única — com duas pessoas cobrindo o turno, a lista é a mesma;
  quem faz se decide na hora, e a atribuição é registrada na conclusão
  (`feitaPorId`). A escala (vagas, jornada, custo de cobertura) continua
  existindo por baixo, para ponto e financeiro.
- **Fim de semana:** sem shooting no dia, as tarefas jogam para o próximo dia
  útil — o gerador não abre turno de fim de semana à toa.
- **Sem alerta** para reserva que começa antes das 07:00.
- **Relatório semanal:** overview determinístico (sem LLM), gerado das mesmas
  regras — tarefas feitas e arrastadas, ajustes do sócio, custo de cobertura.
- **Gerador de campanha:** URL `/c/slug` troca vídeo e textos do hero e as OG
  tags (SSR obrigatório — crawler não executa JS). Slug desconhecido ou
  campanha pausada caem no conteúdo padrão, nunca 404. A vitrine inteira vem
  abaixo do hero (anti página-porta). O slug é a origem primária do funil.
  Preview no admin mostra hero e cartão de link de cada campanha.

## Fluxo de desenvolvimento e deploy

- **`main` = produção.** Push na `main` publica no Railway automaticamente.
- **Migração antes do código, sempre** — a lição da v1 vira configuração:
  o *pre-deploy command* do serviço no Railway roda `npm run db:migrate`
  antes de subir a versão nova. Deploy só acontece se a migração passar.
- **Build/start:** `npm run build` · `npm start` (o Next respeita o `PORT`
  do Railway). Versão do Node fixada no `.nvmrc` (24).
- **Bancos separados por papel:** produção (plugin Postgres do Railway),
  desenvolvimento (segundo Postgres no Railway, apontado pelo `.env` local)
  e **teste isolado para o vitest** — teste nunca roda contra produção
  (Fase 0 da v1 existiu por causa disso).
- **Variáveis no serviço:** `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`;
  as demais do `.env.example` (S3, Resend, WhatsApp, Anthropic) entram
  quando cada integração chegar — nada precisa delas para o boot.

## Primeiros passos após instalar o Node

```bash
npm install
npx shadcn@latest init
cp .env.example .env   # preencher DATABASE_URL
npm run db:generate && npm run db:migrate
npm run criar-usuario -- "Seu Nome" voce@tinoestudio.com.br socio suasenha
npm run dev
```
