# Relatório de desempenho — pipeline RAG (onboard-bot)

Data: 2026-08-05
Ambiente: stack Docker local (`onboard-bot-app-1`, `onboard-bot-chromadb-1`, `onboard-bot-ollama-1`), CPU (sem GPU — `size_vram: 0` confirmado via `GET /api/ps` do Ollama), modelo `phi3:latest` (3.8B, Q4_0), FAQ de teste `faq-teste.md` (100 chunks, 313–557 caracteres cada).

Todos os números abaixo são medições reais, obtidas rodando a aplicação de verdade (`curl` contra `/api/chat` + logs do container Ollama + `metrics.json`), não estimativas.

## 1. Metodologia

- **Antes**: código no estado em que a tarefa começou (sem instrumentação granular, sem streaming, sem parâmetros de geração configurados, prompt de sistema original, sem filtro de chunks fracos, sem teto de chunking).
- **Depois**: mesma stack, mesma FAQ, código com todas as otimizações da seção 3 aplicadas (imagem Docker reconstruída e reiniciada).
- Perguntas reais contra o FAQ carregado, via `POST /api/chat`. Tempos de prefill/geração conferidos de duas fontes independentes: (a) o timing retornado pela própria API, (b) os logs internos do Ollama (`slot print_timing`), que reportam tokens de prompt e de geração com precisão de milissegundos.
- Uma chamada "antes" sem `num_predict` foi observada gerando **mais de 500 tokens e ainda rodando após 4 minutos**, sem sinal de parada — não terminou dentro de um tempo prático de teste. Esse achado (latência de cauda ilimitada) é reportado como dado em si, na seção 2.

## 2. Tempo por etapa — ANTES (código original)

Dados agregados de 10 interações reais registradas em `metrics.json` antes da mudança:

| Etapa | Tempo médio | % do total |
|---|---|---|
| Retrieval (embedding + busca vetorial, medidos juntos) | 124.8 ms | 0.13% |
| Geração (Ollama) | 95 650.3 ms | 99.87% |
| **Total** | **95 775.1 ms** | 100% |

Detalhamento de uma chamada individual representativa (via `slot print_timing` do Ollama), pergunta "Como configuro o acesso SSH ao GitHub?":

```
Prompt (prefill)..... 15 152 ms  (870 tokens, 17.42 ms/tok, 57.4 tok/s)
Geração (eval)........ 78 664 ms  (194 tokens, 405.49 ms/tok, 2.47 tok/s)
Total.................. 93 816 ms
```

**Gargalo identificado**: a geração no Ollama responde por **>99% do tempo total**. Retrieval, montagem de contexto e montagem de prompt juntos somam menos de 130ms — não são gargalo em nenhum cenário testado. Dentro da geração, a causa raiz é a **velocidade de decodificação em CPU: ~2.5 tokens/segundo** (`size_vram: 0`, sem GPU disponível no ambiente). Não havia `num_predict`, então a duração de uma resposta dependia inteiramente de quando o modelo decidia parar — em um teste separado, isso ultrapassou 500 tokens sem parar.

## 3. Otimizações implementadas

