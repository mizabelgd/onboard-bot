.PHONY: dev build start lint type-check test test-watch install clean reset-faq docker-setup docker-pull docker-dev docker-stop docker-logs help

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

type-check:
	npx tsc --noEmit

test:
	npm test

test-watch:
	npm run test:watch

install:
	npm install

clean:
	rm -rf .next

reset-faq:
	rm -f uploads/current-faq.md

## ── Docker ─────────────────────────────────────────────────────────────────

## Primeira execução: baixa o modelo phi3 e sobe todos os serviços
docker-setup: docker-pull docker-dev

## Baixa o modelo phi3 no Ollama (necessário apenas uma vez por volume)
docker-pull:
	docker compose up -d ollama
	@echo "Aguardando Ollama iniciar..."
	@sleep 8
	docker compose exec ollama ollama pull phi3

## Build da imagem da aplicação
docker-build:
	docker compose build

## Sobe todos os serviços Docker
docker-dev:
	docker compose up

## Para e remove os containers (volumes são preservados)
docker-stop:
	docker compose down

## Logs de todos os serviços Docker
docker-logs:
	docker compose logs -f

## ── Help ────────────────────────────────────────────────────────────────────

help:
	@echo "Targets disponíveis:"
	@echo "  dev           Inicia o servidor de desenvolvimento local"
	@echo "  build         Compila para produção"
	@echo "  start         Inicia o servidor de produção"
	@echo "  lint          Executa o linter"
	@echo "  type-check    Verifica tipos TypeScript"
	@echo "  install       Instala dependências"
	@echo "  test          Executa todos os testes (modo CI)"
	@echo "  test-watch    Executa testes em modo watch"
	@echo "  clean         Remove o diretório .next"
	@echo "  reset-faq     Remove a FAQ ativa do disco"
	@echo "  docker-setup  Primeira execução Docker (baixa phi3 + sobe serviços)"
	@echo "  docker-pull   Baixa o modelo phi3 no Ollama"
	@echo "  docker-dev    Sobe todos os serviços Docker"
	@echo "  docker-stop   Para os containers Docker"
	@echo "  docker-logs   Mostra logs dos serviços Docker"
