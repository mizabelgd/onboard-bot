ca# FAQ de Onboarding — Nexus Sistemas

Base de conhecimento para novos desenvolvedores da Nexus Sistemas. Atualizado em janeiro de 2025.

---

## Como solicitar acesso ao repositório Git?

Abra um chamado no Jira com o template **"Acesso — Repositório Git"** e informe seu usuário GitHub corporativo (ex: `jsilva-nexus`). O time de DevOps responde em até 1 dia útil. Você receberá um convite por e-mail para a organização `nexus-sistemas` no GitHub. Aceite o convite em até 48 horas ou ele expirará e um novo chamado será necessário.

## Como configurar o acesso SSH ao GitHub corporativo?

Gere uma chave SSH com o comando `ssh-keygen -t ed25519 -C "seu@email.nexus.com.br"`. Copie o conteúdo do arquivo `~/.ssh/id_ed25519.pub` e adicione em **GitHub → Settings → SSH and GPG keys → New SSH key**. Teste a conexão com `ssh -T git@github.com`. Se a resposta for `Hi usuario! You've successfully authenticated`, está tudo certo.

## Como clonar o repositório principal?

Após receber acesso, clone com SSH: `git clone git@github.com:nexus-sistemas/plataforma-core.git`. Evite usar HTTPS pois exige autenticação a cada operação. O repositório principal é o `plataforma-core`. Projetos satélite ficam em repositórios separados listados na página da organização.

## Qual é o fluxo de branches adotado pela equipe?

Usamos **GitHub Flow** simplificado. A branch principal é `main` (protegida — push direto bloqueado). Para qualquer alteração: crie uma branch a partir de `main` com o padrão `tipo/descricao-curta` (ex: `feat/login-oauth`, `fix/bug-pagamento`, `chore/atualiza-deps`). Abra um Pull Request para `main` quando terminar.

## Como abrir um Pull Request?

Empurre sua branch para o repositório remoto com `git push origin nome-da-branch`. No GitHub, clique em **"Compare & pull request"**. Preencha o título seguindo o padrão: `[TIPO] Descrição breve (#numero-jira)`. Adicione descrição, checklist de testes e screenshots se for mudança visual. Selecione ao menos 1 revisor obrigatório do seu time.

## Quem deve revisar meu Pull Request?

Cada time tem um canal de revisão no Slack (`#review-backend`, `#review-frontend`, `#review-dados`). Poste o link do PR no canal correspondente. Todo PR precisa de pelo menos **1 aprovação** antes de ser mergeado. PRs que tocam em infra ou banco de dados precisam de aprovação adicional do líder técnico.

## Quanto tempo tenho para responder uma revisão de PR?

O SLA interno é de **1 dia útil** para a primeira revisão. Se um PR ficar sem revisão por mais de 2 dias úteis, o autor pode mencionar o revisor no Slack ou escalar para o tech lead. Reviews solicitadas na sexta-feira podem ser respondidas na segunda sem penalidade.

## Como configurar o ambiente de desenvolvimento local?

Execute os seguintes passos após clonar o repositório:
1. Instale Node.js 20 LTS via `nvm install 20 && nvm use 20`
2. Instale as dependências: `npm install`
3. Copie as variáveis de ambiente: `cp .env.example .env.local`
4. Preencha as variáveis no `.env.local` (peça os valores ao seu tech lead)
5. Suba os serviços locais: `docker compose up -d`
6. Inicie o servidor: `npm run dev`

O servidor estará disponível em `http://localhost:3000`.

## Quais ferramentas preciso instalar na minha máquina?

Ferramentas obrigatórias:
- **Node.js 20 LTS** (via nvm)
- **Docker Desktop** 4.x ou superior
- **Git** 2.40+
- **VS Code** com as extensões recomendadas (listadas em `.vscode/extensions.json`)
- **DBeaver** ou **TablePlus** para acesso ao banco de dados

Ferramentas opcionais mas recomendadas: Insomnia ou Postman para testar APIs, k9s para Kubernetes local.

## Como instalar o nvm no macOS?

Execute no terminal: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash`. Reinicie o terminal e verifique com `nvm --version`. Em seguida, instale o Node: `nvm install 20`. Adicione `nvm use 20` ao seu `.zshrc` ou `.bashrc` para ativar automaticamente.

## Como instalar o nvm no Windows?

No Windows, use o **nvm-windows**: baixe o instalador em `github.com/coreybutler/nvm-windows/releases`. Instale como administrador. Após instalar, abra um novo terminal como administrador e execute `nvm install 20` e `nvm use 20`. Se usar WSL2, siga as instruções do macOS dentro do ambiente WSL.

## Como obter as variáveis de ambiente do projeto?

As variáveis de produção e staging ficam no **AWS Secrets Manager** (acesso restrito). Para desenvolvimento local, solicite ao seu tech lead um arquivo `.env.local` com valores de desenvolvimento. Nunca commite arquivos `.env` ou `.env.local` — ambos estão no `.gitignore`. Se precisar adicionar uma nova variável, documente-a no `.env.example` com um valor de placeholder.

## O servidor local não sobe. O que verificar?

Verifique na ordem:
1. O Docker está rodando? (`docker ps` deve listar os containers ativos)
2. As variáveis de ambiente estão configuradas? (arquivo `.env.local` existe e tem todos os campos)
3. A porta 3000 está livre? (`lsof -i :3000` no macOS/Linux)
4. As dependências estão instaladas? (rode `npm install`)
5. Há erros no log do Docker? (`docker compose logs -f`)

Se ainda não funcionar, abra uma thread no canal `#suporte-dev` no Slack.

