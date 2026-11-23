# LexisPredict — menu essencial (23/11/2026)

Este registro acompanha o empacotamento automático da Central W1 após o merge
[LexisPredict #191](https://github.com/W1CAPITAL/LexisPredict/pull/191),
commit `45d477bf2d27092545deb476e000c403f18fe21b` na `main`.

## Alterações de interface incorporadas aos próximos instaladores

- Seis destinos no primeiro nível: Início, Processos, Atividades, Agenda,
  WhatsApp e Documentos.
- Processo da empresa somente para perfil autorizado; demais usuários continuam
  no destino Meus Processos.
- Mesma seleção de destinos no menu lateral vertical e no dock.
- Submenus do celular começam recolhidos; remove-se destaque duplicado para
  dossiês e bloco promocional do menu.
- Os caminhos antigos, dossiês, scanner, relatórios, IA, auditoria e demais
  funções permanecem disponíveis no menu de ferramentas.

Não foi executada migração de banco de dados nem alterada a configuração
do Supabase.

## Distribuição

O workflow `.github/workflows/windows.yml` seleciona o commit atual da `main`
do LexisPredict e gera pacotes independentes para LexisPredict, INFINITUM e
PredictBot, além da Central. O build Windows exige testes de abertura real dos
EXEs e dos instaladores.

A publicação de releases e a atualização automática devem continuar
bloqueadas sem certificado Authenticode W1 Capital válido. Nesse caso o pipeline
pode produzir somente artefatos de teste no GitHub Actions; não os promova a
releases estáveis nem desative a validação de assinatura.
