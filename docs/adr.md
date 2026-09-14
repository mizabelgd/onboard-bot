# Decisões Arquiteturais Tomadas

Essa arquitetura foi pensada para proporcionar:

- zero custo
- execução local
- baixa complexidade
- baixa latência
- fácil reprodução acadêmica

## 1. Base de conhecimento estruturada
**Formato:** FAQ.md

**Motivo:**
- elimina parsing complexo
- elimina OCR
- elimina inconsistência semântica
- reduz erro de chunking
- Decisão: chunking semântico por seção

Cada seção = 1 chunk

---

## 2. Embbedings locais
**Tecnologia:** Sentence Transformers

**Modelo:** all-MiniLM-L6-v2

**Motivo:**
- zero custo
- roda local
- leve
- sem API

**Decisão:** biblioteca embutida, não microserviço.

---

## 3. Banco de dados vetorial embbeded
**Tecnologia:** Chroma

**Motivo:**
- persistência local
- zero setup
- sem processo separado

**Decisão:** armazenamento embbeded.

---

## 4. LLM local
**Tecnologia:** Ollama

**Modelo:** Phi-3

**Motivo:**
- zero custo
- inferência offline
- simples instalação

**Decisão:** único componente externo.

---

## 5. Monolito modular
**Tecnologia:** Next.js

**Motivo:**
- frontend + backend juntos
- menos complexidade
- fácil execução local

**Decisão:** facilita desenvolvimento.

---

## 6. RAG Tradicional (Vanilla RAG)
**Requisitos artuiteturais:**
- execução totalmente local
- zero dependência de APIs pagas
- baixa complexidade de implantação
- simplicidade para usuários não técnicos
- facilidade de reprodução em ambiente acadêmico

**Motivo:**
- simplicidade arquitetural
- adequaçao ao domínio
- baixo custo computacional
- reprodutividade acadêmica

**Decisão:** abordagem Vanilla RAG com recuperação vetorial semântica.

**Conclusão:**
Cada entrada FAQ é tratada como um chunk semântico natural.

A geração de embeddings é realizada localmente via Sentence Transformers.

A recuperação vetorial é persistida em Chroma.

A geração de respostas é executada localmente por Ollama.

---

## 7. Estratégia de avaliação da hipótese
**Requisitos arquiteturas:**
- validar a hipótese de que o chatbot melhora o acesso e a qualidade da informação durante o onboarding	

**Motivo:**
- necessidade de avaliação com baixa dependência de participantes humanos
- alinhamento com práticas de avaliação de sistemas de recuperação e geração
- reprodutibilidade do experimento e viabilidade em ambiente acadêmico

**Decisão:** estratégia de avaliação baseada exclusivamente em métricas objetivas, derivadas da execução do sistema sobre um conjunto fixo de perguntas de onboarding.

**Métricas:**

**Latência de resposta (Response Time)**
- **Objetivo:** avaliar eficiência do sistema.

Mede o tempo total de processamento de uma pergunta até a resposta final do chatbot.

> response_time = timestamp_resposta - timestamp_pergunta

---
 
**Precisão de recuperação (Precision@K)**
- **Objetivo:** medir qualidade do retrieval.

Avalia a qualidade do mecanismo de busca vetorial (retrieval), considerando os K documentos recuperados.

> Precision@K = itens relevantes recuperados / K

---
 
**Acurácia de resposta (Answer Accuracy)**
- **Objetivo:** medir corretude das respostas geradas.

A avaliação será binária (correta/incorreta), baseada em equivalência semântica e factual.

> Accuracy = respostas corretas / total de perguntas

**Nota de implementação:** a avaliação semântica ideal depende do benchmark com resposta esperada (ground truth) descrito na seção 9, que ainda não foi construído. Enquanto isso, a acurácia é aproximada **automaticamente**, a partir dos mesmos dados coletados em cada interação real (sem depender de feedback manual do usuário): uma resposta é considerada correta quando o retrieval encontrou contexto relevante **e** a resposta de fato se apoiou nesse contexto.

> Accuracy (proxy automático) = respostas com (retrieval bem-sucedido E contexto utilizado) / total de respostas avaliadas

A meta mínima (seção 10) permanece ≥ 80% para essa aproximação.

---
 
**Taxa de falha de recuperação (Failed Retrieval Rate)**
- **Objetivo:** avaliar cobertura da base de conhecimento.

Mede a frequência em que o sistema não consegue recuperar contexto relevante da base de conhecimento.

> FRR = consultas sem contexto relevante / total de consultas

---
 
**Taxa de alucinação (Hallucination Rate)**
- **Objetivo:** avaliar fidelidade ao contexto (groundedness).

Mede a proporção de respostas que contêm informações não suportadas pelos documentos recuperados.

> HR = respostas com informação não suportada / total de respostas

---
 
**Taxa de uso adequado do contexto (Context Utilization Rate)**
- **Objetivo:** medir aderência ao RAG (grounding).

Mede se a resposta gerada utiliza efetivamente informações presentes no contexto recuperado.

> CUR = respostas suportadas pelo contexto / total de respostas

---

## 8. Estratégia de observabilidade e coleta de métricas
**Requisitos artuiteturais:**
- sistema precisa gerar dados objetivos para suportar a avaliação do chatbot e validar a hipótese de apoio ao onboarding.

**Motivo:**
- automatiza coleta de métricas
- facilita auditoria do pipeline
- suporta experimentos reproduzíveis
- reduz dependência de avaliação manual

**Decisão:** estratégia de observabilidade baseada em logs estruturados locais, armazenados automaticamente a cada interação.

**Conclusão:**

Cada execução do chatbot deverá registrar:
- pergunta enviada
- tempo de resposta
- chunks recuperados
- resposta gerada
- score de similaridade
- indicadores de falha de recuperação

Exemplo:
```json
{
    "question": "...",
    "response": "...",
    "latency_ms": 1200,
    "retrieved_chunks": [...],
    "similarity_scores": [...],
    "retrieval_failed": false
}
```

---

## 9. Estratégia de construção do benchmark de avaliação
**Motivo:**

O benchmark padroniza a avaliação e permite medir:
- acurácia
- precisão de retrieval
- groundedness
- alucinação

**Decisão:** estratégia de observabilidade baseada em logs estruturados locais, armazenados automaticamente a cada interação.

**Conclusão:**

Cada item do benchmark deve conter:
- pergunta
- resposta esperada (ground truth)
- chunks relevantes esperados

Exemplo:
```json
{
    "question": "...",
    "expected_answer": "...",
    "relevant_chunks": [...]
}
```

---

## 10. Critérios mínimos de aceitabilidade
**Decisão:**

Foram definidos os seguintes critérios mínimos:
- Acurácia mínima >= 80%
- Precision@K mínima >= 75%
- Taxa máxima de alucinação <= 10%
- Taxa máxima de falha de recuperação <= 15%
- Latência máxima por resposta <= 3 segundos	

**Conclusão:**
A hipótese será considerada sustentada se os resultados permanecerem dentro dos limites definidos.