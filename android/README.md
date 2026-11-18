# Central de Apps W1 — Android

Aplicativo Android **nativo em Java**, independente de Electron, Adobe AIR/Flash Player, Vercel e qualquer servidor próprio. Está preparado para Android 8.0 (API 26) ou superior.

## Funções que já existem no APK

- Interface da Central W1 com identidade vinho/prata e quatro produtos cadastrados.
- Catálogo que funciona offline com os últimos dados guardados no aparelho, e consulta novas versões pelo GitHub quando houver internet.
- Reconhecimento de aplicativos Android W1 instalados e botão para abri-los.
- Detecção de APKs Android publicados nas releases oficiais da W1 (arquivos `*-Android-<versão>.apk`), ignorando os instaladores `.exe` Windows.
- Download apenas de APKs com metadados oficiais, endereço exato, SHA-256 válido e limite de tamanho.
- Instalação pelo instalador nativo do Android, exigindo o consentimento do usuário e a permissão de instalar apps desta fonte.
- Acesso aos repositórios oficiais de cada produto.

**Importante:** esta primeira entrega é a Central Android (catálogo/instalador). Ela não transforma automaticamente os CRMs Next.js ou o PredictBot do Windows em APKs Android, nem executa BitNet ou outros LLMs no telefone. Os botões de instalar LexisPredict, INFINITUM e PredictBot só aparecem quando APKs Android reais forem publicados. Não exibe os instaladores Windows como se fossem compatíveis.

## Compilação automática gratuita pelo GitHub

O workflow `.github/workflows/android.yml` executa os testes unitários, compila um APK de teste, verifica sua assinatura com `apksigner`, arquiva o resultado e, ao executar na `main`, cria a release `android-preview-v<versão>` com um APK para sideload.

Não é necessário instalar Android Studio no PC do usuário. O GitHub Actions tem suas próprias cotas e condições de uso; não é uma máquina de inferência ilimitada.

O APK de teste usa a assinatura de desenvolvimento padrão do Android, que pode variar entre máquinas/runners. Por isso, futuras atualizações podem exigir desinstalar a versão de teste anterior. Uma versão estável e atualizável precisa de uma chave de assinatura de produção guardada com segurança nos segredos do repositório; **não** devemos publicar essa chave no código-fonte.

## Versão local para desenvolvimento

Com JDK 17, Android SDK 35 e Gradle 8.9:

```bash
gradle -p android :app:testDebugUnitTest :app:assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Segurança e privacidade

- Não utiliza tokens privados de GitHub, Supabase ou OpenCode.
- Não recebe `Authorization` nem acessa arquivos do telefone fora do próprio aplicativo.
- Todo APK deve ter SHA-256 igual ao digest publicado pelo GitHub e tamanho exato.
- O provedor de APK é privado, somente leitura e concede acesso temporário ao instalador do sistema.
- Não há execução remota de código JavaScript, WebView remoto nem permissão para instalar aplicativos silenciosamente.

## Próximas versões Android dos produtos

O LexisPredict e o INFINITUM utilizam Next.js standalone e integrações de dados que não podem simplesmente ser convertidas de Windows x64 para Android. O PredictBot usa OpenCode/MCP com recursos de desktop. Cada um requer um cliente Android específico ou um runtime local compatível. Esses APKs não estão incluídos nesta primeira Central Android.
