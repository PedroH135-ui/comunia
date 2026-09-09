# ComunIA — pesquisa comparativa e revisão da interface

Consulta em **8 de setembro de 2026**. Objetivo: melhorar a experiência do membro e a organização do painel do TCC.

A principal decisão desta revisão é tornar **agenda, inscrições e avisos** o centro do aplicativo. O assistente continua disponível como canal de atendimento, sem determinar toda a identidade visual.

## Escopo da pesquisa

Benchmark qualitativo de quatro produtos, com páginas oficiais, documentação e apresentações públicas. Foi inspecionada visualmente a apresentação pública da inscrição do Church Center. Não foram criadas contas comerciais nem testados os sistemas completos. As funcionalidades abaixo são divulgadas pelos fornecedores; não representam medições independentes de facilidade de uso, participação de mercado ou satisfação.

## Comparação

| Sistema                             | Evidência pública                                                                                                                                                                                                  | Aplicação ao ComunIA                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Church Center / Planning Center** | Agenda ligada à inscrição e ao pagamento; detalhes de data/horário; categorias de eventos; acesso ao histórico de inscrições. Há uma separação explícita entre o aplicativo da congregação e o de administradores. | Agenda cronológica, filtros por categoria, ação de inscrição junto dos detalhes e acesso às inscrições já realizadas. A administração continua em uma seção própria.                           |
| **Eklesia**                         | Portal personalizável com identidade da igreja; agenda, notificações, boletins e informações institucionais.                                                                                                       | Dar protagonismo à comunidade e ao mural; manter nomes de seções diretos; trocar decoração genérica por uma identidade visual consistente.                                                     |
| **InPeace**                         | Plataforma distingue aplicativo da igreja, web e painel administrativo; reúne eventos, membros, publicações e notificações.                                                                                        | Organizar as tarefas em seções reconhecíveis, manter avisos separados de inscrições e tratar chatbot como atendimento.                                                                         |
| **Atos6 / Atos6 Prime**             | Eventos com indicadores, pesquisa de inscrições, pagamento e check-in; aplicativo com programação e notícias.                                                                                                      | Exibir estado da inscrição e disponibilidade de vagas, facilitar acesso ao ingresso e deixar clara a diferença entre consulta do membro e gestão. Check-in não foi implementado nesta revisão. |

Fontes próximas de cada evidência:

- Church Center: [aplicativo e inscrição](https://www.planningcenter.com/church-center), [agenda e filtros](https://www.planningcenter.com/calendar), [histórico de inscrições](https://help.planningcenter.com/en/144371-set-up-church-center-pages-for-your-planning-center-products.html), [separação dos perfis](https://www.planningcenter.com/app).
- Eklesia: [aplicativo e funcionalidades](https://eklesia.com.br/aplicativo/).
- InPeace: [gestão, comunicação e canais](https://inpeaceapp.com/pt/).
- Atos6: [gestão de eventos](https://home.atos6.com/features/event-management/) e [aplicativo Prime](https://prime.atos6.com/).

## Decisões de interface implementadas

Estas são inferências de design para o ComunIA, não conclusões de testes com usuários dos concorrentes.

1. **Página inicial com informação real.** O destaque mostra o próximo evento do banco, data, horário, local e valor. Sai o banner de paisagens e slogans.
2. **Próximo compromisso do membro.** Quando há inscrição futura, aparece um atalho para o ingresso ou para concluir o pagamento simulado.
3. **Agenda em lista ou cartões.** Lista por padrão para comparar datas rapidamente; cartões continuam disponíveis. Busca e categorias funcionam nas duas apresentações.
4. **Inscrições reconhecidas.** A agenda sinaliza quando a pessoa já está inscrita. O detalhe oferece “Abrir minha inscrição”, em vez de encerrar o fluxo em um botão desabilitado.
5. **Navegação móvel.** Barra inferior para Início, Agenda, Inscrições, Mural e Assistente. O menu completo mantém acesso à administração.
6. **Identidade sóbria.** Fundo claro, azul escuro, acento terracota, menos sombras e cantos menores. Tipografia e títulos mais legíveis. Capas tipográficas substituem montanhas, folhas e brilhos decorativos.
7. **Textos objetivos.** Rótulos voltados à tarefa, menos frases promocionais e “Assistente da comunidade” como ponto de atendimento.
8. **Abas com comportamento acessível.** Categorias e administração usam o componente Tabs da Origin UI, baseado em Radix, com estado selecionado e navegação por teclado.

## Uso do 21st.dev

Componente selecionado: [Origin UI — Tabs](https://21st.dev/@originui/components/tabs). A página do catálogo informa licença MIT; o código-fonte e a licença foram obtidos do [repositório público](https://github.com/shadcn/originui).

A integração é de código React, não uma extensão do navegador. O componente foi adaptado para o CSS existente e o pacote específico `@radix-ui/react-tabs`. Créditos e licença completos em `THIRD_PARTY_NOTICES.md`.

## Limites da revisão

- Não há alegação de aumento mensurado de conversão ou satisfação. Isso exige testes com membros reais.
- Não foram copiadas marcas, telas inteiras ou imagens dos concorrentes.
- Pagamentos continuam simulados; notificações continuam dentro do aplicativo. WhatsApp, push, check-in e APK não foram adicionados.
- A identidade final ainda deve receber nome, logotipo, informações e, se desejado, fotografias autorizadas da igreja real.

## Próxima validação com membros

Pedir a pessoas de idades e familiaridades digitais diferentes que encontrem um evento, façam a inscrição, abram o ingresso e localizem um aviso sem orientação. Registrar dificuldades e tempo por tarefa; ajustar a interface a partir dessas observações, sem inventar métricas antes do teste.

## Verificação desta entrega

- Compilação TypeScript e Vite concluída sem erros.
- Inspeção visual no desktop e em viewport de 390 × 844, sem transbordamento horizontal da página inicial.
- Alternância entre lista/cartões e filtros de categoria conferida no navegador; seleção por seta do teclado validada nas abas de categoria.
- Navegação inferior e tela do assistente conferidas no celular.
- Perfil de membro com inscrições existentes: atalho da página inicial e ação Abrir minha inscrição levam à lista de inscrições, onde o ingresso pode ser aberto.
- Abas da administração conferidas, incluindo a base de conhecimento do chatbot.
- Correções finais de contraste do botão de atendimento e espaçamento do título móvel confirmadas na versão compilada.
