# Preparação da cópia pública — 09/10/2026

O código foi extraído da versão atual do projeto privado para um histórico Git novo. Nenhum commit antigo, planilha, arquivo de registros operacionais, dump de D1, relatório interno ou foto identificada de veículo foi incluído.

Foram preservados componentes, estilos Órbita, ícones, recursos conceituais, APIs, regras, schemas, migrações e dependências fixadas. O registro público de fotografias fica vazio; o site privado mantém seu registro original.

Adicionados: README do produto, AGENTS.md, documentação de desenvolvimento, contratos de dados e publicação, geração segura de exemplos fictícios, preparação reproduzível de OCR, setup de D1 local, auditoria do índice público e workflow de validação.

## Resultado local

| Verificação | Resultado |
| --- | --- |
| Base sem dados reais | 7 veículos e 175 movimentos fictícios, gerados sem ler planilhas |
| Setup D1 | 7 migrações aplicadas somente ao banco local |
| TypeScript | Aprovado |
| ESLint | Aprovado |
| Testes | 65 aprovados; nenhuma falha ou teste ignorado |
| Build | Concluído; página e 7 rotas de API construídas |
| Auditoria pública | Dados, planilhas, relatórios, identidade de produção e padrões conhecidos de segredos ausentes do índice |

Os checks utilizaram as dependências já instaladas, compatíveis com o lockfile preservado. Não houve reinstalação limpa das dependências nesta sessão. O workflow GitHub configura uma instalação congelada nova ao executar.

O build mantém um aviso de chunks acima de 500 kB; essa otimização é um trabalho posterior. A classificação estática de rotas do Vinext tem limitações conhecidas. Não foi declarada auditoria visual ou de browser nesta transferência.

## Limites

- GitHub não está conectado ao deploy do site: aplicar alterações aprovadas pelo procedimento de publicação.
- Testes públicos não comprovam consistência da base operacional completa; validação com dados reais continua no ambiente autorizado.
- Autenticação de produção pertence à hospedagem existente; não foi exportada nem substituída.
- Modelos 3D técnicos licenciados e fotos operacionais não estão disponíveis nesta cópia.
- Nenhum banco publicado foi acessado ou exportado durante a preparação.
