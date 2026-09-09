import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { pool, query } from './db.js';
import { hash } from './security.js';
if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
  throw new Error(
    'Seed de contas públicas permitido apenas no ambiente local. Use a migração de nuvem documentada.',
  );
}
await query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
for (const [name, email, role] of [
  ['Felipe', 'membro@comunia.local', 'member'],
  ['Marina Costa', 'admin@comunia.local', 'admin'],
]) {
  await query(
    'INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING',
    [name, email, role, hash(role === 'admin' ? 'admin' : 'Comunia@123')],
  );
}
if (!(await query('SELECT 1 FROM events LIMIT 1')).rowCount) {
  const date = (days: number, hour = 19) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const events = [
    [
      'Encontro de jovens',
      'Uma noite para criar conexões, compartilhar histórias e renovar a esperança. Teremos música, uma conversa sobre propósito e um café especial. Convide um amigo e venha como você é.',
      'Jovens',
      date(4),
      'Espaço de convivência',
      80,
      0,
      'forest',
    ],
    [
      'Retiro Raízes',
      'Um dia para desacelerar, fortalecer a fé e cultivar novas amizades. Inclui almoço, transporte saindo da comunidade e atividades em grupo. Traga sua garrafa de água e roupas confortáveis.',
      'Retiro',
      date(11, 8),
      'Sítio Boa Esperança',
      40,
      8500,
      'sand',
    ],
    [
      'Café em comunidade',
      'Um café da manhã para receber novas pessoas, conhecer os grupos da comunidade e conversar sem pressa. Cada pessoa pode trazer algo para compartilhar.',
      'Comunidade',
      date(6, 9),
      'Salão principal',
      60,
      0,
      'peach',
    ],
    [
      'Mãos que transformam',
      'Vamos organizar alimentos e montar cestas para famílias do bairro. Um pequeno gesto, uma grande diferença. Toda ajuda é bem-vinda.',
      'Voluntariado',
      date(9, 14),
      'Ponto de apoio social',
      30,
      0,
      'sage',
    ],
    [
      'Oficina de música',
      'Uma tarde de prática e descoberta para quem quer começar ou voltar a tocar. Instrumentos disponíveis para as primeiras atividades. Não é necessário ter experiência.',
      'Oficina',
      date(15, 15),
      'Sala de música',
      20,
      2500,
      'blue',
    ],
  ];
  for (const e of events)
    await query(
      'INSERT INTO events(title,description,category,starts_at,location,capacity,price_cents,theme) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      e,
    );
}
if (!(await query('SELECT 1 FROM knowledge LIMIT 1')).rowCount) {
  for (const k of [
    [
      'Horários dos encontros',
      'culto,horario,reuniao,domingo,celebracao',
      'Na Comunidade Horizonte, os encontros acontecem aos domingos, às 9h e às 19h, e às quartas-feiras, às 19h30. Estes são dados fictícios da demonstração.',
    ],
    [
      'Como chegar',
      'endereco,localizacao,chegar,onde fica',
      'Nossa comunidade de demonstração fica na Rua das Oliveiras, 120, Centro. Endereço fictício para esta V1.',
    ],
    [
      'Grupos e departamentos',
      'jovens,criancas,infantil,departamento,ministerio,grupo',
      'Temos grupos de jovens, acolhimento infantil, música e ação social. Consulte Eventos para ver os próximos encontros ou solicite atendimento para saber como participar.',
    ],
    [
      'Batismo',
      'batismo,batizar',
      'Para saber sobre preparação e datas de batismo, escreva “atendente”. A equipe poderá orientar você; não há uma data de batismo cadastrada nesta demonstração.',
    ],
    [
      'Sobre o ComunIA',
      'comunia,ajuda,funciona',
      'Sou o assistente do ComunIA. Posso consultar eventos, inscrições, horários e informações cadastradas pela comunidade. Ainda não uso IA generativa: respondo por intenções e base de conhecimento.',
    ],
  ])
    await query('INSERT INTO knowledge(title,keywords,answer) VALUES($1,$2,$3)', k);
}
if (!(await query('SELECT 1 FROM notices LIMIT 1')).rowCount) {
  await query(
    "INSERT INTO notices(title,body,category) VALUES ('Um lugar para pertencer','Seja bem-vindo à Comunidade Horizonte! Este é um espaço de demonstração do ComunIA. Explore os encontros, faça uma inscrição e converse com nosso assistente.','Boas-vindas'),('Campanha de alimentos','Nosso ponto de apoio está recebendo alimentos não perecíveis. Participe do evento Mãos que transformam para ajudar na organização.','Ação social'),('Sua comunidade, na palma da mão','Agora você pode acompanhar a agenda e suas inscrições aqui. As notificações desta V1 ficam na sua caixa de entrada no aplicativo.','Novidade')",
  );
  await query(
    "INSERT INTO notifications(user_id,title,body) SELECT id,'Que bom ter você aqui!','Seu espaço na Comunidade Horizonte está pronto. Conheça a agenda e participe.' FROM users",
  );
}
await pool.end();
console.log(
  'Banco preparado com dados fictícios. Login: membro@comunia.local ou admin@comunia.local / Comunia@123',
);
