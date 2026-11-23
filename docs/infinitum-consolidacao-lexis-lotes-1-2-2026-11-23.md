# Infinitum integrado ao LexisPredict — lote 1 e 2

Registro de integração da Central W1, 23/11/2026.

## Origem comprovada
- Infinitum `W1CAPITAL/Infinitum@141b5ec912fec1e42849b6a2ef7c4635c092a2f9` (PR #11 integrada à `main`).
- LexisPredict continua como fonte histórica durante a migração, sem mudanças destrutivas na base Supabase compartilhada.

## Componentes do Infinitum incluídos no próximo Windows
- Processos completos da empresa, pesquisa local e páginas sem carregamento manual do banco.
- Tarefas e Vencidos (filtros da empresa, sem inferir vencimentos por datas legadas).
- Supervisão `/supervisao` com RPC autenticada para Supervisor/Superadmin, KPIs da carteira, produtividade e distribuições.
- Relatórios `/report` e `/relatorios` unificados com consulta autenticada, períodos, gráficos, equipe, PDF/CSV e proteção a dados ausentes.
- No tema Infinitum, sem duplicar banco, contas ou serviços externos.

## Validação
- PR #11 com todos os testes da CI, typecheck, DOM e `next build` aprovados.
- Docker standalone aprovado.
- Supabase: leitura de snapshots testada sob perfil autenticado, tenant coerente; sem alterar dados.
- Smoke de EXE no Windows pela Central é uma etapa separada, e não valida automaticamente cada conta real.

## Distribuição
A Central deve instalar atualizações por cima da versão anterior, mantendo arquivos e configurações.
O empacotamento usa a `main` atual dos projetos e deve publicar somente após validação Windows.