## Como acessar o Jira?

Acesse `jira.nexus.com.br` com seu e-mail corporativo. No primeiro acesso, clique em "Esqueci minha senha" para configurá-la. Solicite ao seu tech lead para ser adicionado ao projeto correto. Os projetos seguem o padrão de siglas: `PLC` (Plataforma Core), `MOB` (Mobile), `INF` (Infraestrutura), `DAT` (Dados).

## Como criar uma task no Jira?

No projeto correto, clique em **"Criar"** no menu superior. Preencha:
- **Tipo**: Story, Bug, Task ou Sub-task
- **Resumo**: título claro e objetivo
- **Descrição**: contexto, critérios de aceitação e links relevantes
- **Sprint**: selecione o sprint atual se a task for para esta semana
- **Story Points**: estimativa em Fibonacci (1, 2, 3, 5, 8, 13)
- **Responsável**: atribua a si mesmo se for trabalhar na task

## Como acessar o Slack corporativo?

Baixe o Slack em `slack.com/downloads`. Faça login com seu e-mail corporativo em `nexus-sistemas.slack.com`. No primeiro acesso, o RH enviará um convite por e-mail. Canais obrigatórios para entrar: `#geral`, `#dev`, `#alertas-producao`, `#standup` e o canal do seu time (ex: `#time-plataforma`).

## Quais são os canais mais importantes do Slack?

- `#geral` — comunicados da empresa
- `#dev` — discussões técnicas gerais
- `#alertas-producao` — alertas automáticos de produção (não silenciar)
- `#standup` — updates diários assíncronos
- `#suporte-dev` — dúvidas de ambiente e ferramentas
- `#review-backend` e `#review-frontend` — solicitações de code review
- `#deploy` — registro de deploys

## Como é feito o standup diário?

O standup é **assíncrono**, realizado no canal `#standup` no Slack todo dia útil até as **10h**. O formato é:
- **Ontem**: o que fiz
- **Hoje**: o que vou fazer
- **Bloqueios**: o que está me impedindo (se houver)

Reuniões síncronas de standup acontecem às terças e quintas às 9h30 via Google Meet. Participação opcional para quem atualizou o Slack antes das 10h.

## Como acessar o ambiente de staging?

O ambiente de staging fica em `staging.nexus.com.br`. Use as credenciais de teste disponíveis no documento **"Credenciais de Teste"** no Confluence (não as de produção). O staging é atualizado automaticamente a cada merge na branch `main` pelo pipeline de CI/CD. Dados de staging são reiniciados toda segunda-feira às 6h.

## Qual é a URL do ambiente de produção?

A URL de produção é `app.nexus.com.br`. Acesso direto ao ambiente de produção é restrito. Qualquer alteração em produção passa pelo pipeline de deploy (nunca diretamente via SSH ou console). Se precisar investigar um incidente, use o acesso somente-leitura disponível via VPN + RoleARN documentado no Confluence.

## Como conectar à VPN corporativa?

Instale o **Cisco AnyConnect** disponível em `ti.nexus.com.br/vpn`. Use seu e-mail corporativo e a senha enviada pelo TI no onboarding. O servidor VPN é `vpn.nexus.com.br`. A VPN é necessária para acessar recursos internos como banco de dados de produção, Grafana e painéis do Kubernetes. Desconecte quando não estiver usando recursos internos.

## Como solicitar acesso ao banco de dados?

Abra um chamado no Jira com o template **"Acesso — Banco de Dados"**. Especifique:
- Qual ambiente (dev, staging, produção)
- Qual banco (PostgreSQL principal, Redis, MongoDB analytics)
- Nível de acesso necessário (leitura ou leitura/escrita)
- Justificativa

Acesso a produção é somente-leitura e requer aprovação do tech lead. Nunca execute queries de escrita em produção sem aprovação do time.

## Qual banco de dados o projeto utiliza?

O sistema usa:
- **PostgreSQL 15** — banco principal (transacional)
- **Redis 7** — cache de sessão e filas de jobs
- **MongoDB 6** — dados de analytics e logs estruturados
- **Elasticsearch 8** — índice de busca full-text

Para desenvolvimento local, todos sobem via `docker compose up -d` usando as configurações do `docker-compose.yml` na raiz do projeto.

## Como rodar as migrations do banco de dados?

O projeto usa **Knex.js** para migrations. Comandos principais:
- `npm run migrate:latest` — aplica todas as migrations pendentes
- `npm run migrate:rollback` — reverte a última migration aplicada
- `npm run migrate:status` — lista o status das migrations

Para criar uma nova migration: `npm run migrate:make nome_da_migration`. Arquivos de migration ficam em `src/database/migrations/`.

## Como criar uma nova migration corretamente?

As migrations devem ser **reversíveis** — sempre implementar tanto a função `up` quanto a `down`. Nunca delete dados na função `up` sem ter certeza de que a `down` pode restaurá-los. Migrations que alteram colunas em tabelas grandes (>1M registros) devem ser discutidas com o tech lead antes de aplicar em produção. Use transações quando possível.

## Como rodar os testes unitários?

Execute `npm run test` para rodar todos os testes com **Jest**. Para rodar apenas um arquivo: `npm run test -- src/services/pagamento.test.ts`. Para modo watch: `npm run test:watch`. A cobertura de código é verificada com `npm run test:coverage`. O threshold mínimo de cobertura é **80%** — PRs que reduzirem a cobertura são bloqueados pelo CI.

