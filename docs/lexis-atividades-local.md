# LexisPredict Windows — contador de atividades

A distribuição para Windows inclui o LexisPredict a partir do commit `d41e9a6cacf8a4bdcdfe02f153f2a8665369a819` ou posterior da branch `main`.

## Indicador "Atividades cadastradas"

- O aplicativo executa o Next.js localmente na porta de loopback, sem Vercel.
- A interface consulta `GET /api/atividades/kpi` no mesmo endereço local.
- O endpoint usa sessão Supabase SSR e empresa autenticada, respeitando RLS.
- Falhas de rede ou sessão nunca devem virar contagem `0` presumida.
- O botão "Tentar novamente" refaz a consulta de forma explícita.
- A Server Action anterior permanece como alternativa compatível.
- Os EXEs não contêm chave `service_role` nem dispensam login.

### Validação
A suíte do LexisPredict verifica isolamento por empresa, contagem real e falha sem dados falsos. O pipeline desta Central compila e testa o LexisPredict desktop independente.
