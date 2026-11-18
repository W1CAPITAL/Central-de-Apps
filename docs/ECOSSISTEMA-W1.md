# Ecossistema W1 Capital

Este documento reúne os repositórios mantidos na estrutura W1 e seus caminhos de distribuição. A **Central de Aplicativos** é o ponto de entrada para instaladores Windows, sem substituir a documentação técnica de cada produto.

## Aplicativos e distribuição

| Projeto | Repositório | Como acessar |
| --- | --- | --- |
| Central de Apps | [W1CAPITAL/Central-de-Apps](https://github.com/W1CAPITAL/Central-de-Apps) | [Instalador Windows v0.1.48 (prévia)](https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.48/W1-Central-de-Apps-Setup-0.1.48-x64.exe) |
| LexisPredict | [W1CAPITAL/LexisPredict](https://github.com/W1CAPITAL/LexisPredict) | [Instalador Windows v0.1.48 (prévia)](https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.48/LexisPredict-Setup-0.1.48-x64.exe) |
| PredictBot | [W1CAPITAL/PredictBot](https://github.com/W1CAPITAL/PredictBot) | [Instalador Windows v0.1.48 (prévia)](https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.48/PredictBot-Setup-0.1.48-x64.exe) |
| INFINITUM | [W1CAPITAL/Infinitum](https://github.com/W1CAPITAL/Infinitum) | Presente no catálogo; [workflow Windows](https://github.com/W1CAPITAL/Infinitum/actions/workflows/killa-desktop-windows.yml), sem EXE individual na prévia consultada |
| PredictLM | [W1CAPITAL/predictlm](https://github.com/W1CAPITAL/predictlm) | Projeto web/servidor; sem executável Windows publicado |
| SheetsPredict | [W2CAPITAL/SheetsPredict](https://github.com/W2CAPITAL/SheetsPredict) | Aplicação web/PWA; sem executável Windows publicado |
| Site W1 | [W1CAPITAL/SITE](https://github.com/W1CAPITAL/SITE) | Site institucional; sem instalador Windows |
| LexisPredict Offline | [W1CAPITAL/OFFLINE-LEXISPREDICT](https://github.com/W1CAPITAL/OFFLINE-LEXISPREDICT) | Projeto desktop legado; nenhuma GitHub Release publicada neste repositório |
| Leadcheck | [W1CAPITAL/Leadcheck](https://github.com/W1CAPITAL/Leadcheck) | Aplicação web; sem instalador Windows publicado |
| SyncCRM | [W1CAPITAL/SyncCRM](https://github.com/W1CAPITAL/SyncCRM) | Projeto web; sem instalador Windows publicado |

Demais projetos e estudos mantêm repositórios próprios e não devem ser apresentados como itens disponíveis na loja sem implementação e publicação de instalador: W1.OS, GREY, appforge, MIXHD, Evolution-API, Concessão de Crédito e God's Eye View.

## Canais e confiabilidade

- **Releases:** [github.com/W1CAPITAL/Central-de-Apps/releases](https://github.com/W1CAPITAL/Central-de-Apps/releases)
- **Release verificada:** [preview-v0.1.48](https://github.com/W1CAPITAL/Central-de-Apps/releases/tag/preview-v0.1.48)
- **Integridade:** [SHA-256](https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.48/SHA256SUMS.txt)
- **Código utilizado no empacotamento:** [source-commits.json](https://github.com/W1CAPITAL/Central-de-Apps/releases/download/preview-v0.1.48/source-commits.json)

Pré-release não equivale a distribuição estável assinada. O aplicativo desktop empacota a interface e o servidor local; dados na nuvem, autenticação, APIs de terceiros e provedores de IA podem continuar exigindo internet.

## Para desenvolvimento

O código, as instruções de execução e os testes permanecem em cada repositório. A Central não substitui os repositórios de produto e não instala automaticamente projetos que ainda não fazem parte do catálogo.