## Como rodar os testes de integração?

Os testes de integração ficam em `src/__tests__/integration/`. Execute com `npm run test:integration`. Eles requerem os containers Docker rodando localmente (`docker compose up -d`). Testes de integração não são executados no CI a cada PR — apenas na pipeline de staging após merge na `main`.

## O que fazer quando os testes estão quebrando no CI?

1. Leia o log completo do CI (GitHub Actions) — o erro exato estará lá
2. Reproduza localmente: `npm run test`
3. Se o erro for de ambiente (ex: variável faltando), verifique os secrets do repositório no GitHub
4. Se for um teste flaky (falha intermitente), comente no PR e crie uma task no Jira para investigar
5. Nunca faça merge com CI vermelho sem aprovação explícita do tech lead

## Como funciona o processo de code review?

O revisor deve verificar:
- Lógica correta e ausência de bugs óbvios
- Testes adequados para a mudança
- Segurança (sem dados sensíveis expostos, sem SQL injection, etc.)
- Clareza do código e nomes adequados
- Performance (queries N+1, loops desnecessários)

Use comentários no GitHub com prefixos: **[blocker]** para problemas que impedem aprovação, **[nit]** para sugestões menores, **[question]** para dúvidas sem bloqueio.

## Qual é a convenção de commits adotada?

Usamos **Conventional Commits**. Formato: `tipo(escopo): descrição`. Tipos válidos:
- `feat`: nova funcionalidade
- `fix`: correção de bug
- `chore`: manutenção (deps, configs)
- `docs`: documentação
- `refactor`: refatoração sem mudança de comportamento
- `test`: adição ou correção de testes
- `perf`: melhoria de performance

Exemplo: `feat(auth): adiciona login com Google OAuth`.

## Como fazer squash de commits antes de mergear?

No GitHub, ao mergear um PR, selecione **"Squash and merge"** para consolidar todos os commits em um único. Se preferir fazer manualmente: `git rebase -i origin/main`. No editor interativo, substitua `pick` por `squash` (ou `s`) nos commits que quer consolidar, mantendo o primeiro como `pick`. Salve e edite a mensagem final do commit consolidado.

## Como resolver conflitos de merge?

1. Atualize sua branch: `git fetch origin && git rebase origin/main`
2. O Git indicará os arquivos em conflito
3. Abra cada arquivo conflitante — os marcadores `<<<<<<`, `=======`, `>>>>>>>` indicam as diferenças
4. Resolva manualmente, removendo os marcadores
5. Adicione os arquivos resolvidos: `git add arquivo-resolvido.ts`
6. Continue o rebase: `git rebase --continue`
7. Empurre a branch atualizada: `git push origin nome-da-branch --force-with-lease`

## Como funciona o pipeline de CI/CD?

Usamos **GitHub Actions**. A cada push para qualquer branch:
1. Linting (`npm run lint`)
2. Type check (`npx tsc --noEmit`)
3. Testes unitários (`npm run test`)
4. Build da aplicação (`npm run build`)

A cada merge na `main`:
5. Deploy automático para **staging**
6. Smoke tests no ambiente de staging
7. Notificação no canal `#deploy` do Slack

Deploy para **produção** é manual e requer aprovação via GitHub Environments.

## Como fazer deploy para produção?

1. Confirme que o staging está estável (verifique Grafana e logs)
2. Acesse o repositório no GitHub → **Actions → Deploy to Production**
3. Clique em **"Run workflow"** e selecione a tag de release
4. Aguarde a aprovação dos aprovadores configurados (tech lead + 1 senior)
5. Após aprovação, o deploy inicia automaticamente
6. Monitore o Grafana durante e após o deploy por pelo menos 15 minutos
7. Registre o deploy no canal `#deploy` do Slack com o número da versão

## O que fazer em caso de incidente em produção?

1. **Não entre em pânico** — siga o runbook
2. Avise imediatamente no canal `#alertas-producao` no Slack
3. Acione o on-call via PagerDuty se não houver resposta em 5 minutos
4. Investigue os logs no Grafana/Loki
5. Se o deploy recente for a causa, faça rollback imediato via GitHub Actions
6. Abra um post-mortem no Confluence após a resolução (template disponível lá)
7. Nunca tente corrigir um incidente em produção sem avisar o time

## Como acessar os logs da aplicação?

Logs de produção e staging ficam no **Grafana Loki** em `grafana.nexus.com.br` (requer VPN). Use a interface do Loki para filtrar por serviço, nível de log e intervalo de tempo. Para logs locais, use `docker compose logs -f api` (substitua `api` pelo nome do serviço). Logs de erro são também enviados para o **Sentry** em `sentry.nexus.com.br`.

## Como acessar o Sentry para monitorar erros?

Acesse `sentry.nexus.com.br` com seu e-mail corporativo (peça ao tech lead para ser adicionado ao projeto). No Sentry, você verá erros agrupados por tipo com stack traces completos. Configure alertas de e-mail para issues novas no seu serviço. Ao resolver um erro, marque como **"Resolved"** no Sentry e adicione o link do PR que corrigiu.

## Como monitorar a saúde da aplicação?

Use o **Grafana** em `grafana.nexus.com.br` (requer VPN). Os dashboards principais são:
- **Application Overview** — latência, taxa de erros, throughput
- **Database** — conexões ativas, queries lentas, uso de índices
- **Infrastructure** — CPU, memória, disco dos pods Kubernetes
- **Business Metrics** — métricas de negócio (usuários ativos, conversões)

