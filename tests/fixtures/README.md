# Dados fictícios

Os nomes e aliases em `standardized-parts.json` são as regras de padronização das peças-mãe. Não contém códigos de almoxarifado, documentos ou registros operacionais.

`pnpm data:demo` gera sete veículos fictícios em `public/data/`, com códigos de materiais a partir de 900001, placas DEMO, documentos DEMO e responsáveis DEMO. O diretório gerado é ignorado pelo Git. Nenhum arquivo de planilha é lido.

Os testes de API usam um SQLite em memória, identidades de teste e cenários explícitos de devolução, estorno, duplicidade, falta de evidência e quarentena. A injeção de dependências existe apenas no harness de testes.

A interface identifica a base gerada como fictícia. Os números exibidos nessa base não representam o JARVIS publicado.
