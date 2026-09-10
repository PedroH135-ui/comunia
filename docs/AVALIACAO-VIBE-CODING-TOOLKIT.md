# Avaliação do Vibe Coding Toolkit para o ComunIA

Revisão feita em 09/09/2026 sobre o commit `13add21194467dfd2fc5b408ddb3398d306a4c78` do repositório `soumatheusgomes/vibe-coding-toolkit`. Foram inventariados 39 arquivos e 7.552 linhas. O toolkit contém documentação, prompts e exemplos de configuração; ele não é uma biblioteca de segurança de aplicação.

## O que foi aproveitado agora

| Recurso do toolkit              | Aplicação no ComunIA                                                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruções curtas por projeto   | `AGENTS.md` registra comandos canônicos e invariantes de segurança para futuras sessões de desenvolvimento.                                          |
| Quality gates mensuráveis       | O workflow `quality-security.yml` executa instalação reproduzível, auditoria de dependências de produção, migração em banco efêmero, testes e build. |
| Dependências sob acompanhamento | Dependabot verifica atualizações npm semanalmente e separa dependências de produção e desenvolvimento.                                               |
| Versões fixadas em automações   | As ações oficiais `checkout` e `setup-node` estão fixadas por SHA, reduzindo o risco de uma tag mutável ser substituída.                             |
| Proteção de segredos            | A credencial administrativa online foi renovada, sessões antigas foram revogadas e a senha deixou de aparecer na documentação versionada.            |
| Verificação antes da publicação | O smoke test da nuvem valida cabeçalhos, login, autorização, troca de perfil, inscrição, cancelamento e chatbot antes da promoção do domínio.        |

Também foram adicionados CSP, HSTS, bloqueio de frames, políticas de origem e restrições de recursos no Express e na Vercel. Essas proteções são necessárias para o produto, embora não sejam fornecidas pelo toolkit.

## Recursos recomendados para a próxima etapa

1. **Sanitização de projeto.** Adotar o ciclo medir, classificar, corrigir e medir novamente. Os comandos do ComunIA são `npm run build`, `npm test` e `npm audit --omit=dev --audit-level=high`.
2. **ESLint em duas camadas.** Começar com regras que representam bugs ou fronteiras reais: promessas não aguardadas, imports inseguros, acesso direto ao banco pela UI e uso indevido de entradas sem limite. Regras novas devem começar como aviso quando já houver dívida.
3. **Gate de autenticação.** Adaptar a ideia do documento de ESLint para garantir que novas rotas privadas usem `auth` e que rotas administrativas usem `admin`. O toolkit descreve esse gate, mas não entrega uma implementação pronta para Express.
4. **Revisão especializada de segurança.** Mudanças em login, papéis, dados pessoais, pagamentos e integrações devem ter uma revisão separada com foco em autorização, injeção, segredos e dependências.
5. **Divisão gradual dos arquivos grandes.** `src/App.tsx` e `server/app.ts` estão acima do teto sugerido de 350 linhas. A separação deve ocorrer por responsabilidade, mantendo interfaces e testes, em lotes pequenos.
6. **Memória local curta.** Registrar somente regras de negócio difíceis de deduzir. Nunca guardar senhas, URLs de banco, tokens, dados de membros ou conteúdo privado em memória de agente ou serviço externo.

## Recursos que não devem ser instalados agora

| Recurso                              | Decisão                                                                                                                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Superpowers e plugins do Claude Code | O projeto está sendo desenvolvido com Codex; instalar outro harness não melhora a segurança do produto.                                                                       |
| RTK                                  | O próprio toolkit o apresenta como padrão documentado, sem binário público para instalar.                                                                                     |
| Graphify                             | A análise de código por AST pode ser local, mas documentos e exportações podem envolver outros serviços. Deve esperar uma revisão específica de privacidade e fluxo de dados. |
| Context7                             | Útil para documentação atualizada, mas é um serviço externo e usa OAuth/API key. Consultas diretas às documentações oficiais atendem o projeto atualmente.                    |
| Obsidian ou memória externa          | Aumenta os lugares onde contexto pode persistir. Não é necessário enquanto o repositório e a documentação local forem suficientes.                                            |
| Hooks de agente como única proteção  | Hooks locais podem ser ignorados ou falhar. Segurança deve ser validada novamente na CI e no servidor.                                                                        |

## Estado observado no ComunIA

- Repositório GitHub privado, com apenas o proprietário como colaborador e sem deploy keys ou webhooks cadastrados.
- Proteção de branch indisponível no plano atual do repositório privado; a API do GitHub exige upgrade para ativá-la nesse cenário.
- `.env`, `.local/`, backups e credenciais estão ignorados pelo Git. O único arquivo de ambiente rastreado é `.env.example`, com valores fictícios.
- Nenhuma vulnerabilidade foi encontrada nas dependências carregadas em produção por `npm audit --omit=dev`.
- A árvore completa instalada apresenta alertas altos em dependências de ferramentas React Native/Metro; elas não aparecem na árvore de produção. Devem continuar sendo acompanhadas e atualizadas sem `npm audit fix --force` automático.
- O sistema já usa consultas parametrizadas, Zod, cookies `HttpOnly`/`Secure`/`SameSite=Strict`, restrição de origem, limitação distribuída de tentativas e autorização consultada no banco a cada requisição.

## Lacunas que o toolkit não resolve

O toolkit não oferece autenticação multifator, recuperação segura de senha, criptografia de dados pessoais, trilha de auditoria administrativa, política de retenção, backup testado, monitoramento de incidentes ou conformidade com a LGPD. Essas são as próximas frentes de segurança do produto.
