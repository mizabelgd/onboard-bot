# Perguntas e respostas para a apresentação (banca)

Guia rápido para responder perguntas do professor avaliador sobre o OnboardBot. Respostas objetivas — para detalhes técnicos completos, ver `docs/adr.md`, `ARQUITETURA.md` e `docs/perf-report.md`.

---

## 1. Qual é o problema que o projeto resolve?

Onboarding de novos desenvolvedores costuma depender de perguntar para colegas ou vasculhar documentação dispersa. O OnboardBot é um chatbot que responde perguntas de onboarding com base em um FAQ estruturado da empresa, usando RAG (Retrieval-Augmented Generation) para dar respostas grounded (baseadas em contexto real), não inventadas.

## 2. Qual é a hipótese do TCC?

Que uma arquitetura de **RAG local, sem custo de API e sem GPU** (embeddings + LLM rodando na própria máquina) consegue responder perguntas de onboarding com qualidade aceitável — medida por métricas objetivas (Precision@K, taxa de alucinação, taxa de falha de recuperação, acurácia, latência) — sem depender de serviços pagos como OpenAI/Gemini.

## 3. Qual é a stack completa e por que cada peça foi escolhida?

| Componente | Tecnologia | Por quê |
|---|---|---|
| Frontend + Backend | Next.js (monólito) | Um único projeto, sem microsserviços — reduz complexidade de setup e execução local |
| Embeddings | `all-MiniLM-L6-v2` (Sentence Transformers, via `@huggingface/transformers`, ONNX) | Roda 100% local em Node.js, sem API, sem custo, leve (384 dimensões) |
| Banco vetorial | ChromaDB | Persistência local, zero setup de infraestrutura, busca por similaridade de cosseno nativa |
| LLM | Ollama rodando `phi3` (3.8B, quantizado) | Único componente que roda como serviço externo (container), mas 100% local/offline — sem custo por token |
| Testes | Vitest | Testes unitários e de integração do pipeline |

Todos os componentes rodam localmente (via Docker Compose) — **nenhuma chamada sai para a internet** depois que o modelo é baixado uma vez.

## 4. Por que não usar OpenAI/Gemini/Claude em vez de rodar tudo local?

Custo e reprodutibilidade acadêmica: usar uma API paga tornaria o TCC dependente de créditos/chave de API, o que não é sustentável nem reproduzível por qualquer avaliador que queira rodar o projeto depois. A decisão consciente (documentada no ADR) foi validar se uma stack 100% local e gratuita já é "boa o suficiente" para esse domínio (FAQ interno, escopo fechado).

## 5. O projeto usa LangChain?

**Não.** Apesar de alguns diagramas de arquitetura mencionarem "orquestrador RAG" de forma genérica, a decisão documentada foi implementar o RAG manualmente (chunking, embedding, busca, prompt, geração — cada etapa é um código simples e legível), sem framework de orquestração. Motivo: transparência total do pipeline para fins do artigo — cada etapa pode ser lida, medida e explicada sem "caixa-preta" de abstração.

## 6. O que é RAG e por que essa abordagem (Vanilla RAG)?

RAG = Retrieval-Augmented Generation: em vez do LLM responder só com o que "decorou" no treinamento, o sistema primeiro **busca** os trechos mais relevantes de uma base de conhecimento e injeta esses trechos no prompt antes do LLM gerar a resposta. Isso reduz alucinação e permite trocar a base de conhecimento sem re-treinar nada.

"Vanilla RAG" = a versão mais simples do padrão (busca por similaridade de vetores + prompt + geração), sem técnicas avançadas (re-ranking, RAG multi-hop, HyDE, etc.). Foi escolhida por simplicidade de implementação, adequação ao domínio (FAQ é um caso de uso simples) e reprodutibilidade acadêmica.

## 7. Como funciona o pipeline de ingestão (upload do FAQ)?

Arquivo: `src/app/api/faq/upload/route.ts`

1. Usuário sobe um arquivo `.md` estruturado com headings `##` (uma pergunta por seção).
2. O texto é dividido em **chunks**: cada `##` vira um chunk (heading + conteúdo abaixo dele). Se uma seção for muito grande (>1000 caracteres), ela é sub-dividida por parágrafo.
3. Cada chunk é transformado em um **vetor de 384 dimensões** pelo modelo de embedding (`all-MiniLM-L6-v2`), rodando local via ONNX.
4. Os vetores + textos + metadados (heading, filename, data) são salvos no **ChromaDB**, substituindo qualquer FAQ anterior.
5. O arquivo original é salvo em `uploads/current-faq.md` (sobrevive a reinícios do servidor).

