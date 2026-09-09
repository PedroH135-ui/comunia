# ComunIA · V1 local

Aplicativo de demonstração do TCC **ComunIA — Aplicativo Inteligente de Atendimento para Comunidades Religiosas**. Interface responsiva em React Native para Web, API Node.js/TypeScript e banco PostgreSQL persistente. Comunidade, endereços e eventos de exemplo são fictícios.

## Versão online

Aplicação publicada: **https://comunia-theta.vercel.app**.

Front-end e API na Vercel; PostgreSQL na Neon, região de São Paulo e plano gratuito. As senhas online estão em .local/ACESSOS-ONLINE.md (arquivo privado). As senhas de demonstração abaixo valem apenas para a versão local. Consulte [docs/HOSPEDAGEM.md](docs/HOSPEDAGEM.md) para atualizar a aplicação e entender a separação dos bancos.

## Abrir e executar

Abra **INICIAR-COMUNIA.cmd** nesta pasta. A versão compilada fica em **http://127.0.0.1:3001**, com o servidor executando em segundo plano. Use **PARAR-COMUNIA.cmd** para encerrá-lo.

Para desenvolver com atualização automática da interface, pare a versão do atalho e execute:

```powershell
npm.cmd run db:start
npm.cmd run dev
```

- Interface do atalho: http://127.0.0.1:3001
- Interface em desenvolvimento: http://127.0.0.1:5173
- API: http://127.0.0.1:3001/api/health
- Membro: **membro@comunia.local**
- Administrador: login **admin**, senha **admin** (local e online).
- Senha do membro local: **Comunia@123**.

Escolha uma conta na tela de login e clique em Entrar. Também é possível cadastrar novos membros. Para encerrar o aplicativo em desenvolvimento, use Ctrl+C no terminal. O PostgreSQL continua disponível; `npm.cmd run db:stop` encerra apenas a instância do ComunIA.

Se o aplicativo já estiver aberto, apenas visite o endereço. Não é necessário executar duas instâncias. As portas são 5173 (interface), 3001 (API) e 55432 (banco).

## O que funciona

- Login, criação de conta de membro, logout, sessão persistente e autorização por perfil.
- Visão geral com números vindos do banco, próximos eventos e mural.
- Agenda, busca, categorias, detalhes de eventos e quantidade real de vagas.
- Inscrição gratuita com confirmação imediata; inscrição paga com reserva de vaga.
- Pagamento **simulado**, ingresso com código, cancelamento e estorno **simulado**.
- Controle transacional para impedir duas inscrições disputando a última vaga ou pagamentos duplicados.
- Notificações **dentro do aplicativo** para novos eventos publicados, atualizações, avisos e inscrições; leitura e atualização a cada 15 segundos.
- Chatbot por intenções/FAQ, consulta aos eventos e inscrições do banco, histórico persistente e encaminhamento à equipe.
- Administração: criar/editar eventos, publicar ou guardar rascunho, acompanhar inscrições e receita fictícia, cadastrar/editar conhecimento do chatbot, publicar avisos, consultar membros e interações e concluir pedidos de atendimento.

## Revisão visual e pesquisa

A interface inclui agenda em lista ou cartões, acesso à próxima inscrição, navegação inferior no celular e abas acessíveis da Origin UI/Radix. A comparação qualitativa com Church Center, Eklesia, InPeace e Atos6, as fontes e as decisões implementadas estão em [docs/PESQUISA-UI.md](docs/PESQUISA-UI.md). Créditos do componente em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Roteiro para apresentar a V1

1. Entre como membro e explore a página inicial.
2. Faça uma inscrição no Encontro de jovens e abra seu ingresso em Minhas inscrições.
3. Inscreva-se no Retiro Raízes. Clique em Simular pagamento e confirme; nenhum valor é cobrado.
4. Pergunte ao assistente: “Quais são os próximos eventos?”, “Minhas inscrições” e “Qual o horário dos cultos?”.
5. Escreva “atendente” para gerar um pedido real no painel local.
6. Saia da conta e entre como administrador. Abra Painel administrativo.
7. Crie um evento futuro e publique um aviso. Edite uma resposta da base e conclua o atendimento.
8. Volte ao membro e confira as notificações e o evento criado.
9. Recarregue a página: as informações continuam no PostgreSQL.

## Acesso ao banco com Prisma

Prisma ORM 7.10 já integra as consultas e as migrações do PostgreSQL. Execute npm run db:studio para abrir a ferramenta local de administração do banco. Consulte [docs/PRISMA.md](docs/PRISMA.md) para os comandos, a adoção sem perda de dados e as operações que preservam SQL transacional.

