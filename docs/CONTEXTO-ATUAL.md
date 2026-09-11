# Contexto atual do ComunIA

Atualizado em 10/09/2026, America/Sao_Paulo.

## Objetivo atual

Finalizar o ComunIA como protótipo funcional para entrega e apresentação do TCC. A etapa atual conecta o chatbot ao WhatsApp Cloud API e adiciona notificações push; a avaliação de um SLM vem depois. Segurança avançada, como MFA, auditoria administrativa e recuperação de senha, continua planejada após a entrega.

## Decisões confirmadas

- Visão geral, exploração de eventos e assistente podem ser públicos; ações privadas exigem autenticação.
- Frontend React/Vite, API Express, PostgreSQL e Prisma.
- Hospedagem na Vercel com banco Neon; ambiente local na porta 3001.
- Repositório GitHub privado. Segredos, dados pessoais e credenciais ficam fora do Git e deste checkpoint.
- Administradores podem mudar perfis de membros; a própria conta e o último administrador são protegidos.
- O WhatsApp responde somente dados públicos e não associa telefone a usuário nesta etapa.
- Push depende de consentimento explícito no dispositivo e cada assinatura pertence a uma conta autenticada.
- Deploy, promoção de domínio e alterações das variáveis da Vercel só podem ocorrer após uma mensagem explícita do usuário autorizando o deploy.

## Concluído e verificado

- V1 pública da Comunidade Koinonia publicada em `https://comunia-theta.vercel.app/`.
- Gerenciamento de perfis implementado e publicado.
- Credencial administrativa de produção renovada e sessões antigas revogadas. A conta `admin/admin` é somente local.
- Cabeçalhos de segurança, validação de origem, cookies seguros, limites de requisição e proteção de rotas ativos.
- Revisão do Vibe Coding Toolkit registrada em `docs/AVALIACAO-VIBE-CODING-TOOLKIT.md`.
- Dependabot e workflow “Qualidade e segurança” ativos. O workflow executa instalação reproduzível, auditoria de produção, banco temporário, testes e build.
- Última validação da aplicação: build aprovado, 12 testes aprovados, auditoria de produção sem vulnerabilidades conhecidas e smoke test da nuvem com 28 requisições.
- Commit `aa7f761` criou a primeira versão da skill de continuidade. Ela está sendo corrigida nesta etapa para usar um checkpoint compacto periódico.
- Webhook assinado do WhatsApp, armazenamento mínimo para idempotência, push opt-in e painel de integrações foram implementados localmente. Build, 14 testes e auditoria de produção passaram; a revisão visual local também foi concluída.

## Continuidade automática

- Automação “Compactar contexto do ComunIA” ativa a cada 30 minutos nesta thread. Ela reescreve este arquivo somente quando houver mudança material e não executa commit, push ou deploy.
- Limite do checkpoint: até 120 linhas e aproximadamente 1.200 palavras.
- O arquivo bruto de aproximadamente 28 MB criado na tentativa anterior foi removido do projeto; o registro original da thread no Codex foi preservado.

## Próximos passos recomendados

- Obter as credenciais da conta Meta da comunidade e ativar o webhook do WhatsApp no deploy.
- Avaliar um SLM somente depois de medir as perguntas que a base atual não responde bem.
- Revisar textos e documentação para eliminar contradições sobre funcionalidades já implementadas.
- Executar teste de usabilidade com participantes, registrar evidências e resultados e preparar roteiro de demonstração e contingência.
- Documentar arquitetura, banco, requisitos, testes, segurança atual, limitações e trabalhos futuros.
- Depois da entrega: MFA, recuperação de senha, auditoria administrativa, LGPD operacional, backup testado, monitoramento, lint arquitetural e refatoração gradual.

## Referências

- `AGENTS.md`: comandos e regras obrigatórias.
- `.agents/skills/comunia-contexto/SKILL.md`: processo de manutenção deste checkpoint.
- `README.md`: visão geral e execução.
- `docs/HOSPEDAGEM.md`: implantação.
- `docs/AVALIACAO-VIBE-CODING-TOOLKIT.md`: avaliação e lacunas de segurança.
