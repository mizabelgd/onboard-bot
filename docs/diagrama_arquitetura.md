# Diagrama de Arquitetura

A arquitetura da aplicação onBoard Bot foi representada no modelo C4.

## C1 - Contexto - Visão Macro

**Objetivo**: Mostrar quem usa e quais sistemas externos existem.


```mermaid
C4Context
    Person(user, "Usuário", "Carrega documentos markdown e faz perguntas para o chat.")

    Enterprise_Boundary(localMachine, "Máquina local do usuário") {

        System(onboardBot, "OnBoard Bot", "Chatbot local baseado em documentos utilizando RAG.")

        System_Ext(ollama, "Ollama", "Executa inferência de LLM local.")
    }

    Rel(user, onboardBot, "Utiliza")
    Rel(onboardBot, ollama, "Envia prompts / Recebe respostas")
```

---

## C2 - Container - Componentes Executáveis

**Objetivo:** Mostrar a arquitetura da aplicação.

```mermaid
C4Container

Person(user, "Usuário", "Carrega documentos markdown e faz perguntas para o chat.")

Enterprise_Boundary(machine, "Máquina local do usuário") {

    System_Boundary(onboard, "OnBoard Bot") {

        Container(frontend, "Frontend UI", "Next.js + HTML + Tailwind CSS", "Interface do usuário para chat e upload da base de conhecimento.")

        Container(api, "Backend API", "Next.js API Routes", "Gerencia requisições como uploads de documentos e solicitações do chat.")

        Container(storage, "Armazenamento Local", "Armazenamento de arquivos", "Armazena os documentos carregados.")

        Container(rag, "Orquestrador RAG", "LangChain", "Coordena o pipeline de recuperação (retrieval) e geração.")

        ContainerDb(chroma, "Banco Vetorial", "Chroma", "Armazena os embeddings dos documentos.")

        ContainerDb(metrics, "Armazenamento de Métricas", "JSON", "Armazena logs e resultados de benchmark localmente.")
    }

    System_Ext(ollama, "Ollama Runtime", "Executa modelos localmente.")

}

Rel(user, frontend, "Interage")
Rel(frontend, api, "Requisições HTTP")

Rel(api, storage, "Lê/Salva documentos")
Rel(api, rag, "Invoca")
Rel(api, metrics, "Lê métricas de avaliação")

Rel(rag, chroma, "Armazena/Consulta embeddings")
Rel(rag, metrics, "Armazena logs de execução")
Rel(rag, ollama, "Envia contexto + prompt")
```

---

## C3 - Componente - Lógica Interna de Ingestão

**Objetivo:** Mostrar pipeline de ingestão RAG.

```mermaid
C4Component

ContainerDb(chroma, "ChromaDB", "Banco Vetorial", "Armazena os embeddings dos documentos")

Container_Boundary(rag, "Orquestrador RAG - OnBoard Bot") {

    Component(loader, "Carregador de Documentos", "FileReader", "Suporta documentos markdown (.md)")

    Component(parser, "Parser de Texto (Splitter)", "Analisador (Parser)", "Separa por cabeçalhos e blocos de perguntas e respostas")

    Component(embedder, "Gerador de Embeddings", "Sentence Transformers (LangChain)", "Gera vetores de embedding")

    Component(writer, "Escritor de Vetores", "Cliente Chroma", "Persiste os vetores de embeddings")
}

Rel(loader, parser, "Lê arquivo markdown")
Rel(parser, embedder, "Passa os chunks")
Rel(embedder, writer, "Passa os embeddings")
Rel(writer, chroma, "Armazena")
```

---

## C3 - Componente - Lógica Interna de Pergunta

**Objetivo:** Mostrar pipeline de pergunta/resposta.

```mermaid
C4Container

Person(user, "Usuário", "Carrega documentos markdown e faz perguntas para o chat.")

Enterprise_Boundary(machine, "Máquina local do usuário") {

    System_Boundary(rag, "Orquestrador RAG - onBoard Bot") {

        Container(queryEmbedding, "Gerador de Embedding da Pergunta", "Sentence Transformers", "Gera o embedding da pergunta do usuário.")

        Container(retriever, "Retriever de Similaridade", "Chroma", "Retorna os top-k chunks relevantes.")

        Container(contextBuilder, "Gerador de Contexto", "LangChain", "Organiza os chunks recuperados e gera o contexto para enviar ao LLM.")

        Container(promptBuilder, "Gerador de Prompt", "Engine de Template", "Gera o prompt final que será enviado ao LLM com contexto, instruções e a pergunta do usuário.")

        Container(llmGateway, "Gerador LLM", "Ollama", "Solicita a geração da resposta ao LLM.")

        Container(logger, "Registrador Log de Métricas", "Next.js", "Armazena dados de execução.")

        ContainerDb(chroma, "ChromaDB", "Banco de Dados Vetorial", "Armazena os embeddings dos documentos.")

        ContainerDb(metrics, "Armazenamento de Métricas", "JSON", "Armazena logs e resultados de benchmark localmente.")
    }

    System_Ext(ollama, "Ollama Runtime", "Inferência local.")
}

Rel(user, queryEmbedding, "Envia pergunta")
Rel(queryEmbedding, retriever, "Embeda a pergunta")
Rel(retriever, chroma, "Consulta")
Rel(retriever, contextBuilder, "Passa o texto")
Rel(contextBuilder, promptBuilder, "Retorna os chunks")
Rel(promptBuilder, llmGateway, "Envia prompt")
Rel(llmGateway, ollama, "Executa inferência")
Rel(ollama, llmGateway, "Retorna resposta")
Rel(llmGateway, logger, "Retorna resposta")
Rel(retriever, logger, "Registra log dos chunks retornados")
Rel(logger, metrics, "Armazena métricas")
```

---

## C4 - Deployment - Reprodutividade

**Objetivo:** Mostrar execução local da aplicação.

```mermaid
C4Container

Enterprise_Boundary(machine, "Máquina local do usuário") {

    System_Boundary(docker, "Docker Compose") {

        Container(app, "Aplicação Next.js", "Node.js", "Frontend + Backend + Orquestrador RAG")

        Container(ollama, "Ollama Runtime", "LLM Runtime", "LLMs executando localmente.")
    }

    System_Boundary(storage, "Armazenamento Local") {

        Container(files, "Pasta dos Documentos Carregados", "Armazenamento de arquivos", "Armazena documentos carregados pelo usuário.")

        ContainerDb(chroma, "Chroma DB", "Banco de Dados Vetorial", "Persistência local dos dados vetoriais (embeddings).")
    }
}

Rel(app, ollama, "Solicita inferência")
Rel(app, files, "Armazena/Lê documentos")
Rel(app, chroma, "Armazena/Consulta embeddings")
```