## Banco e armazenamento

A instalação de PostgreSQL já existente é reutilizada, mas o ComunIA usa **uma instância separada**, sem alterar o serviço ou os bancos anteriores.

- Binários existentes: `C:/Program Files/PostgreSQL/16/bin`.
- Dados locais: `E:/ComunIA/postgres-data`.
- Log: `E:/ComunIA/postgres.log`.
- Cache npm: `E:/ComunIA/npm-cache`.
- Dependências: `E:/ComunIA/dependencies/v1-4/node_modules`, ligadas à pasta do projeto por uma junção de diretório do Windows.
- Credencial aleatória do banco em `.env`, ignorado pelo Git. Não compartilhe esse arquivo.
- Autenticação do banco com SCRAM e acesso somente por `127.0.0.1`.

`npm.cmd run setup` inicia o banco, cria as tabelas e insere dados de demonstração quando ausentes. O seed não apaga seus cadastros. Não apague a pasta do banco para reiniciar o aplicativo.

Em outro computador, instale Node.js 24 e PostgreSQL 16, copie `.env.example` para `.env`, ajuste `PG_BIN`, `PG_DATA_DIR` e `DATABASE_URL` e instale as dependências. O script de inicialização fornecido é específico para Windows e usa a porta 55432. Para um banco já gerenciado, configure `DATABASE_URL` e execute apenas `npm.cmd run seed`.

## Estrutura

```text
src/                  Interface e estilos responsivos
server/app.ts         API REST, autenticação e regras de negócio
server/schema.sql     Tabelas e integridade do banco
server/seed.ts        Conteúdo fictício inicial
server/security.ts   Hash das senhas com scrypt
scripts/database.mjs Inicialização da instância local isolada
tests/api.test.ts    Testes de integração com o PostgreSQL
```

## Verificação

```powershell
npm.cmd run build
npm.cmd test
```

Os testes criam usuários/eventos temporários identificados como QA, verificam autenticação, permissões, concorrência da última vaga, isolamento de inscrições, pagamento/estorno, notificações, consulta do chatbot e atendimento. Ao terminar, removem somente seus próprios dados. Execute no banco local de demonstração.

Logs do servidor do atalho ficam em `.local/app.log`. O atalho verifica se o servidor já está rodando antes de iniciar outro. Depois de editar o código, execute `npm.cmd run build` e reinicie o servidor para atualizar a versão do atalho.

O build gera `dist/`. Depois dele, `npm.cmd start` serve a interface compilada e a API juntas em http://127.0.0.1:3001. O banco deve estar iniciado.

## Limites e decisões para a próxima versão

- **Celular:** a V1 é executada no navegador com React Native para Web. Ainda não é um APK/IPA. Os ícones, formulários administrativos, CSS, cookies e cliente HTTP têm adaptações web; uma versão Expo/Android/iOS exigirá adaptação e testes próprios.
- **Pagamentos:** não há gateway nem cobrança. Precisamos escolher provedor e validar credenciais/webhooks antes de processar dinheiro real.
- **Notificações:** caixa interna funcional. Push no celular, e-mail e WhatsApp ainda não estão integrados. Não há lembrete agendado antes do evento.
- **WhatsApp:** não conectado nesta V1; a API oficial será uma integração posterior do mesmo backend.
- **IA:** sem LLM/RAG ou API paga; o chatbot usa detecção simples de intenções e palavras-chave. As respostas vêm da base cadastrada. Não é um modelo treinado.
- **Reservas:** inscrições pendentes ocupam vaga até serem pagas ou canceladas; expiração automática fica para a integração com pagamentos.
- **Administração:** lista membros, mas não altera perfis ou bloqueia contas nesta V1. Não há recuperação de senha, check-in por QR, anexos, múltiplas instituições ou reembolso real.
- **Hospedagem:** nenhum deploy foi realizado. Para Vercel, precisamos adaptar a entrada serverless e contratar/configurar um PostgreSQL acessível em nuvem. Enquanto local, o PC precisa permanecer ligado.
- **Produção:** antes de usuários reais, configurar HTTPS/cookies seguros, segredos, backup, recuperação de conta, política de retenção, limites distribuídos de requisições e monitoramento.
- As fontes tipográficas tentam carregar do Google Fonts; a interface funciona com fontes alternativas sem internet.

Referências técnicas consultadas: [React Native para Web](https://necolas.github.io/react-native-web/docs/setup/) e [inicialização do PostgreSQL 16](https://www.postgresql.org/docs/16/app-initdb.html).
