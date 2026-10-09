# Desenvolvimento com Codex

1. Conecte `ZAKOVISCK/JARVIS` ao ambiente Codex e selecione o repositório.
2. Disponibilize Node.js 24, pnpm 11.25.0 e Git. Autorize as fontes das dependências se a instalação precisar de rede.
3. Execute `pnpm install --frozen-lockfile` e `pnpm setup`.
4. Confirme `pnpm check` antes e depois de uma mudança relevante.

Não são necessárias planilhas operacionais nem credenciais de produção para esses testes.

## Operação local

`pnpm dev` inicia em `http://localhost:5173`. Nesse endereço, acesse `/signin-with-chatgpt?return_to=/` para usar a identidade local fictícia. A simulação verifica host e endereço loopback e não existe no build de produção. Preview remoto precisa de autenticação apropriada; não liberar login simulado para domínios externos.

`pnpm setup` gera os exemplos apenas quando não há outra base em `public/data/`, prepara OCR das dependências fixadas e aplica migrações ao D1 local. Não há operação `--remote`. Estado local em `.wrangler/state/` é ignorado pelo Git. Os testes das APIs usam SQLite em memória; não gravam no banco publicado.

| Comando | Finalidade |
| --- | --- |
| `pnpm setup` | Exemplos, OCR e D1 local |
| `pnpm data:demo` | Gerar exemplos sem sobrescrever outra base |
| `pnpm dev` | Desenvolvimento local |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Regressões e APIs isoladas |
| `pnpm build` | Build do Worker |
| `pnpm audit:public` | Conferir o índice Git |
| `pnpm check` | Todas as verificações |

`pnpm start` é preview local do build, sem login simulado nem deploy. Conversores de planilhas exigem Python e `openpyxl` no ambiente privado; não são necessários para exemplos.

Crie uma branch por alteração. O pull request deve descrever o problema, a mudança, testes e limitações. Layout exige verificação visual quando disponível; não declarar validação visual apenas pelo build. Mudanças de dependências ou esquema precisam de justificativa e rollback.