Configure alertas no Grafana para ser notificado por Slack quando métricas ultrapassarem os thresholds definidos.

## Como funciona a infraestrutura de cloud?

A infraestrutura roda na **AWS** (região `sa-east-1` — São Paulo). Componentes principais:
- **EKS** (Kubernetes) — orquestração dos containers da aplicação
- **RDS** (PostgreSQL) — banco de dados principal com Multi-AZ
- **ElastiCache** (Redis) — cache distribuído
- **S3** — armazenamento de arquivos e assets
- **CloudFront** — CDN para assets estáticos
- **Route53** — DNS

Acesso direto à AWS é restrito. Mudanças de infra são feitas via **Terraform** no repositório `infra-terraform`.

## Como solicitar aumento de recursos de um pod Kubernetes?

Abra um chamado no Jira com o template **"Infra — Ajuste de Recursos"**. Informe o serviço, ambiente e justificativa (ex: métricas de uso de memória próximo ao limite). O time de DevOps avalia e aplica a mudança. Nunca edite recursos de pods diretamente — as configurações ficam nos arquivos Helm em `infra-helm/`.

## O que é e como usar o Terraform no projeto?

O Terraform gerencia toda a infraestrutura da AWS. O repositório é `infra-terraform`. Para propor uma mudança de infra:
1. Crie uma branch e edite os arquivos `.tf` correspondentes
2. Execute `terraform plan` para verificar o que será alterado
3. Abra um PR — o CI executa `terraform plan` automaticamente
4. Aguarde aprovação do DevOps e do tech lead
5. O `terraform apply` é executado manualmente pelo DevOps após aprovação

## Como o sistema de autenticação funciona?

A autenticação usa **JWT (JSON Web Tokens)** com refresh tokens. Fluxo:
1. Usuário faz login com e-mail/senha ou OAuth (Google)
2. API retorna `accessToken` (expira em 15 minutos) e `refreshToken` (expira em 7 dias)
3. O `accessToken` é enviado no header `Authorization: Bearer {token}` em cada requisição
4. Quando o `accessToken` expira, o cliente usa o `refreshToken` no endpoint `POST /auth/refresh`
5. Em caso de logout, o `refreshToken` é invalidado no Redis

## Como proteger um endpoint da API?

Use o middleware `requireAuth` nos routes que precisam de autenticação:

```typescript
router.get('/perfil', requireAuth, perfilController.getById)
```

Para endpoints que requerem permissões específicas, use `requireRole`:

```typescript
router.delete('/usuario/:id', requireAuth, requireRole('admin'), usuarioController.delete)
```

As roles disponíveis são: `user`, `admin`, `superadmin`. A role do usuário autenticado fica disponível em `req.user.role`.

## Como estruturar um novo endpoint da API?

Seguimos a arquitetura **Controller → Service → Repository**:
1. **Controller** (`src/controllers/`) — recebe a requisição, valida entrada com Zod, chama o Service
2. **Service** (`src/services/`) — contém a lógica de negócio, sem acesso direto ao banco
3. **Repository** (`src/repositories/`) — acessa o banco de dados via Knex

Nunca acesse o banco diretamente no Controller. Nunca coloque lógica de negócio no Repository. Crie testes unitários para o Service mockando o Repository.

## Como validar dados de entrada de uma requisição?

Usamos **Zod** para validação. Defina o schema em `src/schemas/`:

```typescript
const criarPedidoSchema = z.object({
  produtoId: z.string().uuid(),
  quantidade: z.number().int().positive(),
  enderecoId: z.string().uuid(),
})
```

No controller, use o helper `validateBody(schema)` que retorna 400 automaticamente se inválido. Schemas de validação devem ter testes unitários próprios para os casos de borda.

## Como lidar com erros na API?

Use a classe `AppError` para erros conhecidos:

```typescript
throw new AppError('Produto não encontrado', 404)
```

O middleware global de erros (`src/middleware/errorHandler.ts`) captura e formata a resposta. Para erros inesperados (500), o middleware loga automaticamente no Sentry. Nunca retorne stack traces para o cliente em produção — configure `NODE_ENV=production` para suprimi-los.

## Como fazer paginação nas queries de listagem?

Use o helper `paginate` disponível em `src/utils/paginate.ts`:

```typescript
const { data, total, page, perPage } = await paginate(
  db('produtos').where({ ativo: true }),
  { page: req.query.page, perPage: req.query.per_page }
)
```

O padrão de paginação é por **offset/limit**. Limite máximo por página: 100 itens. O retorno deve sempre incluir `total`, `page`, `perPage` e `data`.

## Como adicionar uma nova variável de ambiente?

1. Adicione ao arquivo `.env.example` com um valor de placeholder e comentário explicativo
2. Adicione ao arquivo `.env.local` com o valor para desenvolvimento
3. Documente no Confluence em **"Variáveis de Ambiente"** o propósito e os valores por ambiente
4. Adicione ao **AWS Secrets Manager** via Terraform para staging e produção (peça ajuda ao DevOps)
5. Adicione ao arquivo de secrets do GitHub Actions se necessário para o CI

## Como acessar o Confluence?

Acesse `confluence.nexus.com.br` com seu e-mail corporativo. O espaço principal é **"Engineering"**. Documentação importante fica em:
- **Arquitetura** — diagramas e decisões técnicas (ADRs)
- **Runbooks** — procedimentos operacionais
- **Processos** — fluxo de desenvolvimento, cerimônias ágeis
- **Onboarding** — guias para novos membros (incluindo este!)

## Como documentar uma decisão arquitetural?

