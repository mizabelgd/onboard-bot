export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OnboardBot API',
    description:
      'API de um chatbot baseado em FAQ com RAG (Retrieval-Augmented Generation) para suporte ao onboarding de desenvolvedores.',
    version: '1.0.0',
  },
  servers: [{ url: '/api', description: 'Servidor local' }],
  tags: [
    { name: 'faq', description: 'Gestão da FAQ ativa' },
    { name: 'chat', description: 'Pipeline RAG de perguntas e respostas' },
  ],
  paths: {
    '/faq/upload': {
      post: {
        tags: ['faq'],
        summary: 'Faz upload e indexa um arquivo FAQ',
        description:
          'Recebe um arquivo Markdown, divide em chunks por headings `##`, gera embeddings via `all-MiniLM-L6-v2` (HuggingFace Transformers / ONNX) e persiste no ChromaDB.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Arquivo Markdown (.md) com seções separadas por `##`',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'FAQ indexada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UploadResponse' },
                example: { success: true, chunkCount: 12, filename: 'FAQ.md' },
              },
            },
          },
          '400': {
            description: 'Requisição inválida (sem arquivo, extensão errada, sem headings ##)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  sem_arquivo: { value: { error: 'Nenhum arquivo enviado.' } },
                  extensao_invalida: { value: { error: 'Apenas arquivos .md são aceitos.' } },
                  sem_headings: {
                    value: { error: 'O arquivo não contém nenhum heading ## para indexar.' },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Erro interno ao processar o arquivo',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/faq': {
      get: {
        tags: ['faq'],
        summary: 'Retorna a FAQ ativa e o status do índice',
        description:
          'Lê o arquivo `uploads/current-faq.md` do disco e retorna seu conteúdo junto com os metadados do vector store em memória. O conteúdo pode existir no disco enquanto `status.loaded` é `false` após um restart do servidor — nesse caso o chatbot não está pronto e é necessário refazer o upload.',
        responses: {
          '200': {
            description: 'Estado atual da FAQ',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FAQResponse' },
                examples: {
                  com_faq: {
                    value: {
                      content: '## Como solicitar acesso?\n\nAbra um chamado no Jira...',
                      status: {
                        loaded: true,
                        filename: 'FAQ.md',
                        indexedAt: '2024-01-15T10:30:00.000Z',
                        chunkCount: 12,
                      },
                    },
                  },
                  sem_faq: {
                    value: { content: '', status: { loaded: false } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/chat': {
      post: {
        tags: ['chat'],
        summary: 'Executa o pipeline RAG completo',
        description:
          'Recebe uma mensagem e o histórico da conversa. Gera o embedding da pergunta via all-MiniLM-L6-v2, recupera os top-K chunks mais relevantes no ChromaDB (similaridade de cosseno), monta um prompt RAG e envia ao Ollama (phi3) para geração da resposta em streaming (NDJSON).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ChatRequest' },
              example: {
                message: 'Como configuro o ambiente local?',
                history: [
                  { id: '1', role: 'user', content: 'Olá!', timestamp: '2024-01-15T10:00:00Z' },
                  {
                    id: '2',
                    role: 'assistant',
                    content: 'Olá! Como posso ajudar?',
                    timestamp: '2024-01-15T10:00:01Z',
                  },
                ],
              },
            },
          },
        },
        responses: {
          '200': {
            description:
              'Stream NDJSON (uma linha = um evento JSON): zero ou mais eventos {"type":"chunk","text":"..."} com pedaços da resposta gerada, seguidos de um evento final {"type":"done","messageId","retrievedChunks","timing"} — ou {"type":"error","error"} em caso de falha durante a geração.',
            content: {
              'application/x-ndjson': {
                schema: { $ref: '#/components/schemas/ChatStreamEvent' },
                example:
                  '{"type":"chunk","text":"Para "}\n{"type":"chunk","text":"configurar..."}\n{"type":"done","messageId":"abc123","retrievedChunks":["Como configurar o ambiente local?"],"timing":{"messageId":"abc123","retrievalTimeMs":140,"generationTimeMs":8500,"totalTimeMs":8650}}',
              },
            },
          },
          '400': {
            description: 'Mensagem vazia ou nenhuma FAQ carregada no vector store',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                examples: {
                  mensagem_vazia: { value: { error: 'Mensagem não pode ser vazia.' } },
                  sem_faq: {
                    value: {
                      error: 'Nenhuma FAQ carregada. Faça o upload de um arquivo .md primeiro.',
                    },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Erro interno ao processar a mensagem',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      UploadResponse: {
        type: 'object',
        required: ['success', 'chunkCount', 'filename'],
        properties: {
          success: { type: 'boolean', example: true },
          chunkCount: {
            type: 'integer',
            description: 'Número de seções (chunks) indexadas',
            example: 12,
          },
          filename: { type: 'string', example: 'FAQ.md' },
        },
      },
      FAQStatus: {
        type: 'object',
        required: ['loaded'],
        properties: {
          loaded: {
            type: 'boolean',
            description: 'Indica se o vector store está pronto para responder perguntas',
          },
          filename: { type: 'string', example: 'FAQ.md' },
          indexedAt: {
            type: 'string',
            format: 'date-time',
            example: '2024-01-15T10:30:00.000Z',
          },
          chunkCount: { type: 'integer', example: 12 },
        },
      },
      FAQResponse: {
        type: 'object',
        required: ['content', 'status'],
        properties: {
          content: {
            type: 'string',
            description: 'Conteúdo Markdown da FAQ ativa (string vazia se nenhuma FAQ foi carregada)',
          },
          status: { $ref: '#/components/schemas/FAQStatus' },
        },
      },
      Message: {
        type: 'object',
        required: ['id', 'role', 'content', 'timestamp'],
        properties: {
          id: { type: 'string', example: 'abc123' },
          role: { type: 'string', enum: ['user', 'assistant'] },
          content: { type: 'string', example: 'Como configuro o ambiente?' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ChatRequest: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', description: 'Pergunta atual do usuário', example: 'Como configuro o ambiente local?' },
          history: {
            type: 'array',
            items: { $ref: '#/components/schemas/Message' },
            description: 'Últimas mensagens da sessão (cliente envia até HISTORY_LIMIT itens)',
            default: [],
          },
        },
      },
      ChatStreamEvent: {
        description: 'Uma linha do stream NDJSON retornado por POST /chat.',
        oneOf: [
          {
            type: 'object',
            required: ['type', 'text'],
            properties: {
              type: { type: 'string', enum: ['chunk'] },
              text: { type: 'string', description: 'Pedaço de texto gerado pelo Ollama' },
            },
          },
          {
            type: 'object',
            required: ['type', 'messageId', 'retrievedChunks', 'timing'],
            properties: {
              type: { type: 'string', enum: ['done'] },
              messageId: { type: 'string' },
              retrievedChunks: {
                type: 'array',
                items: { type: 'string' },
                description: 'Headings dos chunks utilizados como contexto (para debug e transparência)',
                example: ['Como configurar o ambiente local?', 'Requisitos do sistema'],
              },
              timing: {
                type: 'object',
                properties: {
                  messageId: { type: 'string' },
                  retrievalTimeMs: { type: 'number' },
                  generationTimeMs: { type: 'number' },
                  totalTimeMs: { type: 'number' },
                },
              },
            },
          },
          {
            type: 'object',
            required: ['type', 'error'],
            properties: {
              type: { type: 'string', enum: ['error'] },
              error: { type: 'string' },
            },
          },
        ],
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', example: 'Mensagem de erro descritiva.' },
        },
      },
    },
  },
}
