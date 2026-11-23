# LexisPredict — carteira da empresa, KPIs e busca no EXE

Atualização de integração W1 Capital — 23/11/2026.

LexisPredict `main` commit `32934eab1091b6a0e31ec9fe7f585a0739c09d69`, PR #195.

## Correções incorporadas
- Pesquisa da carteira inteira usa RPC `buscar_carteira_empresa_rapido` com `EXECUTE` para `authenticated` e RLS de `processos`, sem privilégio anônimo.
- `/processos` exibe um primeiro lote leve e carrega progressivamente a carteira inteira em segundo plano, sem clicar milhares de vezes; após atualizações de dados ignora respostas obsoletas e não publica snapshot parcial como completo.
- `/tarefas` consulta por padrão toda a organização autenticada; permissão real vem exclusivamente da sessão e empresa de banco.
- `/supervisao`, `/report` e histórico de atendimentos usam RPCs autenticadas introduzidas anteriormente no LexisPredict PR #194, também incluídas no pacote Windows. Dados de teste não são contagens exibidas em produção.
- `/vencidos` conserva consulta empresarial paginada diretamente no Supabase, independente da primeira página de `/processos`.

## Distribuição
A Central empacota sempre a `main` do LexisPredict, do Infinitum e do PredictBot e publica uma release prévia com os quatro instaladores somente quando passar nos testes Windows. A atualização não deve desinstalar nenhum programa, alterar registros do CRM, apagar dados ou depender da Vercel.

A validação de login, RLS e dos KPIs em ambiente real é separada do smoke sem credenciais dos testes Windows; não inferir que a suíte visual garante todos os dados de produção.