Use o template de **ADR (Architecture Decision Record)** no Confluence. Acesse **Engineering → Arquitetura → ADRs** e clique em "Criar ADR". Preencha: contexto do problema, opções consideradas, decisão tomada e consequências. ADRs são imutáveis — se a decisão mudar, crie um novo ADR referenciando o anterior como substituído.

## Como funciona o processo de sprint?

Sprints têm duração de **2 semanas**, começando na segunda-feira. Cerimônias:
- **Planning** — segunda do início da sprint (2h)
- **Review** — sexta do fim da sprint (1h) — demonstração das entregas
- **Retrospectiva** — sexta do fim da sprint (1h) — processo e melhoria contínua
- **Refinamento** — quarta da semana intermediária (1h) — preparação do backlog

Standup assíncrono diário no Slack (detalhes na pergunta sobre standup).

## Como funcionam as cerimônias ágeis?

**Planning**: o time escolhe as tasks do backlog para o sprint com base na capacidade (velocity histórico). Tasks devem ter critérios de aceitação claros antes de entrar no sprint.

**Review**: cada desenvolvedor demonstra o que entregou. Stakeholders podem participar.

**Retrospectiva**: formato **Start/Stop/Continue**. Ações geradas são registradas no Confluence e acompanhadas na próxima retro.

**Refinamento**: o PO apresenta as próximas tasks, o time faz perguntas e estima (Planning Poker com story points).

## Como escalar um bloqueio técnico?

1. Tente resolver por conta própria por até 30 minutos
2. Pergunte no canal `#suporte-dev` do Slack — descreva o problema com contexto
3. Se não resolver em 1 hora, solicite uma sessão de pair programming com um colega sênior
4. Se o bloqueio impactar o sprint, avise o tech lead imediatamente para replanejamento
5. Nunca fique bloqueado em silêncio por mais de meio dia

## O que é o on-call e como funciona?

O on-call é o plantão de suporte a incidentes de produção. A escala é gerenciada via **PagerDuty** e rotaciona semanalmente entre os desenvolvedores seniors. Novos membros do time entram na escala após 3 meses de experiência no projeto. O on-call recebe alertas via PagerDuty (SMS, ligação e push notification) para incidentes críticos fora do horário comercial.

## Como configurar o VS Code para o projeto?

Após clonar o repositório, o VS Code sugerirá instalar as extensões recomendadas (arquivo `.vscode/extensions.json`). Aceite a instalação. As principais são: ESLint, Prettier, GitLens, Docker, Thunder Client e a extensão da linguagem principal do projeto. O arquivo `.vscode/settings.json` já configura formatação automática ao salvar e integração com o ESLint.

## Como o linting está configurado?

Usamos **ESLint** com a configuração `eslint-config-next` e regras customizadas em `eslint.config.mjs`. O linting é executado automaticamente no CI. Para rodar localmente: `npm run lint`. Para corrigir automaticamente: `npm run lint:fix`. O Prettier é responsável pela formatação (não pelo lint) e também roda automaticamente ao salvar no VS Code.

## Como o TypeScript está configurado no projeto?

O `tsconfig.json` na raiz define as configurações. Pontos importantes:
- `strict: true` — todas as verificações estritas ativas (sem `any` implícito)
- `paths` configurados — use `@/` para imports a partir de `src/`
- `noUncheckedIndexedAccess: true` — acesso a arrays sempre retorna `T | undefined`

Para verificar tipos sem buildar: `npx tsc --noEmit`. O CI bloqueia PRs com erros de tipo.

## Como adicionar uma nova dependência ao projeto?

1. Verifique se a funcionalidade já não existe em uma lib já instalada
2. Pesquise a popularidade, manutenção e licença da lib (prefira MIT/Apache-2)
3. Instale: `npm install nome-da-lib` (dependência) ou `npm install -D nome-da-lib` (dev)
4. Documente no PR por que a lib foi escolhida
5. Libs com potencial impacto de segurança (auth, crypto, HTTP) precisam de aprovação do tech lead antes de instalar

## Como funciona o sistema de feature flags?

Usamos feature flags gerenciadas pelo **LaunchDarkly** para controlar o rollout de novas funcionalidades. Para usar uma flag no backend:

```typescript
const flagAtiva = await ldClient.variation('nome-da-flag', userContext, false)
if (flagAtiva) { /* novo comportamento */ }
```

Para criar uma nova flag, acesse o painel do LaunchDarkly e documente o propósito no Confluence. Toda flag nova começa desativada em produção.

## Como gerar um relatório de cobertura de testes?

Execute `npm run test:coverage`. O relatório HTML é gerado em `coverage/lcov-report/index.html`. Abra no navegador para ver a cobertura linha a linha. O CI publica a cobertura no GitHub como comentário no PR. Metas: 80% de cobertura geral, 90% para código de negócio crítico (pagamentos, autenticação).

## Como configurar o Prettier no projeto?

O Prettier já está configurado em `.prettierrc.json`. Para formatar todos os arquivos: `npm run format`. Para verificar sem modificar: `npm run format:check`. A configuração usa: `semi: false`, `singleQuote: true`, `trailingComma: 'es5'`, `printWidth: 100`. Não modifique o `.prettierrc.json` sem discussão no time — afeta todos os arquivos do projeto.

## Como debugar a aplicação localmente?

No VS Code, use a configuração de debug já definida em `.vscode/launch.json`. Pressione **F5** para iniciar o servidor em modo debug. Os breakpoints funcionam normalmente. Alternativamente, adicione `--inspect` ao script de desenvolvimento: `node --inspect src/server.ts`. Conecte o debugger do Chrome acessando `chrome://inspect`.

