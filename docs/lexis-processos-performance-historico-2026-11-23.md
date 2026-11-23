# LexisPredict — processos mais leves e histórico de atendimentos

Atualização integrada à `main` do [LexisPredict](https://github.com/W1CAPITAL/LexisPredict/commit/e8ee15c3c7d9787006d2ea2aa7600163796619c4), proveniente da [PR #192](https://github.com/W1CAPITAL/LexisPredict/pull/192).

O fluxo Windows da Central deve usar a versão atual da `main` no próximo build, sem alteração de endpoints, bancos ou migrations.

## Escopo

- Primeira chamada da carteira da empresa com 30 em vez de 60 processos.
- Paginação, busca global, atualização manual e invalidação da carteira preservadas.
- Foco e atualização periódica usam janela de revalidação para evitar leituras redundantes.
- Indicadores secundários só são requisitados ao expandir a seção.
- Histórico operacional de atendimentos por processo, com busca limitada e validada por sessão, tenant e CNJ.
- Histórico de atendimentos separado da consulta judicial DataJud/DJEN.

## Validação e distribuição

O CI do LexisPredict concluiu TypeScript, testes, contrato comercial e build em 23/11/2026, antes do merge.

O workflow Windows da Central empacota e testa os EXEs e instaladores. A publicação estável somente pode ocorrer com assinatura Authenticode W1 Capital válida. Sem essa assinatura, manter apenas artefatos de teste; não contornar a segurança para distribuir binários.