## 8. Como funciona o pipeline de recuperação (uma pergunta do usuário)?

Arquivo: `src/app/api/chat/route.ts`

1. Usuário digita uma pergunta no chat.
2. A pergunta é transformada em vetor (mesmo modelo de embedding do upload).
3. O ChromaDB busca os **top-3 chunks** mais similares (similaridade de cosseno).
4. Chunks com similaridade abaixo de um limiar (0.30) são descartados — evita mandar contexto irrelevante para o modelo.
5. Monta-se um **prompt**: instrução de sistema + trechos recuperados + histórico recente da conversa + a pergunta.
6. O prompt vai para o **Ollama (phi3)**, que gera a resposta em **streaming** (o texto aparece token a token na tela, não tudo de uma vez).
7. A resposta, os chunks usados e os tempos de cada etapa são devolvidos ao frontend e, se houver uma sessão ativa, gravados em `metrics.json` para análise posterior.

## 9. Por que dividir o FAQ por heading `##` e não por tamanho fixo de caracteres (ex: 500 chars)?

Chunking por tamanho fixo pode cortar uma resposta no meio da frase. Como o FAQ já é naturalmente estruturado (uma pergunta = uma seção), dividir por heading preserva o significado semântico completo de cada resposta em um único chunk. Isso é chamado de "chunking semântico" no ADR. Só quando uma seção é excepcionalmente grande (>1000 caracteres) ela é sub-dividida por parágrafo, como salvaguarda.

## 10. Como o sistema evita "alucinação" (o modelo inventar respostas)?

Três camadas:
1. **Prompt restritivo**: a instrução de sistema diz explicitamente para responder só com base nos trechos fornecidos, e se a informação não estiver lá, dizer "não encontrei essa informação".
2. **Filtro de similaridade**: chunks fracos (pouco relevantes) nem chegam ao prompt.
3. **`temperature: 0.2`**: parâmetro do LLM configurado baixo para reduzir criatividade/variância, mantendo a resposta mais "colada" ao contexto fornecido.

Isso é medido pela métrica **Taxa de Alucinação (HR)**: uma heurística compara as palavras da resposta com as palavras dos trechos recuperados; se a sobreposição for baixa, a resposta é marcada como possivelmente não fundamentada no contexto.

## 11. Quais métricas são coletadas e onde aparecem?

Definidas no ADR (seção 7) e visíveis na tela `/dashboard`:

| Métrica | O que mede |
|---|---|
| Precision@K | % dos chunks recuperados que realmente são relevantes (score ≥ 0.30) |
| Taxa de Falha de Recuperação (FRR) | % de perguntas em que a busca não encontrou nada relevante |
| Taxa de Uso de Contexto (CUR) | % de respostas que de fato usaram o conteúdo recuperado |
| Taxa de Alucinação (HR) | inverso do CUR — % de respostas não fundamentadas no contexto |
| Acurácia | calculada automaticamente: % de respostas em que o retrieval encontrou contexto relevante **e** a resposta se apoiou nesse contexto (`!retrievalFailed && contextUtilized`) — sem depender de feedback do usuário |
| Latência | tempo de resposta ponta a ponta |

Cada interação de chat grava um registro em `uploads/metrics.json` (pergunta, resposta, scores de similaridade, tempos de cada etapa). A tela `/dashboard` lê esse arquivo e calcula as médias/percentuais **sob demanda**, toda vez que a tela é aberta ou atualizada — não há cálculo em background.

## 12. Quais são os critérios mínimos de aceitação (ADR 10)?

- Acurácia ≥ 80%
- Precision@K ≥ 75%
- Taxa de alucinação ≤ 10%
- Taxa de falha de recuperação ≤ 15%
- Latência ≤ 3 segundos por resposta

## 13. O sistema atinge o critério de latência (≤3s)?