## Como funciona o sistema de filas de jobs?

Usamos **BullMQ** com Redis para processamento assíncrono. As filas ficam em `src/queues/`. Para adicionar um job:

```typescript
await emailQueue.add('enviar-boas-vindas', { usuarioId, email })
```

Os workers ficam em `src/workers/`. Para monitorar as filas localmente, acesse o **Bull Board** em `http://localhost:3001/queues` (disponível apenas em desenvolvimento).

## Como enviar e-mails transacionais?

Usamos o **SendGrid** para envio de e-mails. O serviço de e-mail fica em `src/services/email.service.ts`. Templates de e-mail são gerenciados no painel do SendGrid (peça acesso ao tech lead). Em desenvolvimento local, os e-mails são interceptados pelo **Mailhog** (acessível em `http://localhost:8025`) e não são enviados de verdade.

## Como fazer upload de arquivos?

Uploads vão direto para o **S3** via URL pré-assinada. Fluxo:
1. Frontend solicita URL pré-assinada: `POST /api/uploads/presigned-url`
2. API retorna URL temporária do S3 (válida por 15 minutos)
3. Frontend faz upload diretamente para o S3 via `PUT` na URL pré-assinada
4. Frontend notifica a API do sucesso: `POST /api/uploads/confirm`
5. API processa o arquivo (valida, gera thumbnails, etc.)

Tamanho máximo: 50MB. Tipos permitidos: definidos em `src/config/uploads.ts`.

## Como acessar os dados de analytics?

Os dados de analytics ficam no **MongoDB** do cluster de analytics (separado do banco transacional). Acesse via DBeaver com as credenciais do Secrets Manager (somente staging — produção requer aprovação). Consultas de analytics complexas devem ir para o **Metabase** em `metabase.nexus.com.br`, onde existem dashboards prontos.

## Como solicitar acesso ao Metabase?

Acesse `metabase.nexus.com.br` com seu e-mail corporativo. Se não conseguir fazer login, solicite ao time de Dados (canal `#time-dados` no Slack) para adicionar seu usuário. O Metabase tem dados até a última hora — não é tempo real. Para dados em tempo real, use o Grafana.

## Qual é a política de branches protegidas?

A branch `main` é protegida: push direto bloqueado, requer PR com aprovação, CI deve estar verde, e branch deve estar atualizada com `main`. A branch `release/*` também é protegida para releases hotfix. Nunca force-push em branches protegidas — isso requer permissão de admin e aprovação do tech lead.

## O que são e como usar snapshots de teste?

O Jest suporta **snapshot testing** com `toMatchSnapshot()`. Use para componentes de UI e objetos de resposta da API que não mudam frequentemente. Para atualizar snapshots: `npm run test -- --updateSnapshot`. Antes de atualizar, verifique manualmente se as mudanças são esperadas. Snapshots ficam em `__snapshots__/` ao lado do arquivo de teste.

## Como funciona o versionamento semântico do projeto?

Usamos **SemVer** (Major.Minor.Patch):
- **Patch** (1.0.X): correção de bug sem breaking change
- **Minor** (1.X.0): nova funcionalidade retrocompatível
- **Major** (X.0.0): breaking change na API pública

O bumping de versão é feito automaticamente pelo **semantic-release** baseado nos commits (Conventional Commits). Não edite o `package.json` `version` manualmente.

## Como criar uma release?

Releases são geradas automaticamente pelo **semantic-release** a cada merge na `main`. O CI:
1. Analisa os commits desde a última release
2. Determina o tipo de bump (patch/minor/major) pelos prefixos dos commits
3. Gera o `CHANGELOG.md`
4. Cria a tag de versão no GitHub
5. Publica a release no GitHub Releases

Para hotfixes urgentes, crie uma branch `hotfix/descricao` a partir da tag de release e abra PR direto para `main`.

## O que fazer ao encontrar um bug em produção?

1. Registre imediatamente no Jira como **Bug** com prioridade **Critical** ou **Blocker** dependendo do impacto
2. Adicione à descrição: comportamento esperado, comportamento atual, passos para reproduzir e impacto estimado
3. Avise no canal `#dev` do Slack linkando o ticket
4. Se o bug impactar receita ou dados de usuários, acione também o on-call
5. Antes de corrigir, escreva um teste que reproduz o bug — depois corrija até o teste passar

## Como documentar o código?

- **Funções públicas de serviços**: JSDoc com `@param`, `@returns` e `@throws`
- **Interfaces e tipos**: comentário de linha acima do campo se o nome não for autoexplicativo
- **Decisões não óbvias no código**: comentário inline explicando o "por quê" (não o "o quê")
- **Evite**: comentários que apenas repetem o que o código já diz

Boa documentação está no código, não em documentos externos que ficam desatualizados.

## Como funciona o processo de onboarding técnico?

O onboarding técnico tem duração de **4 semanas**:
- **Semana 1**: setup de ambiente, leitura da arquitetura, pair programming com o buddy
- **Semana 2**: primeira task pequena solo, participação em todas as cerimônias
- **Semana 3**: task de complexidade média, primeira revisão de PR de outro dev
- **Semana 4**: task de complexidade alta ou melhoria de sistema existente, apresentação na Review

Seu buddy técnico é designado pelo tech lead no primeiro dia.

## Quem é meu ponto de contato técnico no primeiro mês?

