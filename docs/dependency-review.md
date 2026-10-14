# Revisão das dependências — 14/10/2026

A auditoria inicial do lockfile encontrou 62 alertas: 1 crítico, 30 altos, 23 moderados e 8 baixos. Após atualizações pontuais, a auditoria completa encontrou 1 alerta alto e nenhum crítico, moderado ou baixo. O comando `pnpm audit` continua retornando código 1 pelo alerta restante; isso não é apresentado como aprovação integral de segurança.

## Correções

- Next e sua configuração ESLint: `16.3.4` → `16.3.8`.
- React, React DOM e React Server DOM Webpack: `19.2.6` → `19.2.8`.
- Vite: `8.0.13` → `8.0.16`; sharp: `0.35.4` → `0.35.5`.
- Overrides limitados às faixas vulneráveis corrigem dependências transitivas de esbuild, Babel, browserslist, baseline-browser-mapping, image-size, fflate, source-map-js, js-yaml, brace-expansion, fast-uri, undici e ws.

As versões foram conferidas no registro oficial e publicadas há mais de sete dias. A instalação congelada usa pnpm `11.25.0`; idade mínima, verificação de integridade, TLS e política de scripts de build foram preservadas. O lockfile foi atualizado, sem trocar a tecnologia do projeto.

O alerta crítico corrigido em Next afetava `next/og`. Não foi localizada uma rota ativa usando `ImageResponse` ou `next/og`. React Server DOM Webpack aparece no Worker construído, apesar de ser declarado como dependência de desenvolvimento; a auditoria apenas de produção não cobre toda a superfície do bundle. O projeto não declara Server Actions atualmente. Essas observações limitam a exposição identificada, mas não dispensaram as correções.

## Alerta sem correção disponível

[`GHSA-vfj7-8cjw-p6xm`](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) afeta `braces <= 3.0.3`: padrões de glob profundamente aninhados podem esgotar a pilha. A fonte oficial não informa versão corrigida.

Os caminhos encontrados são `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` e `vinext → vite-plugin-commonjs → vite-plugin-dynamic-import → fast-glob → micromatch → braces`. São ferramentas de lint e build que processam padrões do código do projeto. Nenhuma chamada da aplicação encaminha consultas, CSVs ou uploads do usuário para esses glob matchers. A inspeção dos módulos JavaScript construídos não encontrou caminhos de `braces`, `micromatch` ou `fast-glob`, nem os marcadores de implementação pesquisados; essa inspeção estática não substitui uma análise formal do bundle.

O alerta permanece visível e sem supressão. Não executar builds de código não confiável no ambiente de produção e acompanhar a correção upstream. Esta revisão é uma análise dos caminhos encontrados e testes do projeto, não uma garantia de ausência de vulnerabilidades.
