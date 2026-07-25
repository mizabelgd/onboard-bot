# Etapa de build — instala dependências e compila o Next.js
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa de produção — imagem mais enxuta sem devDependencies
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia artefatos do build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

# Diretório de uploads montado como volume no docker-compose
RUN mkdir -p uploads

EXPOSE 3000
CMD ["npm", "start"]