Cada novo desenvolvedor tem um **buddy técnico** designado — um desenvolvedor experiente do time que auxilia durante o onboarding. Seu buddy está disponível para dúvidas via Slack DM a qualquer momento. Reuniões de acompanhamento com o tech lead acontecem semanalmente nas primeiras 4 semanas.

## Como reportar um problema de segurança?

**Não** abra um issue público ou um PR. Envie um e-mail para `seguranca@nexus.com.br` com descrição detalhada do problema. O time de segurança responde em até 24 horas. Para vulnerabilidades críticas (ex: exposição de dados de usuários), ligue também para o on-call. Nunca compartilhe detalhes de vulnerabilidades em canais públicos antes da correção.

## Quais são as boas práticas de segurança obrigatórias?

- Nunca commite credenciais, tokens ou senhas no código — use variáveis de ambiente
- Valide e sanitize todas as entradas do usuário
- Use HTTPS sempre — nunca HTTP em produção
- Imagens Docker devem rodar como usuário não-root
- Dependências devem ser atualizadas regularmente — verifique alertas do Dependabot
- Queries ao banco usam always parameterized queries (nunca string concatenation)
- Logs nunca devem conter dados sensíveis (senhas, CPF, cartão de crédito)

## Como funciona o Dependabot no projeto?

O **Dependabot** verifica dependências vulneráveis e abre PRs automáticos de atualização. PRs do Dependabot aparecem com o label `dependencies`. O CI roda normalmente neles. Se os testes passarem, o PR pode ser mergeado sem review adicional (exceto para atualizações major). Revise o changelog da lib antes de mergear atualizações major.

## Como configurar o pré-commit hooks?

O projeto usa **Husky** + **lint-staged** para executar verificações antes de cada commit. Após clonar, o Husky é instalado automaticamente com `npm install`. Os hooks executam: ESLint e Prettier nos arquivos staged. Se o hook falhar, o commit é bloqueado — corrija os erros apontados. Para pular o hook em emergência: `git commit --no-verify` (uso dissuadido).

## Como fazer um rollback de deploy?

Em caso de incidente pós-deploy:
1. Acesse **GitHub → Actions → Deploy to Production**
2. Clique em **"Run workflow"**
3. Selecione a tag da versão anterior estável
4. Confirme com a equipe no Slack antes de executar
5. O rollback é tratado como um novo deploy — vai pelo mesmo fluxo de aprovação

Se a situação for crítica e não houver tempo para aprovação, o tech lead pode aprovar e executar sozinho.

## Como acessar o painel de administração interno?

O painel admin fica em `admin.nexus.com.br` (requer VPN + autenticação com role `admin`). Solicite acesso ao tech lead se necessário para sua função. Operações sensíveis no admin (remover usuários, reprocessar pagamentos) exigem confirmação de um segundo usuário admin (four-eyes principle). Todas as ações no admin são auditadas e registradas com o usuário que executou.

## Como solicitar um novo ambiente de desenvolvimento para um experimento?

Abra um chamado no Jira com o template **"Infra — Ambiente Efêmero"**. Descreva o objetivo do experimento e por quanto tempo precisa do ambiente. O DevOps provisiona ambientes efêmeros no EKS usando namespaces isolados. Ambientes efêmeros são destruídos automaticamente após 7 dias ou mediante chamado de encerramento.

## Como consultar o histórico de deploys?

O histórico fica em dois lugares:
1. **GitHub Releases** — lista todas as versões com changelog gerado automaticamente
2. **Canal `#deploy` do Slack** — mensagens automáticas de cada deploy com quem aprovou e o horário
3. **Grafana** — o dashboard de deploy mostra anotações verticais no tempo de cada release

## Como funciona o processo de pair programming?

Pair programming é encorajado, especialmente para tasks complexas ou de alto risco. Para agendar uma sessão, combine diretamente com o colega via Slack. Usamos **VS Code Live Share** para sessões remotas (instale a extensão). O driver digita, o navigator observa e sugere. Alterne os papéis a cada 25 minutos (técnica Pomodoro).

## Como contribuir com melhorias no processo de onboarding?

Se encontrar algo confuso ou desatualizado neste FAQ ou em qualquer documentação de onboarding, você tem autonomia para melhorar. Atualize a documentação no Confluence ou abra um PR com melhorias neste arquivo. Feedback sobre o processo de onboarding é muito bem-vindo no canal `#melhoria-continua` do Slack.

## Como funciona o controle de acesso por roles?

O sistema usa **RBAC (Role-Based Access Control)** com três roles principais:
- `user` — acesso padrão de usuário da plataforma
- `admin` — acesso ao painel administrativo
- `superadmin` — acesso irrestrito (apenas time de engenharia sênior)

Permissões são verificadas no middleware de autenticação. Para adicionar uma nova permissão, defina-a em `src/config/permissions.ts` e documente no Confluence.

## Onde fica a documentação de arquitetura do sistema?

A documentação de arquitetura fica no **Confluence → Engineering → Arquitetura**. Lá você encontra:
- Diagrama de contexto do sistema (C4 Model — Nível 1 e 2)
- Diagrama de componentes dos serviços principais
- Decisões arquiteturais (ADRs)
- Modelo de dados do banco principal (gerado pelo DBeaver e exportado como PNG)
- Fluxos de dados críticos (autenticação, pagamentos, notificações)

## Como funciona o processo de estimativa de tasks?

Usamos **Story Points** com sequência Fibonacci (1, 2, 3, 5, 8, 13, 21). No refinamento, cada dev vota simultaneamente (Planning Poker via extensão do Jira). Se houver divergência grande (ex: alguém votou 2 e outro votou 13), o time discute até chegar a um consenso. Tasks com mais de 13 pontos são quebradas em sub-tasks. Não use horas — story points medem complexidade relativa, não tempo.

