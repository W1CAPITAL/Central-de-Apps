# Hermes 3D autônomo — novembro de 2026

A versão atual da `main` do [LexisPredict](https://github.com/W1CAPITAL/LexisPredict/commit/743ef0f7060c39c4588cf79b40dd82cd09b6ee5a)
contém o serviço autônomo de monitoramento judicial no Supabase.

## Sem dependência da janela do executável

O agendamento `lexis-hermes-full-portfolio` chama diretamente o
Supabase Edge Function `hermes-background`, de 2 em 2 minutos, na região
São Paulo. Ele não precisa da Central W1, do EXE, de navegador ou de Vercel
abertos. A interface Hermes 3D permanece visualização do estado persistido.

## Distribuição

O instalador independente e a Central devem empacotar o LexisPredict
atualizado, sem assumir que o agendamento depende do computador.

Outras rotinas Hermes ainda dependem de endpoints antigos da Vercel;
não anunciar todos os serviços Hermes como migrados.

Para publicar atualização automática dos instaladores permanece obrigatório
um certificado Authenticode W1 válido. Sem ele, o CI só gera artefatos de teste.
