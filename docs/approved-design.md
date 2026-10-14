# Integração das prévias Órbita

As cinco prévias aprovadas orientam uma interface implementada com componentes reais, CSS e conectores SVG. Os painéis continuam usando os registros e estados retornados pela aplicação; contagens, datas e resultados das imagens não foram copiados para o código.

| Área | Composição |
| --- | --- |
| Início | Identidade e sistemas à esquerda, ilustração com HUD e comando no centro, evidências e memória à direita. |
| Investigar | Pergunta e critérios acima do contexto do veículo, registros de origem e resultado preservado. |
| Frota | Agrupamentos cadastrais conectados e lista virtualizada ao lado da ficha do veículo selecionado. |
| Integrar | Etapas, conferência de registros, duplicados e quarentena, com aprovação explícita em painel próprio. |
| Memória | Consultas cronológicas imutáveis e comparação de duas consultas lado a lado. |

O cabeçalho, a navegação, as superfícies escuras, os detalhes em ciano e os estados de foco são compartilhados. No celular, as colunas se reorganizam e a navegação fica no rodapé. Informações complementares permanecem disponíveis em abas e controles expansíveis.

## Ilustrações e dados

`public/visuals/jarvis-bus-orbita-cutaway.png` e `public/visuals/jarvis-bus-orbita-exterior.png` foram geradas a partir das referências aprovadas. São ilustrações genéricas; não demonstram arquitetura mecânica, identidade, instalação ou compatibilidade de peças. Fotos autorizadas registradas continuam tendo prioridade na ficha e no contexto do veículo.

O ambiente local usa os exemplos fictícios de `pnpm setup`. A integração não modifica bases operacionais, regras de validação de saída, snapshots, esquema do banco ou lockfile. Agrupamentos da frota usam os campos cadastrais disponíveis, em vez de categorias inventadas a partir da imagem.

## Validação

Preparação: Node.js 24, pnpm 11.25.0, `pnpm install --frozen-lockfile`, `pnpm setup` e `pnpm check`. A auditoria pública, TypeScript, ESLint, testes e build devem passar antes da integração no projeto publicado.

As verificações no Chromium local incluem seleção dos sistemas e veículos, buscas com documento de origem, abertura das evidências, snapshots, comparação e exportação do histórico, importação com deduplicação/quarentena, aprovação humana, publicação local e reversão sem alterar o snapshot anterior.

As capturas e relatórios de desenvolvimento ficam em `outputs/` (ignorado pelo Git). O layout foi inspecionado em desktop, celular e largura equivalente a zoom de 200% (836 pixels CSS e DPR 2 para um viewport físico de aproximadamente 1672 pixels). Essa verificação cobre reorganização do layout; não certifica o atalho de zoom nativo do navegador.

Dois problemas anteriores, encontrados durante a verificação real, também foram corrigidos: a chamada de `fetch` dos veículos preserva seu contexto global, e o host interno do binding `ASSETS` é permitido explicitamente no Vite local. Hosts desconhecidos continuam bloqueados e a busca continua exigindo autenticação.

## Publicação

Siga `docs/publication.md`: integrar somente o diff revisado no projeto privado de Sites, preservando dados, fotos autorizadas, identidade de hospedagem e banco existentes. Commit, push e merge não publicam o site automaticamente.
