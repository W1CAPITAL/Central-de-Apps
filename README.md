<div align="center">

<img src="./docs/assets/w1-central-brand.svg" alt="W1 Capital — Central de Aplicativos" width="100%" />

# Central de Aplicativos

**Instalação, execução e atualização dos produtos W1 Capital para Windows.**

[Instalador Windows](https://github.com/W1CAPITAL/Central-de-Apps/releases/latest) ·
[Android (APK de testes)](android/README.md) ·
[Versões disponíveis](https://github.com/W1CAPITAL/Central-de-Apps/releases) ·
[Catálogo do ecossistema](docs/ECOSSISTEMA-W1.md)

</div>

---

## Android (APK nativo)

O projeto Android está em [android/](android/README.md), com catálogo e instalador de APKs oficiais. É um aplicativo próprio, sem Electron nem Adobe AIR. As versões de teste são compiladas e disponibilizadas por GitHub Actions; os aplicativos LexisPredict, INFINITUM e PredictBot ainda precisam de APKs Android específicos e não são substituídos pelos seus instaladores Windows.

## Linger e proteção de recursos da IA local

A Central oferece um **atalho opcional** para as releases oficiais de [Linger](https://github.com/simplexai-labs/linger/releases/latest), um agente pessoal independente. O aplicativo W1 detecta a RAM e avisa quando a máquina usa o perfil leve. A integração **não** faz download automático, não lança o Linger, não modifica as credenciais, não mistura seus dados com o PredictBot e não copia a interface do editor.

O modelo padrão local da W1 permanece **Qwen3 1.7B Q4_K_M**, acessado pelo OpenCode com a configuração isolada da Central. Inspirado no planejamento de recursos descrito pelo Linger, quando há menos de 3 GiB de memória livre o perfil da W1 reduz a execução para uma thread de CPU e 512 tokens de contexto, com o provedor OpenCode anunciado no mesmo limite; no restante, utiliza até duas threads e contexto de 1024. O motor continua local e pode consumir memória e CPU enquanto ativo. Essa redução melhora a contenção, mas não transforma a IA pequena em modelo de ponta.

O **PolyStrata** usado com modelos MoE grandes, como Qwen3.8-Flash-Next, exige GPU dedicada e dezenas de gigabytes de RAM (por exemplo, ao menos 12 GB de VRAM e 32 GB de RAM nas recomendações publicadas). Não é ativado em PCs i3 com 8 GB, nem é instalado pela Central.

O Linger tem licença própria baseada em Apache 2.0 com condições adicionais: sua interface mantém marca/copyright e hospedar o produto a terceiros pode exigir licença comercial. Por esse motivo, o atalho oferece o aplicativo original separado da W1, sem remover marcas ou publicar uma cópia hospedada. **Não existe integração MCP ou compartilhamento automático de memória entre Linger e PredictBot nesta etapa**; usar o link não equivale a conectar os dois aplicativos.

## Atualizações Windows: Central e OpenCode

**Central e aplicativos W1:** a instalação é feita sobre a pasta atual pelo instalador NSIS oficial e mantém as configurações do usuário. A Central consulta releases estáveis W1, baixa em segundo plano com verificação SHA-256 e aplica a atualização ao sair. A ação **Atualizar e reiniciar** valida o arquivo novamente, inicia o NSIS e só registra uma tentativa após iniciar o instalador; um erro ao iniciar não causa bloqueio permanente de tentativas. O pipeline Windows instala um EXE real e verifica a reabertura no mesmo caminho.

**OpenCode Desktop para Windows:** utiliza o atualizador próprio do desenvolvedor, com o processo de atualização/reinício do Electron. A Central não sobrepõe esse mecanismo nem executa uma atualização do OpenCode por trás do usuário. Caso o OpenCode entre em ciclo de atualização, a Central e o PredictBot possuem **Verificar OpenCode para PC** e **Reparar ou atualizar OpenCode**. O reparo consulta a lista de releases estáveis (não apenas `/releases/latest`, que pode estar defasado), baixa o executável x64 direto de `anomalyco/opencode`, valida seu hash SHA-256 e só o abre depois da confirmação do usuário. Nenhum arquivo de projetos ou credencial é apagado pela Central.

O download e o instalador OpenCode são do autor oficial. O executável é verificado por hash, mas a instalação final e possíveis diálogos de segurança são controlados pelo Windows e pelo instalador OpenCode. Se o OpenCode estiver aberto, feche-o antes de confirmar a instalação de reparo. Esta opção não instala outros produtos W1 nem altera modelos, agentes ou Supabase.

## Download para Windows

A release estável mais recente reúne os quatro instaladores independentes da W1 Capital. Use os links abaixo para obter sempre a versão estável atual.

| Aplicativo | Instalador | Canal |
| --- | --- | --- |
| **Central de Apps** | [Última release estável](https://github.com/W1CAPITAL/Central-de-Apps/releases/latest) | Windows x64 |
| **LexisPredict** | [Última release estável](https://github.com/W1CAPITAL/Central-de-Apps/releases/latest) | Instalador independente |
| **INFINITUM** | [Última release estável](https://github.com/W1CAPITAL/Central-de-Apps/releases/latest) | Instalador independente |
| **PredictBot** | [Última release estável](https://github.com/W1CAPITAL/Central-de-Apps/releases/latest) | Instalador independente |

Os quatro instaladores são publicados juntos na mesma GitHub Release estável. Cada aplicativo mantém seu próprio executável e perfil local.

**Integridade:** [SHA256SUMS.txt](https://github.com/W1CAPITAL/Central-de-Apps/releases/latest/download/SHA256SUMS.txt) · [Manifesto das versões de código](https://github.com/W1CAPITAL/Central-de-Apps/releases/latest/download/source-commits.json).

## Arquitetura da loja

A Central é um aplicativo Electron independente dos CRMs. Abre diretamente no Windows, com identidade e sessões próprias para cada produto. O catálogo inclui **LexisPredict, INFINITUM e PredictBot**.

- **LexisPredict:** executa o Next.js standalone no computador; banco, tribunais e serviços externos continuam dependentes de conectividade.
- **INFINITUM:** executa sua aplicação local em uma instância própria; utiliza as permissões e os dados autorizados do Supabase.
- **PredictBot:** interface desktop para sessões, tarefas e integração autenticada com OpenCode/MCP. A Central pode preparar um provedor Qwen3 1.7B local sem alterar o modelo padrão do OpenCode.

Downloads e atualizações usam releases do GitHub por HTTPS e conferência de SHA-256. Authenticode não é requisito para publicar nem instalar atualizações. O SmartScreen do Windows permanece ativo; instaladores sem certificado podem continuar exibindo avisos.

Consulte [catálogo, requisitos e links dos projetos](docs/ECOSSISTEMA-W1.md).

## O que está implementado

- Interface de loja em HTML/CSS/JavaScript dentro do Electron, sem código remoto.
- **Iniciar LexisPredict e INFINITUM** por botões independentes da Central.
- O primeiro uso inicia os servidores locais incluídos no pacote; não abre um site Vercel.
- Isolamento de sessão Electron entre os dois aplicativos e portas estáveis por perfil Windows para preservar autenticação.
- Acesso aos dados via Supabase compartilhado, com políticas RLS e login individual.
- Validação privada da identidade dos servidores locais por nonce temporário.
- Verificação de versões pelo GitHub Releases no início e a cada 30 minutos.
- Download automático em segundo plano e instalação quando todas as janelas do aplicativo forem fechadas.
- Atualização no diretório do executável existente; não cria pastas por versão nem uma segunda instalação.
- Verificação SHA-256 antes de iniciar o instalador e nova conferência imediatamente antes da execução.
- Cache de atualização limitado ao instalador mais recente de cada aplicativo; o arquivo é removido após instalação concluída.
- Código e workflow de compilação Windows centralizados neste repositório, recebendo as versões das `main` dos três sistemas.
- Testes de política de execução, isolamento, validação de caminhos e empacotamento.

## IA local W1 — Qwen3 compatível (BitNet experimental)

A Central oferece preparação automática de um modelo local para Windows x64 com pelo menos 8 GB de RAM:

- Baixa o executável CPU pré-compilado do llama.cpp (25,6 MB) e o Qwen3 1.7B Q4_K_M GGUF oficial do ggml-org (1,28 GB), com hash fixado.
- Confere SHA-256 e tamanho dos dois arquivos antes de instalar ou executar.
- Usa CPU, duas threads, contexto de 1.024 tokens, uma geração por vez e API limitada a `127.0.0.1`.
- Mantém o modelo e a chave em `%LOCALAPPDATA%\\W1 Capital\\Local AI` e passa a configuração isolada apenas ao OpenCode iniciado pela Central.
- Aparece no seletor de modelo por sessão do PredictBot. Você pode usar Qwen3 local em uma sessão e manter GPT 6.2 Astra em outra.
- Não altera o modelo padrão nem as configurações globais existentes do OpenCode.
- Após cinco minutos sem uso, o llama.cpp descarrega os pesos da memória para reduzir o consumo de RAM. O mesmo download é compartilhado entre a Central e o PredictBot independente.

A primeira instalação exige cerca de 1,31 GB de download e espaço em disco adicional. Depois disso, a inferência é local e não consome créditos de API. Não requer Python, CMake, Visual Studio, Vercel ou servidor remoto. O processo local pode continuar ativo em segundo plano e reutiliza o mesmo modelo pelos aplicativos W1.

**Microsoft BitNet:** seu GGUF I2_S não é reconhecido pelo executável padrão do llama.cpp; depende do motor bitnet.cpp específico e ainda não está ativado nesta instalação. Essa proteção evita baixar um modelo que não inicia.

**Limite de capacidade:** Qwen3 1.7B é um modelo compacto. Não equivale ao GPT 6.2 Astra nem ao Grok 4.6. Serve como opção gratuita para tarefas simples e consultas locais; modelos de ponta continuam dependendo de provedores externos e suas respectivas cotas.

## Como a instalação Windows é gerada

Em [GitHub Actions → Central W1 — Windows](https://github.com/W1CAPITAL/Central-de-Apps/actions/workflows/windows.yml), o workflow:

1. Obtém os códigos mais recentes das branches `main` dos três repositórios de produto.
2. Executa testes e compila cada Next.js em modo `standalone`.
3. Separa os servidores Next.js e as dependências do launcher.
4. Cria o EXE Windows x64 da Central com LexisPredict e INFINITUM locais.
5. Executa os servidores reais usando o próprio EXE e verifica login, rotas e nonce em `127.0.0.1`.
6. Gera os instaladores NSIS independentes da Central, LexisPredict, INFINITUM e PredictBot.
7. Instala cada aplicativo em uma pasta limpa e executa novamente o instalador no mesmo destino, verificando que não surge uma segunda cópia.
8. Calcula SHA-256, publica os quatro instaladores e o manifesto de origem em uma GitHub Release estável.

O workflow é acionado em pushes na `main`, manualmente e por verificações periódicas das versões dos projetos. Quando não há mudanças nos códigos e já há release publicada, evita recompilações desnecessárias.

Authenticode é opcional e pode ser adicionado posteriormente para identificar a W1 Capital como editora reconhecida pelo Windows. Não é necessário para o fluxo de atualização baseado em SHA-256. Certificados e senhas, caso existam, devem permanecer exclusivamente nos segredos do GitHub Actions.

## Independência da Vercel — limites reais

**A Central, o launcher e os servidores locais não precisam da Vercel para iniciar e exibir os aplicativos.** O EXE é autocontido em relação ao código e mantém as sessões no perfil do operador.

**Não significa funcionamento offline:** Supabase, autenticação, DataJud, DJEN, WhatsApp e integrações de terceiros exigem internet ou serviços próprios. Algumas rotas do código original do LexisPredict e do INFINITUM usam chaves privadas e serviços vinculados à infraestrutura atual, inclusive endpoints ainda hospedados na Vercel. Esses recursos dependentes precisam ser migrados individualmente para backends independentes e protegidos antes de se declarar 100% de paridade funcional. A Central **não injeta service role, CRON_SECRET, chaves de IA ou outros segredos no desktop**.

Não são oferecidas respostas ou movimentações jurídicas fictícias quando uma consulta remota falha.

## Atualizações

A Central consulta releases estáveis do GitHub ao iniciar e a cada 30 minutos. Quando há uma versão superior, baixa o instalador em segundo plano sem interromper os aplicativos abertos.

Com atualizações automáticas ativadas:

1. A Central confere a origem da release e o digest SHA-256 publicado pelo GitHub.
2. O arquivo baixado é conferido localmente por SHA-256.
3. Quando todas as janelas do aplicativo são fechadas, um helper aguarda o processo encerrar e confere novamente o hash.
4. O instalador NSIS é executado com o caminho da instalação atual, obtido do próprio executável em uso.
5. Os arquivos são substituídos nesse mesmo diretório e o aplicativo é reaberto.

**Não são criadas pastas por versão nem instalações paralelas.** Configurações, sessões e dados de usuário permanecem no perfil de dados do Windows, separado da pasta de instalação. O cache remove instaladores antigos do mesmo aplicativo e apaga o instalador usado depois de uma atualização concluída.

A opção de atualizações automáticas vem ativada por padrão e pode ser desligada nas configurações. **Atualizar agora** permite iniciar a instalação manualmente, com confirmação antes de fechar o trabalho. **Baixar em segundo plano** deixa a versão pronta para ser aplicada ao fechar o aplicativo.

**Migração da versão 0.1.74 e anteriores:** essas versões ainda usam o atualizador antigo, que exige Authenticode. Depois que a nova release estável for publicada, será necessária uma única instalação manual do novo instalador sobre a instalação atual, mantendo o mesmo destino. A partir dessa versão, as atualizações passam a ser automáticas.

**SmartScreen:** sem certificado Authenticode, o Windows ainda pode exibir um aviso de editor desconhecido, especialmente na instalação manual inicial. A Central não desativa nem contorna o SmartScreen. O SHA-256 protege a integridade do pacote, mas não substitui a identidade de editor fornecida por um certificado.

Os instaladores contêm o código dos produtos existente no momento do build. Novos códigos geram novos EXEs pelo workflow de distribuição. Dados em Supabase continuam sendo sincronizados separadamente.

## Desenvolvimento

Node.js 24:

```bash
npm install
npm run check
npm test
```

Para construir localmente os produtos, execute os builds em seus repositórios originais com as flags `LEXIS_DESKTOP_STANDALONE=1` e `KILLA_DESKTOP_STANDALONE=1` e respectivas variáveis públicas Supabase, depois:

```bash
node scripts/stage-next.mjs ./apps-src/lexispredict lexispredict
node scripts/stage-next.mjs ./apps-src/infinitum infinitum
```

Em **Windows** com Electron instalado:

```bash
npm run pack:win
node scripts/verify-products.mjs
npm run dist:win
```

A política de porta local rejeita conflitos, em vez de alternar silenciosamente o endereço e perder as sessões. LexisPredict e INFINITUM usam partições de sessão Electron separadas. Os aplicativos desktop independentes publicados possuem perfis Windows próprios. A disponibilidade de um instalador individual depende dos arquivos realmente publicados em cada release.

## Segurança

- `contextIsolation`, sandbox e `nodeIntegration=false`; IPC restrito à loja local para catálogo, produtos e atualizações. A janela PredictBot recebe somente as ações OpenCode/MCP autorizadas.
- Nenhum arquivo ou URL arbitrária pode virar um produto instalável.
- Sem acesso a arquivos de outros usuários, sem service role no EXE e sem carregamento de scripts remotos.
- Sites externos só são abertos no navegador padrão se passarem pela allowlist HTTPS.
- Suporte ao Windows SmartScreen, sem orientar desativar antivírus ou ignorar alertas.

© W1 Capital · Todos os direitos reservados.

## OpenCode e MCP

A seção **OpenCode e MCP** conecta um executável OpenCode instalado ou um servidor existente autenticado. Informe a pasta do projeto e os identificadores locais de usuário e empresa. A senha fica somente em memória e é limpa da interface depois de conectar.

O launcher permite criar/recuperar sessões, enviar tarefas com confirmação de consumo do provedor, consultar mensagens e alterações, interromper tarefas e gerenciar MCPs V2. Conexões MCP locais exibem o comando para aprovação. Para segredos, use referências `{env:NOME}`, resolvidas no ambiente do OpenCode. OAuth pendente é concluído no próprio OpenCode.

O módulo pertence ao [PredictBot](https://github.com/W1CAPITAL/PredictBot/pull/1) e está fixado por SHA na dependência, evitando uma segunda implementação do executor. O padrão bloqueia ferramentas; sessões de revisão pedem aprovação nativa no OpenCode. Os identificadores locais não substituem autenticação ou permissões do CRM. A Central não abre a porta do OpenCode na internet e esta versão não conecta automaticamente um PredictBot hospedado ao PC.

Após conectar uma sessão, as respostas reais são consultadas periodicamente. Um erro de conexão é exibido como erro. Não há atividade simulada do Hermes nem execução de modelo incluída na licença da Central.

### Usar o OpenCode à distância

Dentro da seção OpenCode, abra **Usar este OpenCode à distância**. Entre na página de conexão com sua conta e autenticador, gere o código, cole na Central e confirme o dispositivo na página. A ponte usa somente conexão de saída; não abre portas do computador. O padrão é leitura. Enviar tarefas exige permissão do dispositivo e confirmação local por operação.

A página permite revogar o computador. A credencial fica em memória e expira em 24 horas; reiniciar a Central exige novo pareamento. Uma interrupção de internet durante a sessão tem reconexão automática. Fechar a ponte não significa cancelar uma tarefa já iniciada no OpenCode.


## Central W1 visual premium e configuração assistida

A janela principal apresenta menu lateral, catálogo pesquisável, cartões para LexisPredict, INFINITUM e PredictBot, área de versões, verificações de segurança e integração com OpenCode. PredictLM e SheetsPredict são exibidos como **em preparação**, não como instalados. A interface é uma reconstrução funcional da composição visual vinho/prata aprovada; não é uma captura de tela estática.

Os botões de instalação OpenCode e Cloudflare WARP abrem exclusivamente as páginas oficiais no navegador do Windows. **Não instalam sem consentimento nem modificam automaticamente rede, DNS, proxy ou certificados.** Configuração de provedores/contas é feita no OpenCode e autenticação da ponte requer MFA e dispositivo pareado.

A seleção de anexos suporta documentos, imagens, vídeos e ZIP/RAR/7z, com limites de tamanho e bloqueio de executáveis; a Central apenas adiciona referências aos caminhos locais na tarefa após ação explícita do operador. Isso não significa que o modelo compreenda todo arquivo, e nenhum anexo é automaticamente enviado, executado, extraído ou carregado no Supabase.

O script de ícones gera no runner Windows ícones de identidade W1 com o mesmo esquema de cores, sem carregar binários externos.

### SmartScreen

Preview sem Authenticode W1 válida **não pode ser anunciado como confiável pelo SmartScreen**. Uma versão estável sem alertas de editor desconhecido requer certificado de assinatura de código válido, instalação legítima e reputação do editor junto ao Windows. Não desative proteções nem contorne a verificação. O canal automático verifica o digest SHA-256 das releases oficiais do GitHub; a proteção do SmartScreen permanece ativa.

A integração dos agentes LexisPredict/INFINITUM com a ponte remota depende das alterações revisadas e testadas nos respectivos repositórios; adicionar um botão na Central não autoriza acessos jurídicos automaticamente.

## W1 OpenCode Mobile (sem parear com PC)

Projeto Android independente em [android/opencode](android/opencode) e servidor [Cloudflare SDK](cloudflare/opencode-mobile/README.md). O APK do W1 OpenCode é compilado pelo workflow Android e oferecido na Central de Apps W1 após a publicação da release. É necessário configurar o Worker para que o chat funcione. O aplicativo original do OpenCode de terceiros não é alterado.