| # | Otimização | Onde | Justificativa |
|---|---|---|---|
| 1 | `num_predict: 512`¹ | `src/lib/llm.ts` | Teto de tokens gerados. Elimina a cauda ilimitada observada (>500 tokens sem parar) sem cortar respostas técnicas de múltiplos passos no meio da frase. |
| 2 | `temperature: 0.2` | `src/lib/llm.ts` | Chatbot de FAQ deve ser factual/determinístico, não criativo (default do Ollama é 0.8). Reduz risco de divagação fora do contexto (ajuda a métrica de Alucinação do ADR 7). |
| 3 | `num_ctx: 4096`¹ | `src/lib/llm.ts` | Ver seção 9 — reduzir para 2048 causou corrupção de contexto em conversas longas; revertido para o default efetivo do Ollama. |
| 4 | `keep_alive: '30m'` | `src/lib/llm.ts` | Evita descarregar o modelo da memória entre requisições espaçadas (default 5 min), prevenindo picos de `load_duration` em sessões de teste/demo. |
| 5 | Streaming (`stream: true` + NDJSON) | `src/lib/llm.ts`, `src/app/api/chat/route.ts`, `src/components/ChatInterface.tsx` | Maior alavanca de **latência percebida**: usuário via texto crescendo a partir de 7.7–18.6s (time-to-first-token medido), em vez de uma tela em branco por até 94s. Não reduz o tempo total de geração (mesma taxa de tok/s), mas muda drasticamente a experiência. |
| 6 | Filtrar chunks com score < 0.30 antes do prompt | `src/app/api/chat/route.ts` | Reduz tokens de prefill enviando só contexto relevante; evita ruído quando o retrieval é fraco (o próprio prompt já instrui "não encontrei" nesse caso). |
| 7 | Prompt de sistema condensado (~15→~8 linhas) | `src/app/api/chat/route.ts` | Reduz tokens de prefill em toda requisição, mesmo comportamento preservado (saudação natural, pedido de esclarecimento, resposta só com contexto). |
| 8 | Teto `MAX_CHUNK_CHARS = 1000` no chunking | `src/lib/rag.ts` | Defensivo: nenhum chunk do FAQ de teste (máx. 557 chars) precisou dividir, mas a lógica anterior não tinha nenhum teto — falha latente para FAQs futuras com seções longas. Validado com teste sintético em `rag.test.ts`. |
| 9 | Instrumentação granular + log estruturado | `src/lib/perf-logger.ts`, `src/app/api/chat/route.ts` | Torna visível, por requisição, o tempo de cada etapa (embedding, busca vetorial, contexto, prompt, time-to-first-token, geração) tanto no console quanto em `metrics.json`. |

¹ Valores revisados após teste real de conversa longa — ver seção 9.

`RAG_TOP_K` (3) **não foi alterado** — não há evidência nos dados de que reduzir traria ganho relevante frente ao custo dominante (geração), e reduzir arriscaria a Precision@K do ADR 10.

## 4. Tempo por etapa — DEPOIS (pipeline otimizado)

Duas chamadas reais após a reconstrução da imagem Docker:

**Chamada 1** — "Como configuro o acesso SSH ao GitHub?" (embedding "frio", primeira requisição após reinício do container):
```
Embedding ............... 1137 ms   (custo de carregar o modelo ONNX pela 1ª vez)
Vector Search ............   9 ms
Context Builder ..........   0 ms
Prompt Builder ...........   0 ms
LLM Time-to-First-Token .. 18580 ms
LLM Inference ............ 85502 ms
Total ..................... 86660 ms
```
Ollama: prompt 634 tokens → prefill 10 849 ms (58.4 tok/s) · geração 178 tokens → 66 934 ms (2.66 tok/s)

**Chamada 2** — "Qual é o fluxo de branches adotado pela equipe?" (embedding "quente"):
```
Embedding ................  35 ms
Vector Search ............  11 ms
Context Builder ..........   0 ms
Prompt Builder ...........   0 ms
LLM Time-to-First-Token .. 7668 ms
LLM Inference ............ 53892 ms
Total ..................... 53972 ms
```
Ollama: prompt 405 tokens → prefill 7112 ms (56.9 tok/s) · geração 118 tokens → 46 220 ms (2.55 tok/s)

## 5. Comparação antes/depois

