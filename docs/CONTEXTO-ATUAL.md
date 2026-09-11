# Contexto atual do ComunIA

Atualizado em 10/09/2026, America/Sao_Paulo.

## Objetivo atual

Construir e evoluir o portal da Comunidade Koinonia com segurança como prioridade. O usuário quer que o contexto necessário do projeto seja salvo automaticamente em intervalos regulares, sempre compactado para este arquivo não crescer continuamente.

## Decisões confirmadas

- Visão geral, exploração de eventos e assistente podem ser públicos; ações privadas exigem autenticação.
- Frontend React/Vite, API Express, PostgreSQL e Prisma.
- Hospedagem na Vercel com banco Neon; ambiente local na porta 3001.
- Repositório GitHub privado. Segredos, dados pessoais e credenciais ficam fora do Git e deste checkpoint.
- Administradores podem mudar perfis de membros; a própria conta e o último administrador são protegidos.

## Concluído e verificado

- V1 pública da Comunidade Koinonia publicada em `https://comunia-theta.vercel.app/`.
- Gerenciamento de perfis implementado e publicado.
- Credencial administrativa de produção renovada e sessões antigas revogadas. A conta `admin/admin` é somente local.
- Cabeçalhos de segurança, validação de origem, cookies seguros, limites de requisição e proteção de rotas ativos.
- Revisão do Vibe Coding Toolkit registrada em `docs/AVALIACAO-VIBE-CODING-TOOLKIT.md`.
- Dependabot e workflow “Qualidade e segurança” ativos. O workflow executa instalação reproduzível, auditoria de produção, banco temporário, testes e build.
- Última validação da aplicação: build aprovado, 12 testes aprovados, auditoria de produção sem vulnerabilidades conhecidas e smoke test da nuvem com 28 requisições.
- Commit `aa7f761` criou a primeira versão da skill de continuidade. Ela está sendo corrigida nesta etapa para usar um checkpoint compacto periódico.

## Continuidade automática

- Automação “Compactar contexto do ComunIA” ativa a cada 30 minutos nesta thread. Ela reescreve este arquivo somente quando houver mudança material e não executa commit, push ou deploy.
- Limite do checkpoint: até 120 linhas e aproximadamente 1.200 palavras.
- O arquivo bruto de aproximadamente 28 MB criado na tentativa anterior foi removido do projeto; o registro original da thread no Codex foi preservado.

## Próximos passos recomendados

- Autenticação multifator e recuperação segura de senha.
- Trilha de auditoria administrativa, retenção e exclusão de dados conforme LGPD.
- Backup com restauração testada e monitoramento de incidentes.
- Divisão gradual de `src/App.tsx` e `server/app.ts` e regras de lint para fronteiras de autenticação.
- Revisar atualização oficial das ações do GitHub que ainda emitem aviso sobre runtime Node.js antigo.

## Referências

- `AGENTS.md`: comandos e regras obrigatórias.
- `.agents/skills/comunia-contexto/SKILL.md`: processo de manutenção deste checkpoint.
- `README.md`: visão geral e execução.
- `docs/HOSPEDAGEM.md`: implantação.
- `docs/AVALIACAO-VIBE-CODING-TOOLKIT.md`: avaliação e lacunas de segurança.
