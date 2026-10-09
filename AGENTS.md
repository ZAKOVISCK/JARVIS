# JARVIS — instruções para agentes

## Escopo

Este repositório contém o código, não os registros operacionais. O site e o banco publicados continuam no projeto privado de Sites. Trabalhe em uma branch por mudança e apresente testes em um pull request. Um push não publica o site.

## Ambiente

- Node.js 24 e pnpm 11.25.0. Preserve a tecnologia e `pnpm-lock.yaml`.
- `pnpm install --frozen-lockfile` e `pnpm setup`: exemplos fictícios, OCR e migrações **somente ao D1 local**.
- `pnpm check`: auditoria pública, tipos, lint, testes e build.
- `pnpm dev`: preview local. Login simulado apenas em loopback, sem bypass de produção.
- `pnpm start` executa o Worker construído localmente, sem simular login ou fazer deploy.

## Regras

- Frota 001–559, normalizada para 55001–55559. Excluir 800, 900 e prefixos externos.
- Última saída validada exige documento, origem rastreável, posição, quantidade positiva, data válida e comprovação de saída. Preserve `stock-evidence-3` até justificar e testar uma evolução.
- Saída de estoque não comprova instalação. Não inferir KM, data, responsável ou código ausente.
- Devoluções e estornos associados invalidam a saída correspondente; ambiguidades e empates precisam ficar explícitos.
- Cada consulta preserva seu snapshot. Comparações e correções são novos eventos; não sobrescrever memória.
- Importação exige revisão e aprovação. Preserve deduplicação concorrente, quarentena, auditoria e reversão.
- Não enviar dados reais, dumps, planilhas, segredos ou relatórios internos ao Git público. `.gitignore` não protege arquivos já rastreados: confira `pnpm audit:public` e o diff.
- Não importar o histórico Git da produção: pode conter dados reais.

## Interface

- Identidade Órbita: futurismo leve, ciano pontual, superfícies escuras, tipografia legível e foco visível sem contorno branco excessivo.
- Preservar início, investigação, frota, integração, memória e aliases de rotas por hash.
- Validar responsividade e zoom até 200% quando houver preview autorizado. Não declarar QA visual pelo build.
- Manter aviso dos exemplos fictícios. Não apresentar modelos genéricos como tecnicamente exatos.

## Publicação

Siga `docs/development.md`, `docs/data-contracts.md` e `docs/publication.md`. O workflow valida código e não faz deploy. Preserve dados, configuração e fotos autorizadas do projeto privado ao integrar alterações.
