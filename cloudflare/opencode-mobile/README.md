# W1 OpenCode Mobile — servidor sem PC

Este serviço executa o host OpenCode 2 com `@opencode/sdk/workerd` dentro de um **Cloudflare Durable Object SQLite**, usando o harness oficial da Cloudflare para recuperar sessões. O APK Android em `android/opencode/` usa HTTPS e **não exige pareamento com Windows**.

## Implantação

1. Na conta Cloudflare que controlará o OpenCode, execute `cd cloudflare/opencode-mobile && npm install`.
2. Crie um segredo forte com pelo menos 24 caracteres: `npx wrangler secret put MOBILE_API_TOKEN`. **Nunca inclua a senha no código, nos commits ou no APK.**
3. Publique: `npm run deploy`. Isso requer autenticar o Wrangler nessa conta; o código não coloca tokens da conta no repositório.
4. No APK W1 OpenCode, informe a URL HTTPS do Worker (por exemplo `https://w1-opencode-mobile.<subdominio>.workers.dev`) e o segredo configurado. Toque em **Conectar** e depois utilize o chat.

`GET /api/health` e `POST /api/chat` exigem `Authorization: Bearer <segredo>`. O serviço rejeita requisições se o segredo não estiver definido. Não ative links públicos sem autenticação.

## Limitações reais

- O SDK está **no Durable Object**, não rodando dentro da JVM do Android.
- A versão cloud é diferente de um OpenCode desktop: shell, arquivos locais e ferramentas de edição nativas estão desativadas por serem incompatíveis com Workerd. Para editar um repositório GitHub, são necessárias ferramentas remotas específicas, com autenticação e permissão limitada.
- O exemplo usa um modelo disponível via Cloudflare Workers AI e depende das cotas e da disponibilidade da conta. Não existe inferência ilimitada/gratuita garantida.
- As sessões do harness permanecem no armazenamento do Durable Object, mas a interface Android desta versão é um cliente de chat inicial; recursos avançados como lista de projetos e permissões exigem implementação adicional.
- Sem implantação do Worker, o APK não tem um host para usar. Sem internet ou sem saldo/cota do provedor, o modelo não responderá.
- Use um segredo exclusivo deste serviço. Não reutilize tokens GitHub, Supabase, OpenCode ou credenciais pessoais.
- A verificação automatizada do código usa `npm test` e `npm run check:worker`.

Docs: https://opencode.ai/docs/build/sdk/cloudflare e https://developers.cloudflare.com/agents/harnesses/opencode/
