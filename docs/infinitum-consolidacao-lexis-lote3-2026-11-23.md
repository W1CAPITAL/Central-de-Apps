# Infinitum integrado ao LexisPredict — lote 3

Atualização W1 Capital — 23/11/2026.

## Origem
- Infinitum `W1CAPITAL/Infinitum@4e55807db35d694069d491eeca091a59b08602c9`, PR #12 integrada à `main`.
- Lotes 1 e 2 seguem incorporados: carteira paginada, tarefas, vencidos, Supervisão e Relatórios.
- O LexisPredict permanece disponível durante a migração e o Supabase jurídico compartilhado continua sendo a fonte única.

## Lote 3 — Fases e Provas
- Nova rota `/fases-provas`, protegida pela sessão autenticada.
- Triagem de réplica, contestação, especificação de provas, documentos e perícias.
- Cada ocorrência distingue último ato DataJud/DJEN, registro interno e menção genérica.
- Evidência, justificativa, prioridade e próxima ação sugerida; filtros e exportação CSV.
- Não calcula prazo, não declara protocolo confirmado por anotação e não autoriza cobrança.

## Lote 3 — Processos Parados
- Nova rota `/processos-parados`, protegida pela sessão autenticada.
- Último movimento oficial separado da data de consulta; estados confirmado, provável e sem consulta.
- Oportunidades processuais: réplica pendente, cumprimento, citação, audiência, justiça gratuita, impulso e revisão de fase.
- Filtros por período, responsável, fase, telefone e situação.
- Marcação "tratado" local, isolada por empresa e usuário, sem alterar o processo no banco.
- Atalho para o Scanner com CNJ pré-preenchido; nenhuma consulta é disparada sem ação do operador.

## Segurança e privacidade
- O vínculo empresa/usuário é resolvido pela sessão e validado contra cada registro retornado.
- Paginação até 20 mil processos; se o limite for alcançado, a consulta falha sem exibir um total parcial como completo.
- Projeção apenas das colunas e campos JSON necessários; não baixa o JSON completo `dados`.
- Sem migration ou alteração de dados de produção.
- Sem envio automático de WhatsApp, peticionamento ou alteração de prazos.

## Validação
- Testes, regressões, typecheck, DOM e build Next.js: aprovados.
- Docker standalone: aprovado.
- Teste agregado somente leitura sob sessão autenticada: 2.735 processos visíveis; 174 referências a fases/provas; 2.461 com movimento DataJud; 1.796 com DJEN; 110 sem data de movimento.
- A compilação Windows da Central deve sempre usar a `main` mais recente do Infinitum. O preview anterior 0.1.349 foi construído antes da integração do lote 3; o próximo preview precisa empacotar o commit `4e55807`.