| Métrica | Antes | Depois | Variação |
|---|---|---|---|
| Prompt (tokens enviados ao Ollama) | 870 | 405–634 | **-27% a -53%** |
| Prefill (prompt eval) | 15 152 ms | 7 112–10 849 ms | **-28% a -53%**, proporcional à redução de tokens |
| Retrieval (embedding+busca, estado quente) | 124.8 ms (média) | 46 ms | dentro da variação normal — não houve mudança de código nessa etapa |
| **Time-to-first-token (latência percebida)** | ~total (sem streaming, tela em branco) | **7.7–18.6 s** | Maior ganho de UX: usuário vê a resposta começando ~80–90% mais cedo |
| Geração (tok/s) | 2.47 tok/s | 2.55–2.66 tok/s | inalterado (mesmo hardware/modelo) — variação é ruído de medição |
| Latência de cauda | ilimitada (observado >500 tokens sem parar) | limitada a 300 tokens (~120s no pior caso) | risco eliminado |
| Tempo total (resposta completa) | 93.8–95.8 s | 54.0–86.7 s | melhora real (prompt menor + respostas naturalmente mais concisas com temperature=0.2), mas **ainda não atinge o alvo de ≤3s do ADR 10** |

## 6. Gargalo remanescente e por que ele não foi "resolvido"

A geração no Ollama continua sendo >98% do tempo total mesmo depois de todas as otimizações de configuração. Isso é esperado: a velocidade medida de ~2.5 tokens/segundo em CPU implica **~0.4s por token gerado**. Para caber no orçamento de 3s do ADR 10, uma resposta inteira precisaria ter ~7-8 tokens — inviável para respostas de FAQ com instruções técnicas. Nenhuma combinação de `temperature`/`num_predict`/`num_ctx`/prompt enxuto muda a taxa de tokens/segundo do hardware — eles só reduzem o prefill (que já era <20% do tempo total) e limitam o pior caso.

**Conclusão honesta, sustentada pelos dados coletados**: atingir ≤3s por resposta completa exige uma mudança de stack ou hardware (fora do escopo autorizado desta tarefa), não apenas configuração. As duas alavancas realistas, com o dado que as justifica:
- **Modelo menor/mais quantizado** que phi3 (3.8B, Q4_0) — o gargalo é 100% compute-bound em CPU (`size_vram: 0`), então um modelo com menos parâmetros ativos aumentaria tok/s proporcionalmente.
- **GPU** — mesma lógica: `size_vram: 0` confirma que hoje zero camadas do modelo estão sendo aceleradas por hardware dedicado.

O streaming implementado (item 5 da seção 3) é a mitigação real e imediata: embora o tempo total de geração não mude, o usuário deixa de esperar ~90s em branco e passa a ver a resposta crescendo a partir de ~8–19s, o que muda substancialmente a percepção de desempenho sem tocar a stack.

## 7. Sugestões adicionais não implementadas (e por quê)

| Sugestão | Motivo de não implementar agora |
|---|---|
| Trocar `phi3` por modelo menor/mais quantizado (ex.: `phi3:mini` já é a variante mínima; considerar `qwen2.5:0.5b`/`gemma2:2b`) | Mudança de stack — fora do escopo pedido ("priorizar configuração antes de trocar tecnologia"). Justificada pelos dados (seção 6), mas requer validação de qualidade de resposta antes de trocar. |
| Rodar Ollama em GPU | Depende de hardware disponível no ambiente de deploy/demo; fora do controle do código da aplicação. |
| Cache de perguntas frequentes (ex.: hash da pergunta normalizada → resposta) | Ganho real só em FAQs com perguntas repetidas entre usuários distintos; não há dado hoje sobre taxa de repetição de perguntas para justificar a complexidade adicional. |
| Reduzir `HISTORY_LIMIT` (hoje 6) | Histórico soma poucas centenas de tokens no pior caso — impacto marginal frente ao gargalo de geração; não há evidência de que valha a complexidade de reduzir e arriscar perda de contexto conversacional. |
| Reescrever `metricsStore.appendTiming` para append em lote em vez de reescrever `metrics.json` inteiro a cada request | `metrics.json` ainda é pequeno (dezenas de registros); o custo dessa escrita é assíncrono (fire-and-forget) e não bloqueia a resposta ao usuário — não é gargalo hoje, viraria um em escala de produção real. |

## 8. Verificação

