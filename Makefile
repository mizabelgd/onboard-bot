.PHONY: dev build start lint type-check test test-watch install clean reset-faq help

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

help:
	@echo "Targets disponíveis:"
	@echo "  dev         Inicia o servidor de desenvolvimento"
	@echo "  build       Compila para produção"
	@echo "  start       Inicia o servidor de produção"
	@echo "  lint        Executa o linter"
	@echo "  type-check  Verifica tipos TypeScript"
	@echo "  install     Instala dependências"
	@echo "  test        Executa todos os testes (modo CI)"
	@echo "  test-watch  Executa testes em modo watch"
	@echo "  clean       Remove o diretório .next"
	@echo "  reset-faq   Remove a FAQ ativa do disco"
