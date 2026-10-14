# Revisão das regras documentais

A revisão evolui as consultas futuras de `stock-evidence-3` para `stock-evidence-4`. Os casos reproduzidos estão em `tests/rules-review.test.mjs`; as regras anteriores de documento, origem, posição, quantidade positiva e data válida continuam obrigatórias.

- Uma pergunta sobre mangueira, reparo ou outro acessório preserva esse objeto; mencionar a peça-mãe não autoriza substituí-lo pela peça principal.
- Um código explícito restringe a pesquisa a esse material, inclusive códigos de quatro dígitos como `2001`, que não viram períodos de calendário. Código conflitante com a peça-mãe, vários códigos ou várias peças-mãe exigem revisão antes da leitura da fonte.
- Uma devolução ou estorno vinculado ao documento ou O.S. da mesma peça-mãe bloqueia a confirmação mesmo quando somente um dos movimentos informa o código. Códigos distintos explicitamente identificados não são confundidos. Essa conciliação também considera movimentos fora do período da pergunta.

O snapshot registra a versão aplicada no momento da consulta. Nenhum snapshot anterior é recalculado, substituído ou reclassificado pela publicação desta versão. Uma nova pesquisa produz outro evento; o teste com SQLite verifica a preservação integral de snapshots `stock-evidence-3`.

A revisão também corrige a leitura numérica do CSV: `1.5` e `1,5` preservam a fração; agrupamento brasileiro como `1.234,5` é aceito; formatos malformados entram em quarentena. Quilometragem fracionária permanece inválida. A deduplicação sem documento considera horários explícitos para conservar movimentos distintos e mantém a chave anterior quando o horário estiver ausente. Essas correções não reescrevem importações existentes.

Uma importação que ainda esteja em revisão e cujas chaves tenham sido calculadas pela regra anterior precisa ser preparada novamente antes da aprovação. A API responde `409` e explica esse procedimento, sem alterar linhas, contagens ou auditoria. Cancelar a versão antiga continua permitido; versões compatíveis sem horário continuam aprováveis. O teste de integração cobre a versão antiga, a nova revisão e dois movimentos distintos por horário.
