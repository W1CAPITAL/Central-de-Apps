# Distribuição LexisPredict e PredictBot

Objetivo: baixar aplicativos pela loja, executá-los em EXEs próprios e acompanhar novas versões pelo GitHub, sem Vercel.

O LexisPredict conserva o Next standalone e a autenticação existentes. O PredictBot desktop usa o adaptador e a ponte OpenCode/MCP atuais, sem copiar serviços de IA ou inventar a migração de Hermes/agentes. Os produtos têm identidades e perfis Windows próprios. O perfil anterior da Central permanece `w1-central-de-apps`.

Download manual de pré-release verifica origem, nome, tamanho e SHA-256 e apenas salva o arquivo. Abrir a pasta não executa o instalador. Atualizações automáticas baixam somente releases estáveis e exigem Authenticode W1; instalação ocorre ao fechar as janelas, com nova verificação dos bytes e da assinatura. O operador pode desligar essa opção.

O workflow detecta os SHAs das mains de LexisPredict, Infinitum e PredictBot. Publica novamente quando esses códigos ou a Central mudam, com commits de origem registrados. Cada EXE é aberto no Windows; na main, os instaladores individuais também são instalados em pasta limpa antes da publicação.

Entrega confirmada: PR #7 integrada por `60d9019`; release `preview-v0.1.46` publicada com os três EXEs. O run Windows `44279325728` compilou, abriu e instalou a Central, LexisPredict e PredictBot em pastas limpas. Os downloads reais dos dois produtos pelo mesmo gerenciador da loja concluíram com SHA-256 correto. A release contém os SHAs em `source-commits.json`; não representa teste com conta real ou no PC do cliente.

Revisão posterior: a PR PredictBot #4 (`5e09212a`) corrigiu resposta confirmada marcada como erro e recibos presos em HTTP 413. A dependência local da Central foi atualizada por SHA imutável; o workflow também fixa a main do PredictBot no início do build. A PR Infinitum #4 (`2900d747`) preserva o conteúdo e o recibo original de retries de atendimento, com migração aditiva aplicada e RLS preservada. As duas correções passaram nos respectivos CIs antes da integração. Um novo pacote precisa registrar esses SHAs antes de se afirmar que o EXE contém as correções; a release 0.1.46 permanece na revisão anterior.

Limites: sem certificado W1 válido, os pilotos continuam manuais e fora da instalação automática. Não houve login em conta real, inferência paga ou envio de mensagens. Agentes, chats e Hermes ainda não foram migrados para o PredictBot; o desktop entregue é a interface OpenCode/MCP. Dados remotos, autenticação e integrações continuam sujeitos à internet e às permissões existentes.
