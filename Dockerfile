# Etapa de build — instala dependências e compila o Next.js
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# O modelo HuggingFace é copiado do build context (hf-cache-build/).
# O download é feito no host pelo Makefile antes do docker build,
# evitando instabilidade de rede da camada de virtualização do macOS.
ENV HF_HOME=/app/models
COPY hf-cache-build/ /app/models/

RUN npm run build

# Etapa de produção — imagem mais enxuta sem devDependencies
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
# Aponta para o modelo embutido — sem download em runtime
ENV HF_HOME=/app/models

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/models ./models

# Diretório de uploads montado como volume no docker-compose
RUN mkdir -p uploads

EXPOSE 3000
CMD ["npm", "start"]