**Não, e isso é reportado com transparência no `docs/perf-report.md`.** Medição real mostrou que a geração do LLM (phi3 rodando em CPU, sem GPU) responde por mais de 99% do tempo de resposta, a uma taxa de ~2.5 tokens/segundo. Nenhum ajuste de configuração (temperatura, tamanho de prompt, tamanho de contexto) muda a velocidade de hardware — só um modelo menor ou uma GPU resolveriam isso de verdade, o que ficou fora do escopo da otimização atual (a decisão foi não trocar a stack sem antes medir e justificar com dados). Para compensar, foi implementado **streaming**: o usuário passa a ver a resposta aparecendo em poucos segundos (7 a 19s medidos) em vez de esperar até 90s+ em branco — melhora a percepção de desempenho mesmo sem reduzir o tempo total.

## 14. Quais otimizações de performance foram feitas?

Ver `docs/perf-report.md` para números reais medidos. Resumo:
- Streaming da resposta (token a token, em vez de esperar tudo pronto)
- Teto de tokens gerados (`num_predict`) — antes a geração podia rodar indefinidamente
- Temperatura mais baixa (respostas mais diretas/factuais)
- Prompt de sistema mais enxuto
- Filtro de chunks pouco relevantes antes de montar o prompt
- Teto de tamanho de chunk na indexação (evita chunks gigantes no futuro)
- Log estruturado de tempo por etapa (embedding, busca vetorial, prompt, inferência)

## 14.1. O chat já teve algum bug conhecido de comportamento estranho em conversas longas?

Sim, e vale saber explicar se perguntarem. Em testes reais (não capturados pelos testes automatizados, que usam mocks), a partir da 5ª-6ª pergunta da mesma conversa o modelo às vezes "saía do assunto" e gerava texto sem relação com a pergunta, ou repetia "Olá!" em toda resposta. Causa raiz (detalhada em `docs/perf-report.md`, seção 9):
- O histórico da conversa, sem teto de tamanho, fazia o prompt ultrapassar o `num_ctx` configurado — o Ollama descartava as instruções de sistema (que ficam no início do prompt) e o modelo perdia o "grounding".
- O histórico era enviado como texto simples dentro de um único prompt, em vez de mensagens reais — corrigido migrando para o endpoint `/api/chat` do Ollama (mensagens `system`/`user`/`assistant`), que usa os tokens de parada nativos do modelo entre turnos.
- Mesmo assim, o phi3 (modelo pequeno, quantizado) às vezes continuava gerando depois de terminar a resposta certa — corrigido com uma sequência de parada (`stop`) que corta a geração assim que esse padrão aparece.

Isso é um bom exemplo para a apresentação: mostra que a avaliação não foi só teórica — o sistema foi testado com conversas reais de várias perguntas, um bug real foi encontrado, investigado e corrigido, com verificação repetindo o mesmo cenário depois da correção.

## 15. O sistema funciona sem internet?

Sim, depois do setup inicial (que baixa o modelo de embedding e o modelo do Ollama uma única vez). No dia a dia, upload de FAQ, busca e geração de resposta não fazem nenhuma chamada externa.

## 16. Como os dados dos usuários são tratados (privacidade)?

Tudo fica local: perguntas, respostas e métricas são salvas em `uploads/metrics.json` no próprio servidor/container, sem enviar nada para serviços de terceiros. Não há autenticação de usuário nem coleta de dados pessoais — só sessionId aleatório gerado no navegador para agrupar mensagens de uma conversa.

## 17. Quais são as principais limitações conhecidas?

- Latência de resposta ainda alta em hardware sem GPU (ver pergunta 13).
- FAQ precisa estar em Markdown estruturado por `##` — não faz OCR nem parsing de PDF/Word.
- A acurácia "ideal" (comparação semântica contra um benchmark com resposta esperada, ADR 9) ainda não foi construída — hoje ela é aproximada automaticamente por um proxy (retrieval bem-sucedido + resposta fundamentada no contexto), sem precisar de um benchmark nem de feedback manual do usuário.
- Escopo fechado: pensado para uma base de FAQ única por vez, não múltiplas fontes simultâneas.

## 18. Por que Docker Compose para rodar tudo?

Para isolar e padronizar os três serviços (app Next.js, ChromaDB, Ollama) sem exigir que cada avaliador instale cada dependência manualmente na própria máquina — `docker compose up` sobe o ambiente inteiro de forma reproduzível.
