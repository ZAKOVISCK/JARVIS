# JARVIS — Cognitive Maintenance OS

Código do sistema de investigação e memória técnica de manutenção de frotas. Identidade visual **Órbita**. Cópia preparada para desenvolvimento com Codex; dados operacionais e site publicado continuam separados.

## Executar

Requisitos: **Node.js 24**, **pnpm 11.25.0** e Git.

```sh
pnpm install --frozen-lockfile
pnpm setup
pnpm dev
```

Acesse `http://localhost:5173` e, para consultas e histórico local, `/signin-with-chatgpt?return_to=/` nesse endereço. Login fictício apenas em loopback, sem acesso à produção.

`pnpm setup` prepara a base fictícia identificada na interface, OCR e D1 local com as migrações existentes. Não lê planilhas reais, não acessa o banco publicado e não sobrescreve bases sem identificação fictícia.

## Áreas

| Área | Rotas compatíveis | Função |
| --- | --- | --- |
| Início | `#inicio` | Sistemas do veículo e comando contextual |
| Investigar | `#consultar`, `#investigar`, `#consulta` | Pergunta livre, família → peça, busca direta e lote |
| Frota | `#frota` | Atlas, lista acessível, filtros e veículo |
| Integrar | `#importar`, `#integrar` | Prévia, conciliação, aprovação, quarentena e reversão |
| Memória | `#historico`, `#memoria` | Consultas preservadas, manutenção e comparação temporal |

Saída validada exige evidência documental e não comprova instalação. Não inferir datas, KM, códigos ou responsáveis ausentes. Cada consulta preserva o resultado daquele momento.

## Verificações

```sh
pnpm check
```

Auditoria do índice público, TypeScript, ESLint, testes e build. Os testes exercitam saídas, lotes, devoluções, estornos, importação, deduplicação, autorização, snapshots e comparação com cenários fictícios e SQLite em memória. O workflow GitHub executa os checks em push e pull request, sem deploy.

## Arquitetura

- React 19, TypeScript, Vinext e Vite.
- Cloudflare Worker, D1 e Drizzle.
- `app/`: shell, estilos e APIs.
- `components/cognitive/`: central, Atlas, integração, evidências e memória.
- `components/jarvis/`: pesquisa e histórico.
- `lib/`: validação, interpretação, catálogo, importação e snapshots.
- `db/` e `drizzle/`: schemas e migrações; nenhum registro de produção.
- OCR local com Tesseract e idioma português, preparado das dependências fixadas.
- Voz e leitura de códigos dependem das capacidades e permissões do navegador.
- 3D progressivo: registro de modelos técnicos vazio; fallback acessível e ilustrações explicitamente conceituais.

## Dados e publicação

`public/data/`, planilhas, dumps, relatórios internos, estado local, segredos e fotos vinculadas ao cadastro real estão fora do Git. O histórico Git da produção não foi importado.

Inclui imagens conceituais, ícones e estilos. O registro de fotos reais está vazio nesta cópia. Os registros e fotos do site publicado permanecem no projeto privado.

**Alterar o GitHub não atualiza automaticamente o site.** Integre o diff aprovado ao projeto privado de Sites, preserve os dados e a configuração, valide e publique pelo procedimento documentado.

- [Desenvolvimento e Codex](docs/development.md)
- [Contratos e separação de dados](docs/data-contracts.md)
- [Procedimento de publicação](docs/publication.md)
- [Instruções para agentes](AGENTS.md)

Não há licença geral concedida para o projeto. Dependências e recursos de terceiros mantêm suas próprias licenças. Recursos conceituais de ônibus não representam modelos mecânicos exatos.
