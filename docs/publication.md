# Do GitHub ao site publicado

Push e merge no GitHub **não atualizam automaticamente o JARVIS publicado**. Sites continua hospedando o projeto existente.

1. Desenvolver em branch, validar e revisar o pull request.
2. Abrir a versão mais recente do projeto privado de Sites e conferir alterações concorrentes.
3. Comparar o commit aprovado com o commit de importação inicial. Integrar **somente o diff da mudança**, após revisão; não substituir o projeto inteiro pela cópia pública.
4. Preservar `public/data/`, fotos e cadastros privados, banco D1 e identidade original de `.openai/hosting.json`. A configuração deste GitHub é genérica.
5. Validar contratos, checks e casos relevantes com dados reais e autorização existente; resolver conflitos explicitamente.
6. Executar build, publicar pelo fluxo de Sites e confirmar as áreas afetadas.
7. Registrar o commit GitHub integrado e a versão publicada.

## Migrações e rollback

`drizzle/` contém schemas e migrações, não dumps. Novas migrações precisam de revisão, compatibilidade e estratégia de rollback. Não resetar nem migrar banco remoto ao preparar o Codex.

Antes de mudança crítica, preservar o commit publicado e o backup permitido pela hospedagem. Reverter código pelo histórico de Sites se necessário, sem reinicializar o banco. Importações complementares podem ser revertidas pela operação auditável do aplicativo sem apagar snapshots.

## Automação

O workflow `Validate code` roda auditoria pública, tipos, lint, testes e build. Não tem chaves de produção, não migra dados remotamente e não publica. Deploy automático depende de um fluxo oficialmente suportado e de um destino configurado com os controles necessários.
