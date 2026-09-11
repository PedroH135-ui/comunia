# WhatsApp e notificações push

Esta etapa conecta o assistente à API oficial do WhatsApp e adiciona notificações web opt-in. A integração não usa serviços intermediários e mantém credenciais somente no servidor.

## O que já está implementado

- Webhook público em `/api/integrations/whatsapp/webhook`, com verificação do token no cadastro e validação HMAC `X-Hub-Signature-256` em toda mensagem recebida.
- Resposta a mensagens de texto usando a mesma base pública do assistente.
- Proteção de privacidade: pedidos de inscrições, ingressos ou atendimento pessoal encaminham o usuário ao login do portal.
- Idempotência sem armazenar telefone ou conteúdo: o banco registra somente o identificador da mensagem, intenção, estado e data.
- Push web para eventos, avisos, inscrições, pagamento simulado e cancelamento.
- Ativação e desativação pelo próprio membro na página de notificações.
- Remoção automática de assinaturas push expiradas.
- Remoção da assinatura do dispositivo ao sair da conta, evitando avisos pessoais após o logout.
- Aba **Integrações** no painel administrativo, mostrando apenas se cada canal está configurado.

## Conectar a conta da Meta

1. No painel [Meta for Developers](https://developers.facebook.com/), crie ou selecione um aplicativo Business e adicione o produto WhatsApp.
2. Obtenha o ID do número de telefone, o token de acesso e o segredo do aplicativo. Para uso contínuo, substitua o token temporário por um token de usuário do sistema com o menor conjunto de permissões necessário.
3. Crie um token de verificação longo e aleatório. Ele deve ter o mesmo valor na Meta e em `WHATSAPP_VERIFY_TOKEN`.
4. Cadastre a URL `https://comunia-theta.vercel.app/api/integrations/whatsapp/webhook` como callback e assine o campo `messages`.
5. Defina as variáveis abaixo na Vercel para Produção, Preview e Desenvolvimento:

```text
WHATSAPP_API_VERSION
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
```

Nenhum valor dessas variáveis deve ser colocado no Git, em capturas de tela, logs ou no navegador. Depois de configurar, faça um novo deploy e confirme **Conectado** na aba Integrações.

## Notificações push

O servidor usa um par VAPID exclusivo. `VAPID_PUBLIC_KEY` pode ser enviado ao navegador; `VAPID_PRIVATE_KEY` fica somente no servidor. As variáveis são:

```text
VAPID_SUBJECT
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

O navegador só mostra o pedido de permissão depois que o membro clica em **Ativar notificações**. Cada assinatura fica ligada à conta autenticada e o usuário só consegue remover a assinatura do próprio dispositivo. Push exige HTTPS na nuvem; `localhost` é aceito pelos navegadores durante desenvolvimento.

## Limite desta primeira integração

O WhatsApp responde apenas perguntas públicas em texto. Ele não associa telefone a uma conta, não envia campanhas e não consulta informações pessoais. Essa associação exige um fluxo separado de consentimento, validação do número, retenção de dados e revogação. O SLM também fica para a próxima etapa: trocar o motor de resposta não muda as proteções do webhook nem o controle de acesso.

Referências oficiais: [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started), [webhooks da Meta](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks), [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) e [permissão por ação do usuário](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe).
