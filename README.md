# W1 Capital · Central de Apps

**Repositório central do launcher Windows, da loja independente e dos instaladores locais.**

A Central é um aplicativo Electron separado dos CRMs. Ao abrir o EXE, o operador vê a **loja diretamente**, sem passar pelo site ou pela rota `/app-store` do INFINITUM. Os produtos continuam com repositórios e ciclos de desenvolvimento próprios:

| Produto | Código-fonte | Execução na Central |
| --- | --- | --- |
| LexisPredict | [W1CAPITAL/LexisPredict](https://github.com/W1CAPITAL/LexisPredict) | Next.js standalone local no Windows, `127.0.0.1`, sessão própria |
| INFINITUM Killa AI | [W1CAPITAL/Infinitum](https://github.com/W1CAPITAL/Infinitum) | Next.js standalone local no Windows, `127.0.0.1`, sessão própria |

## O que está implementado

- Interface de loja em HTML/CSS/JavaScript dentro do Electron, sem código remoto.
- **Iniciar LexisPredict e INFINITUM** por botões independentes da Central.
- O primeiro uso inicia os servidores locais incluídos no pacote; não abre um site Vercel.
- Isolamento de sessão Electron entre os dois aplicativos e portas estáveis por perfil Windows para preservar autenticação.
- Acesso aos dados via Supabase compartilhado, com políticas RLS e login individual.
- Validação privada da identidade dos servidores locais por nonce temporário.
- Verificação não intrusiva de versões pelo GitHub Releases a cada 30 minutos; nunca executa binário baixado sem verificação da assinatura do editor.
- Código e workflow de compilação Windows centralizados neste repositório, recebendo as versões das `main` dos dois sistemas.
- Testes de política de execução, isolamento, validação de caminhos e empacotamento.

## Como a instalação Windows é gerada

Em [GitHub Actions → Central W1 — Windows](../../actions/workflows/windows.yml), o workflow:

1. Obtém os códigos mais recentes das branches `main` dos dois repositórios de produto.
2. Executa testes e compila **cada** Next.js em modo `standalone`.
3. Separa os servidores Next.js e as dependências do launcher.
4. Cria o EXE Windows x64 da Central com ambos os produtos.
5. Executa os servidores reais usando o próprio EXE em modo Node e verifica login/rotas/nonce em `127.0.0.1`.
6. Gera o instalador NSIS e disponibiliza um artefato de teste.
7. Publica uma GitHub Release automaticamente **somente se** houver assinatura Authenticode válida do editor W1 Capital.

O workflow é acionado em pushes na `main`, manualmente, e faz verificações periódicas das versões dos dois produtos. Quando não há mudanças nos códigos e já há release publicada, evita recompilações desnecessárias. Sem certificado do editor no ambiente GitHub, a Central **não publica instaladores executáveis como releases oficiais**; o instalador de teste ainda pode ser gerado como artefato.

O ambiente de assinatura usa apenas segredos privados do GitHub Actions: `CENTRAL_WINDOWS_CERT_P12` e `CENTRAL_WINDOWS_CERT_PASSWORD`. Não publicar certificados nem senhas neste repositório, nas variáveis `NEXT_PUBLIC_*`, no EXE ou em conversa.

## Independência da Vercel — limites reais

**A Central, o launcher e os servidores locais não precisam da Vercel para iniciar e exibir os aplicativos.** O EXE é autocontido em relação ao código e mantém as sessões no perfil do operador.

**Não significa funcionamento offline:** Supabase, autenticação, DataJud, DJEN, WhatsApp e integrações de terceiros exigem internet ou serviços próprios. Algumas rotas do código original do LexisPredict e do INFINITUM usam chaves privadas e serviços vinculados à infraestrutura atual, inclusive endpoints ainda hospedados na Vercel. Esses recursos dependentes precisam ser migrados individualmente para backends independentes e protegidos antes de se declarar 100% de paridade funcional. A Central **não injeta service role, CRON_SECRET, chaves de IA ou outros segredos no desktop**.

Não são oferecidas respostas ou movimentações jurídicas fictícias quando uma consulta remota falha.

## Atualizações

A Central consulta a última GitHub Release oficial ao iniciar e a cada 30 minutos. Quando há uma versão superior, mostra **número, alterações e status** sem fechar nem bloquear os programas. Só habilita os botões de atualização quando a API do GitHub informa o instalador correto, tamanho permitido e `digest` SHA-256 válido.

O operador pode escolher:

- **Atualizar agora:** baixar a versão oficial validada, verificar SHA-256 e Authenticode, perguntar antes de fechar e reiniciar a Central.
- **Baixar em segundo plano:** continuar trabalhando no LexisPredict ou INFINITUM; a instalação fica disponível para confirmação posterior.
- **Depois:** manter a versão instalada. Também é possível abrir a página da release oficial.

A verificação do editor W1 Capital usa o script local `Get-AuthenticodeSignature`, sem executar código remoto. O SHA-256 do arquivo local é conferido novamente imediatamente antes da instalação. Arquivos com hash divergente, assinatura inválida, downgrade ou endereço externo não são executados. Nenhuma atualização pode instalar silenciosamente quando o operador fecha o CRM.

**Limite de publicação:** o instalador do GitHub Actions só é disponibilizado como GitHub Release oficial quando o certificado Authenticode W1 Capital está configurado e válido. Sem o certificado, apenas o artefato de teste Windows é gerado. Esse artefato não entra no canal automático e pode sofrer avisos do SmartScreen.

O instalador contém o código dos produtos existente no momento do build. Novos códigos exigem um novo EXE. Dados em Supabase continuam sendo sincronizados separadamente.

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

A política de porta local rejeita conflitos, em vez de alternar silenciosamente o endereço e perder as sessões. Os dois produtos usam partições de sessão Electron separadas.

## Segurança

- `contextIsolation`, sandbox e `nodeIntegration=false`; somente quatro ações permitidas via IPC (estado, abrir um produto permitido, consultar release e abrir página oficial).
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
