# Devolutiva da revisão do JARVIS — 14/10/2026

O design Órbita aprovado está integrado nas cinco áreas: Início, Investigar, Frota, Integrar e Memória. O HUD usa superfícies escuras, ciano pontual, navegação consistente e seleção sincronizada de veículo e sistema. Os visuais genéricos continuam identificados como representações conceituais; fotos autorizadas e cadastros reais têm prioridade quando disponíveis.

## Cobertura e correções

| Área revisada | Resultado |
| --- | --- |
| APIs, autenticação, banco e migrações | Corpos JSON inválidos retornam 400; limites e autenticação permanecem obrigatórios. Paginação e exportação do histórico preservam também o corte dos eventos de decisão. Nenhuma migração remota foi executada. |
| Pesquisa e evidência documental | Acessórios não viram peças-mãe; códigos explícitos prevalecem; conflitos exigem revisão; devoluções e estornos relacionados impedem confirmações indevidas. Códigos como `2001` não viram períodos. |
| Importação, deduplicação e reversão | Frações decimais são preservadas, KM fracionário é rejeitado, horários distinguem movimentos sem documento. Revisões pendentes incompatíveis exigem nova preparação antes da aprovação, sem reescrever registros. |
| Memória | Evolução documentada para `stock-evidence-4`; snapshots anteriores conservam conteúdo e versão. Comparações e correções continuam sendo novos eventos. |
| Navegação e formulários | Falha de um módulo fica restrita à sua área. Comandos de voz, imagem, código e veículo respeitam consultas em andamento; a ferramenta de pesquisa preserva os critérios efetivamente usados. |
| Componentes compartilhados e acessibilidade | Foco retorna ao elemento que abriu painéis e confirmações; listeners do carrossel são removidos. Foram exercitados teclado, Escape, modais, seleção e cancelamento. |
| Modelos e recursos visuais | Descarte de recursos 3D, cancelamento de carregamento e recuperação de falhas corrigidos; modelo indisponível e origem fictícia são informados corretamente. Não houve validação de um modelo técnico real. |
| Preparação e auditoria de fontes | Catálogos parciais e nomes acentuados são aceitos; quantidade ausente não é saída positiva; datas impossíveis são rejeitadas. O conversor XLSX não arredonda KM fracionário. |
| Dependências, instalação e build | Versões corrigidas e lockfile atualizado com pnpm fixado. Instalação congelada repetível e migrações apenas locais. O alerta upstream restante está descrito em `dependency-review.md`. |

Foram inspecionados o código de aplicação, APIs, bibliotecas, componentes compartilhados, hooks, scripts, configurações, workflow, schemas, migrações, testes e documentação. A inspeção estática das áreas não utilizadas não equivale a testar todas as combinações de componentes no navegador.

## Evidência de validação

- `pnpm check`: auditoria pública, TypeScript, ESLint, **89 testes aprovados** e build do Worker.
- Conversor opcional Python/openpyxl: **1 teste aprovado**, com XLSX fictícios em diretório temporário.
- Navegador com dependências atualizadas: cinco telas em desktop, celular e viewport equivalente ao reflow de 200% (**15 verificações**), sem overflow horizontal da página, erros JavaScript ou solicitações falhas.
- Fluxos de HUD, troca de veículo, consultas, snapshots, comparação, exportação e lista da frota exercitados com a base fictícia local. Bloqueio de controles e cancelamento da voz verificados com uma resposta de API retida.
- Regressões de importação, aprovação, rollback, concorrência, isolamento por usuário e preservação de snapshots cobertas pelas APIs com SQLite em memória; o fluxo de importação também foi exercitado no D1 local durante a integração visual.
- Worker construído iniciado localmente: página principal 200; APIs protegidas 401 sem identidade; entrada de login simulado 404 no build.
- `pnpm audit`: **0 críticos, 1 alto, 0 moderados, 0 baixos**. O alerta alto de `braces`, sem correção disponível, permanece visível; o comando retorna 1.

As verificações não utilizaram os dados nem o banco de produção. Os arquivos de QA e a base fictícia ficam fora do Git público.

## Publicação

O workflow do GitHub valida o código e não faz deploy. A integração no projeto privado deve seguir `publication.md`: aplicar somente o diff aprovado e preservar `public/data/`, fotos autorizadas, D1 e a identidade original de hospedagem.

Neste ambiente não há projeto privado de Sites aberto, ferramenta de publicação vinculada ou autenticação Cloudflare utilizável. `wrangler whoami` confirmou ausência de autenticação; as configurações deste checkout usam a identidade genérica de desenvolvimento. A publicação do site depende desse acesso e precisa ser confirmada no destino real. Build, push ou merge não comprovam publicação.

A configuração reutilizável do ambiente é salva separadamente como rascunho. Publicar o ambiente pelo produto e publicar o site JARVIS são operações distintas; processos locais precisam ser reiniciados em futuras sessões.
