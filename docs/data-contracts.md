# Dados e contratos

O Git público contém código, estilos, recursos conceituais, schemas, migrações, regras, testes e documentação. Planilhas, registros derivados, histórico pessoal e relatórios administrativos reais permanecem no projeto privado.

O sistema usa arquivos estruturados na base principal e D1 para importações complementares, consultas e auditoria. Excluir planilhas não basta: todo `public/data/` também está fora do Git.

| Arquivo privado ou gerado | Contrato |
| --- | --- |
| `summary.json` | Fontes, contagens e cadastro resumido |
| `<código>.json` | Veículo, serviços e peças |
| `catalog.json` | Materiais, aliases e peças-mãe |
| `source-manifest.json` | Versão, documento e hashes |
| `cognitive-index.json` | Sistemas e recorrências |
| `admin-audit.json` | Duplicidades, retornos, estornos e integridade |

Peças: `[data, OS, KM, material, quantidade, responsável do almoxarifado, posição, família, documento, horário?]`.

Serviços: `[data, ficha, responsável, providência, ocorrência, defeito alegado, posição, OS]`.

Não alterar posições sem migrar leitores, exportações e testes. O responsável do almoxarifado não confirma quem instalou a peça.

## Exemplos e fontes reais

`prepare-demo-data.mjs` cria cenários explícitos sem ler fonte real. Veículos, placas, documentos, quantidades e KM são fictícios. Marcas e modelos comerciais são rótulos de teste, sem identificar cadastro real. Códigos sintéticos a partir de 900001 não expressam compatibilidade.

`datasetMode: "synthetic"` e o aviso na interface identificam os exemplos. `tests/fixtures/standardized-parts.json` contém somente nomes, famílias e aliases aprovados, sem códigos reais.

Para testes futuros com dados operacionais, disponibilizar a base completa em ambiente privado autorizado, sem versionar no Git público. Preservar backup, acesso e auditoria. Este repositório não provisiona API privada nova nem exporta D1 de produção.

Nunca copiar a base fictícia para produção. O gerador recusa diretórios existentes sem identificação fictícia.
