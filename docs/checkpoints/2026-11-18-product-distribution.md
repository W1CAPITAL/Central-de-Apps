# Distribuição LexisPredict e PredictBot

Objetivo: baixar aplicativos pela loja, executá-los em EXEs próprios e acompanhar novas versões pelo GitHub, sem Vercel.

O LexisPredict conserva o Next standalone e a autenticação existentes. O PredictBot desktop usa o adaptador e a ponte OpenCode/MCP atuais, sem copiar serviços de IA ou inventar a migração de Hermes/agentes. Os produtos têm identidades e perfis Windows próprios. O perfil anterior da Central permanece `w1-central-de-apps`.

Download manual de pré-release verifica origem, nome, tamanho e SHA-256 e apenas salva o arquivo. Abrir a pasta não executa o instalador. Atualizações automáticas baixam somente releases estáveis e exigem Authenticode W1; instalação ocorre ao fechar as janelas, com nova verificação dos bytes e da assinatura. O operador pode desligar essa opção.

O workflow detecta os SHAs das mains de LexisPredict, Infinitum e PredictBot. Publica novamente quando esses códigos ou a Central mudam, com commits de origem registrados. Cada EXE é aberto no Windows; na main, os instaladores individuais também são instalados em pasta limpa antes da publicação.

Limites: sem certificado W1 válido, os pilotos continuam manuais. Não houve login em conta real, inferência paga, alteração em dados/RLS ou envio de mensagens. Não há validação Windows desta revisão até o CI confirmar as etapas.