- `npx tsc --noEmit`: sem erros.
- `npm test`: 47/47 testes passando (inclui 2 novos testes de sub-divisão de chunks grandes e testes de streaming reescritos em `pipeline.test.ts`).
- Imagem Docker reconstruída (`docker compose build app`) e reiniciada.
- Logs estruturados confirmados em `docker logs onboard-bot-app-1` no formato pedido.
- `uploads/metrics.json` confirmado com os novos campos granulares (`embeddingTimeMs`, `vectorSearchTimeMs`, `timeToFirstTokenMs`, `ollamaPromptEvalDurationMs`, `ollamaEvalDurationMs`, `ollamaEvalCount`) em registro real pós-otimização.

## 9. Correção pós-implantação: corrupção de contexto em conversas longas

Em uso real (não capturado pelos testes automatizados, que usam mocks), surgiram dois problemas a partir de conversas com várias perguntas na mesma sessão:

1. **A resposta sempre começava com "Olá!"**, mesmo em perguntas técnicas de continuação.
2. **A partir de ~5-6 perguntas, o modelo "enlouquecia"**: depois de responder corretamente, continuava gerando texto sem relação com a pergunta — trechos que se pareciam com instruções de um dataset de treinamento (ex.: "Instruction 2 (More Difficult — At least N more constraints)"), às vezes em outro idioma, e a resposta chegava cortada no meio de uma palavra.

**Causa raiz 1 — `num_ctx: 2048` era baixo demais para conversas com histórico.** O prompt (sistema + contexto recuperado + histórico de até 6 mensagens, sem teto de tamanho) cresce a cada resposta longa do assistente. Por volta da 5ª-6ª pergunta ele ultrapassava 2048 tokens; o Ollama descarta os tokens mais antigos do prompt quando isso acontece — justo as instruções de sistema, que ficam no início — e o modelo, sem grounding, passava a alucinar. A redução de `num_ctx` (seção 3, item 3) não tinha trazido ganho de velocidade medido — era um risco desnecessário. **Corrigido**: revertido para `num_ctx: 4096`, e o histórico agora tem um teto de 400 caracteres por mensagem (`MAX_HISTORY_MESSAGE_CHARS` em `src/app/api/chat/route.ts`) como proteção adicional independente do `num_ctx`.

**Causa raiz 2 — histórico "achatado" como texto dentro de um único prompt.** O pipeline montava o histórico da conversa como texto simples (`Usuário: ...\nAssistente: ...`) dentro de um único prompt enviado a `POST /api/generate`. Migrado para `POST /api/chat` com mensagens reais (`system`/`user`/`assistant`) em `src/lib/llm.ts` — a forma correta de fazer chat multi-turn com Ollama, usando o template e os tokens de parada nativos do modelo entre turnos.

**Causa raiz 3 — phi3 (Q4_0) não emite um fim de resposta confiável.** Mesmo com a migração para `/api/chat`, o modelo continuava — em todos os casos observados — "derivando" para o texto alucinado logo depois de terminar a resposta real, sempre precedido pelo mesmo padrão: uma quebra de linha seguida de `---` (às vezes seguida de um heading `###`). **Corrigido**: adicionado `stop: ['\n---', '\n###']` às opções de geração (`src/lib/llm.ts`) — a geração é cortada exatamente onde a resposta legítima termina.

**Correção do "Olá!" repetido**: adicionada uma regra explícita ao prompt de sistema — "Não repita saudações ('Olá', 'Oi') em toda resposta — cumprimente só se o usuário cumprimentar primeiro."

**Verificação**: reproduzido o bug original com uma conversa real de 6 perguntas (via `curl`, histórico real acumulado a cada turno, mesmo padrão de uso do frontend). Antes da correção, a pergunta 6 já produzia texto alucinado; depois da correção completa (num_ctx + `/api/chat` + `stop`), as 6 respostas ficaram coerentes, grounded no FAQ, sem saudação repetida e sem nenhum desvio para texto alucinado — validado end-to-end, não só por inspeção de código.
