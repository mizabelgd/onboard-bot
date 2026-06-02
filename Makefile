.PHONY: dev build start lint type-check install clean reset-faq help

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
	@echo "  clean       Remove o diretório .next"
	@echo "  reset-faq   Remove a FAQ ativa do disco"