## Como funciona o acesso ao banco de dados de produção?

Acesso ao banco de produção é **somente-leitura** e auditado. Para obter acesso:
1. Abra chamado no Jira com justificativa
2. Aprovação do tech lead + gerente de produto
3. DevOps provisiona acesso temporário via AWS IAM (expira em 8 horas)
4. Você acessa via bastião SSH com o comando fornecido pelo DevOps

Nunca salve as credenciais de produção localmente. Nunca execute queries que modificam dados em produção sem aprovação explícita e script revisado.

## O que é e como usar o Storybook?

O **Storybook** documenta os componentes de UI de forma interativa. Para rodá-lo localmente: `npm run storybook` (disponível em `http://localhost:6006`). Ao criar um novo componente, crie também um arquivo `.stories.tsx` ao lado com os estados principais. O Storybook de staging fica em `storybook.nexus.com.br` e é atualizado a cada merge na `main`.

## Como rodar o projeto com Docker Compose?

Execute `docker compose up -d` na raiz do projeto. Isso sobe:
- PostgreSQL na porta 5432
- Redis na porta 6379
- MongoDB na porta 27017
- Mailhog (e-mail local) nas portas 1025 (SMTP) e 8025 (UI)
- Bull Board na porta 3001

Para parar tudo: `docker compose down`. Para resetar os dados: `docker compose down -v` (apaga os volumes — use com cuidado).

## Como verificar se o ambiente local está funcionando corretamente?

Execute `npm run health:check`. Esse script verifica:
- Conexão com PostgreSQL
- Conexão com Redis
- Conexão com MongoDB
- Variáveis de ambiente obrigatórias presentes
- Migrations aplicadas e atualizadas

Se alguma verificação falhar, o script indica o problema e o passo para corrigir.

## Qual é a política de uso de bibliotecas de terceiros?

Antes de adicionar uma lib:
1. A licença deve ser compatível: MIT, Apache 2.0, BSD ou ISC (evite GPL em código proprietário)
2. Prefira libs com mais de 1.000 estrelas no GitHub e manutenção ativa (commit nos últimos 6 meses)
3. Verifique vulnerabilidades conhecidas em `npmjs.com` e `snyk.io`
4. Libs que processam dados sensíveis (cripto, auth, PII) requerem revisão do time de segurança

## Como acessar as métricas de performance da API?

Métricas de performance ficam no **Grafana** no dashboard **"API Performance"**. As métricas monitoradas são: latência P50/P95/P99, taxa de erros por endpoint, throughput (req/s) e tamanho de payload. Para endpoints novos, o APM (**Datadog APM**) gera rastreamentos distribuídos automaticamente — acesse via `apm.nexus.com.br`.

## Como configurar o acesso ao Datadog?

Acesse `app.datadoghq.com` com seu e-mail corporativo (SSO via Google). Solicite ao tech lead para ser adicionado à organização `nexus-sistemas`. O Datadog é usado para APM (rastreamento distribuído), métricas de infraestrutura e alertas. Os dashboards de APM mostram traces de ponta a ponta das requisições.

## Como funciona o processo de code freeze?

O **code freeze** é declarado pelo tech lead via Slack antes de releases maiores ou datas críticas (ex: Black Friday). Durante o code freeze:
- Apenas bugfixes críticos são aceitos
- PRs de features ficam em aberto para merge após o freeze
- O canal `#deploy` fica monitorado mais ativamente
- Duração típica: 24 a 72 horas

## Como é feita a gestão de secrets de CI/CD?

Secrets do CI ficam nos **Secrets do GitHub Actions** (repository secrets e environment secrets). Para adicionar um novo secret:
1. Acesse o repositório no GitHub → Settings → Secrets and variables → Actions
2. Clique em **"New repository secret"**
3. Informe o DevOps para adicionar também nos environments de staging e produção

Nunca coloque secrets diretamente no arquivo `yaml` do workflow — use sempre `${{ secrets.NOME_DO_SECRET }}`.

## Como funciona o processo de code review de segurança (SAST)?

O pipeline de CI executa o **Semgrep** automaticamente em cada PR para análise estática de segurança (SAST). Achados são reportados como comentários no PR com severidade: `ERROR` (bloqueia merge), `WARNING` (deve ser avaliado) e `INFO` (informativo). Para falsos positivos confirmados, adicione o comentário `# nosemgrep: regra-id` na linha correspondente e documente o motivo no PR.

## Como solicitar licença para participar de um evento ou conferência?

Envie uma mensagem ao seu gestor direto via Slack com: nome do evento, datas, localidade e justificativa de relevância técnica. A empresa cobre inscrição de conferências técnicas relevantes (ex: The Developer's Conference, QCon) mediante aprovação do gestor. Após o evento, compartilhe um resumo dos aprendizados no canal `#dev` ou em uma sessão de **Knowledge Sharing**.

## Como funcionam as sessões de Knowledge Sharing?

O **Knowledge Sharing** é uma sessão quinzenal de 45 minutos, às quartas-feiras às 16h, onde um desenvolvedor apresenta algo aprendido recentemente: nova tecnologia, solução de problema complexo, leitura técnica interessante, etc. Qualquer pessoa pode se inscrever para apresentar — fale com o tech lead. As sessões são gravadas e publicadas no Confluence em **Engineering → Knowledge Sharing**.
