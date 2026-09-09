# ComunIA na Vercel e Neon

## Arquitetura

- Projeto Vercel: `comunia`, na conta `pedro135he-7663s-projects`.
- Front-end: React Native Web/Vite, arquivos estáticos no CDN.
- Backend: Express em `api/index.ts`, com rotas `/api/*` no mesmo domínio.
- Região das funções: São Paulo (`gru1`). A compilação pode acontecer em outra região.
- Banco: Neon `comunia-db`, plano `free_v3`, São Paulo. Autenticação Neon desativada: o aplicativo mantém seu próprio login.
- `DATABASE_URL` vem da integração Neon somente no ambiente Production. Não compartilhe a conexão com o navegador.
- As prévias comuns não usam o banco de produção. A primeira validação usa uma publicação Production sem promover o domínio (`--skip-domain`).

## Dados e acessos

Em 08/09/2026 foi feita uma cópia transacional dos dados locais para um banco Neon vazio. Foram preservados usuários, eventos, inscrições, pagamentos simulados, avisos, notificações, conhecimento, mensagens e atendimentos. Sessões de login e limites temporários não foram copiados.

Na primeira publicação, as senhas das duas contas de demonstração foram substituídas por senhas aleatórias somente na nuvem. Posteriormente, por solicitação do usuário, o administrador passou a aceitar login **admin** e senha **admin**, localmente e online. O e-mail original também continua válido. O cadastro de novos membros continua exigindo e-mail e senha de pelo menos oito caracteres. Os acessos estão em `.local/ACESSOS-ONLINE.md`, excluído do deploy e do Git. A interface online não preenche automaticamente credenciais.

O banco local em `E:/ComunIA/postgres-data` foi preservado. Depois da migração, alterações locais e online são independentes; não existe sincronização automática.

O script `scripts/migrate-cloud.ts` recusa destinos já inicializados, usa uma transação e guarda um snapshot privado em `.local/migration-backup.json`. Não o execute novamente para atualizar a aplicação.

## Atualizar a aplicação

1. Execute `npm.cmd run build` e `npm.cmd test` contra o banco local.
2. Se mudar o esquema, revise e aplique uma migração compatível antes de publicar. Nunca execute o seed de contas locais na nuvem.
3. Execute `vercel.cmd deploy --prod --skip-domain`.
4. Confira login, agenda, inscrições, chatbot e API na URL gerada.
5. Execute `vercel.cmd promote URL_DA_PUBLICACAO --yes`.

O deploy foi realizado pela CLI. Publicação automática por Git ainda não está configurada.

## Configuração e manutenção

- Node.js 24; conexões PostgreSQL limitadas por instância e gerenciadas por `attachDatabasePool`.
- Cookies HttpOnly, SameSite Strict e Secure na nuvem.
- Origens de escrita restritas aos endereços exatos da implantação e produção. Se adicionar domínio próprio, configure `APP_ORIGINS=https://seu-dominio.com.br` e publique novamente.
- Controle de login compartilhado no PostgreSQL, com expiração de 10 minutos, e limite também no cadastro.
- Notificações online consultadas a cada 60 segundos apenas com a aba visível, para reduzir consumo.
- `.env`, `.local`, backups, senhas e scripts de migração ficam fora do deploy.
- `npm run db:migrate` aplica o histórico Prisma; `npm run db:cleanup` limpa sessões/limites expirados; confira sempre qual `DATABASE_URL` está configurada antes de executar.

## Custos e limites

O banco foi provisionado no plano gratuito. Não foram contratados serviços de WhatsApp, IA generativa ou pagamentos. O uso deve permanecer nas cotas do plano e nas regras de uso pessoal não comercial do Vercel Hobby. Cotas não equivalem a garantia de disponibilidade ilimitada.

A V1 continua sendo uma demonstração: pagamentos simulados, chatbot por base de conhecimento e notificações internas. Backup contínuo, recuperação de senha por e-mail e integrações externas não fazem parte desta publicação.

Referências: [Vercel Functions](https://vercel.com/docs/functions/quickstart), [PostgreSQL e pooling](https://vercel.com/kb/guide/connection-pooling-with-functions), [Neon](https://vercel.com/marketplace/neon).

## Publicação verificada

- Endereço público: https://comunia-theta.vercel.app
- Implantação: dpl_FJVyWt2b5K5aiqjHG9TkNiD6pgso.
- 7 testes locais passaram, incluindo concorrência de inscrições, limite distribuído e cookies seguros.
- 21 requisições verificadas na implantação: arquivos da interface, conteúdo e assistente públicos, API, bloqueio de origem indevida, login, permissões, cadastro, inscrição, cancelamento, chatbot autenticado e logout.
- Conta temporária de teste e registros associados removidos após a validação.
- Domínio público validado sem sessão da Vercel: página inicial e health 200, login e logout 200.
- Auditoria das dependências de produção sem vulnerabilidades reportadas nesta verificação. A árvore de desenvolvimento apresenta avisos em dependências transitivas do Metro; Metro não é utilizado para servir nem compilar esta versão web com Vite.

Acesso ao banco atualizado para Prisma ORM 7.10, com baseline registrada na Neon e no banco local. Consulte [PRISMA.md](PRISMA.md).
