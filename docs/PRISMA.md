# Prisma no ComunIA

O Prisma ORM faz sentido aqui para consultas tipadas em TypeScript e para versionar a evolução do banco. Ele se conecta ao PostgreSQL já existente; não substitui a Neon nem exige outro serviço de hospedagem. Foi adotada a versão estável 7.10.0, com `@prisma/adapter-pg` e o mesmo pool `pg` utilizado pelas transações SQL.

## O que está integrado

- Login, criação de membros, sessões e leitura do perfil.
- Agenda com contagem filtrada de inscrições e relação entre inscrições e eventos.
- Avisos, leitura de notificações e marcação de leitura.
- Histórico e gravação das mensagens; consultas do chatbot a eventos, inscrições e conhecimento.
- Cadastro e edição da base de conhecimento; abertura e conclusão de atendimentos.
- Tratamento de duplicidade e registros ausentes mantém os códigos HTTP 409 e 404.
- Prisma Studio disponível como ferramenta local para consultar e editar o banco.

Inscrições, pagamentos simulados, edição concorrente de eventos, publicação com notificações, relatório administrativo e limite atômico de login mantêm o SQL existente. Essa combinação é intencional: preserva os bloqueios `SELECT ... FOR UPDATE`, as transações e os contratos da V1. Não há um pool extra para o Prisma.

## Esquema e migrações

`prisma/schema.prisma` foi obtido por introspecção das 11 tabelas existentes. Os nomes, tipos, índices, relações e nulabilidade foram preservados. O cliente tipado é gerado em `server/generated/prisma` e não é enviado ao GitHub: `npm run build` o gera novamente antes de compilar.

O gerador usa `importFileExtension = "js"` para que os imports internos funcionem após a compilação TypeScript das funções na Vercel.

A migração `prisma/migrations/0_initial/migration.sql` representa o estado inicial e inclui explicitamente as sete constraints `CHECK` que o datamodel Prisma não representa integralmente. As regras continuam sendo impostas pelo PostgreSQL. Revise essas constraints quando alterar os campos relacionados.

Nos bancos local e Neon existentes, a migração inicial foi marcada como aplicada (`migrate resolve`), sem recriar tabelas. Foram comparados esquema, constraints e registros antes/depois. Backups privados da verificação estão em `.local`, fora do Git e da publicação.

Para um banco novo, `npm run db:migrate` cria a estrutura. Para alterações futuras:

1. Ajuste o datamodel.
2. Em um banco de desenvolvimento isolado, gere a migração com `npm exec prisma -- migrate dev --name nome_da_alteracao`.
3. Revise o SQL e execute os testes, incluindo concorrência de vagas e pagamentos.
4. Aplique a migração revisada no banco de destino com `npm run db:migrate` antes de publicar código que dependa dela.

Não use `migrate reset`, `db push` ou `migrate dev` no banco online. A geração do cliente durante o build não altera o banco. Migrações não são executadas automaticamente em cada build da Vercel.

O arquivo `server/schema.sql` é o retrato histórico da V1 e não é mais executado pelo setup/seed. Novas mudanças de estrutura devem entrar somente pelo histórico Prisma. O antigo script `scripts/migrate-cloud.ts` continua sendo uma ferramenta de cópia inicial para um destino vazio, não uma ferramenta de atualização de produção.

## Comandos

| Comando               | Finalidade                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- |
| `npm run db:generate` | Gerar o cliente tipado após mudar o schema                                          |
| `npm run db:migrate`  | Aplicar migrações pendentes, sem reset                                              |
| `npm run db:studio`   | Iniciar o Prisma Studio local; abrir a URL exibida no terminal                      |
| `npm run db:cleanup`  | Remover sessões e contadores de login já expirados                                  |
| `npm run setup`       | Iniciar o banco local, aplicar migrações, gerar cliente e inserir exemplos ausentes |

Para a CLI, `prisma.config.ts` prioriza `DATABASE_URL_UNPOOLED` quando disponível. As requisições usam `DATABASE_URL`, com pool na Neon. Nenhuma conexão é enviada ao front-end. O Studio deve permanecer local, acessível apenas a quem administra o banco.

## Verificação

A migração foi aplicada a um banco temporário vazio, comparada com o datamodel e reaplicada sem mudanças pendentes. As sete constraints foram conferidas. Os testes de integração cobrem login, permissões, unicidade, registros ausentes, concorrência pela última vaga, pagamento/cancelamento, chatbot, cookies e limite distribuído.

Nesta entrega passaram nove testes locais e 18 verificações HTTP na implantação da Vercel. Após a promoção, foram confirmados novamente o health, a autenticação administrativa e a listagem de eventos no domínio público. Os identificadores de implantação e as evidências operacionais ficam no painel privado do provedor. As contas e dados temporários dos testes foram removidos.

Foram fixadas versões corrigidas das dependências transitivas `deepmerge-ts` e `mysql2` por overrides. A configuração Prisma, a geração do cliente e as migrações foram testadas com essas versões. A auditoria de dependências de produção não reportou vulnerabilidades nesta revisão; continuam os avisos já conhecidos da cadeia de desenvolvimento Metro.

Fontes: [Prisma e Vercel Fluid](https://www.prisma.io/docs/orm/v7/prisma-client/deployment/serverless/deploy-to-vercel), [adoção em banco existente](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/baselining), [introspecção](https://docs.prisma.io/docs/cli/v7/db/pull).
