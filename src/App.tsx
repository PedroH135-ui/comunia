import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
const cloudDeployment = import.meta.env.VITE_CLOUD === '1';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { View, Text, TextInput, Pressable, useWindowDimensions } from 'react-native-web';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock,
  Compass,
  Heart,
  Home,
  Leaf,
  LogOut,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Church,
  List,
  Grid2X2,
  Ticket,
  Users,
  X,
  Wallet,
  BookOpen,
  LayoutDashboard,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Menu,
  Mail,
  Flower2,
  Sun,
  Music,
  HandHeart,
  LoaderCircle,
} from 'lucide-react';
import {
  api,
  post,
  money,
  date,
  time,
  type User,
  type Event,
  type Registration,
  type Notice,
  type Notification,
  type Message,
  type Knowledge,
  type Overview,
} from './api';

// Shared layout and input primitives use React Native for Web. CSS is the web presentation layer.
const Box = ({
  className = '',
  children,
  ...rest
}: {
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}) => (
  <View {...rest} dataSet={{ ui: className }}>
    {children}
  </View>
);
const T = ({
  className = '',
  children,
  ...rest
}: {
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}) => (
  <Text {...rest} dataSet={{ ui: className }}>
    {children}
  </Text>
);
const Button = ({
  children,
  onClick,
  variant = '',
  disabled = false,
  className = '',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
}) => (
  <Pressable
    {...({ role: 'button', 'aria-label': label } as any)}
    disabled={disabled}
    onPress={onClick}
    dataSet={{ ui: `button ${variant} ${className} ${disabled ? 'disabled' : ''}` }}
  >
    {children}
  </Pressable>
);
const Field = ({
  label,
  value,
  onChange,
  placeholder = '',
  multiline = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secure?: boolean;
}) => (
  <Box className="field">
    <T className="field-label">{label}</T>
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      multiline={multiline}
      secureTextEntry={secure}
      dataSet={{ ui: `input ${multiline ? 'textarea' : ''}` }}
    />
  </Box>
);
const Empty = ({
  icon = <Compass size={28} />,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) => (
  <Box className="empty">
    <Box className="empty-icon">{icon}</Box>
    <T className="empty-title">{title}</T>
    <T className="muted center">{body}</T>
    {action}
  </Box>
);
const Badge = ({ children, kind = '' }: { children: ReactNode; kind?: string }) => (
  <T className={`badge ${kind}`}>{children}</T>
);
const Status = ({ status }: { status: string }) => (
  <Badge kind={status === 'confirmed' ? 'green' : status === 'pending' ? 'amber' : 'gray'}>
    {status === 'confirmed'
      ? 'Confirmada'
      : status === 'pending'
        ? 'Pagamento pendente'
        : 'Cancelada'}
  </Badge>
);
const Brand = ({ small = false }: { small?: boolean }) => (
  <Box className={`brand ${small ? 'small' : ''}`}>
    <Box className="brand-symbol">
      <Church size={23} />
    </Box>
    <T className="brand-name">
      Comun<T className="brand-ia">IA</T>
      <T className="brand-dot">.</T>
    </T>
  </Box>
);
const navItems = [
  { id: 'home', label: 'Visão geral', icon: Home },
  { id: 'events', label: 'Explorar eventos', icon: CalendarDays },
  { id: 'registrations', label: 'Minhas inscrições', icon: Ticket },
  { id: 'notices', label: 'Mural da comunidade', icon: BookOpen },
  { id: 'chat', label: 'Assistente da comunidade', icon: MessageCircle },
];
function Art({
  theme = 'forest',
  category = 'Comunidade',
  hero = false,
}: {
  theme?: string;
  category?: string;
  hero?: boolean;
}) {
  return (
    <Box className={`event-art ${theme} ${hero ? 'hero-art' : ''}`}>
      <div className="poster-label">
        {hero ? 'COMUNIDADE HORIZONTE' : 'AGENDA / ' + category.toUpperCase()}
      </div>
      <div className="poster-heading">
        {hero ? (
          <>
            A vida acontece
            <br />
            em comunidade.
          </>
        ) : category === 'Retiro' ? (
          <>
            Tempo para
            <br />
            renovar.
          </>
        ) : category === 'Jovens' ? (
          <>
            A próxima
            <br />
            geração.
          </>
        ) : category === 'Voluntariado' ? (
          <>
            Fazer parte.
            <br />
            Fazer o bem.
          </>
        ) : category === 'Oficina' ? (
          <>
            Aprender.
            <br />
            Compartilhar.
          </>
        ) : (
          <>
            Nossa mesa.
            <br />
            Seu lugar.
          </>
        )}
      </div>
      <div className="poster-footer">
        <span>HORIZONTE</span>
        <ArrowUpRight size={27} />
      </div>
    </Box>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState('home');
  const [events, setEvents] = useState<Event[]>([]),
    [registrations, setRegistrations] = useState<Registration[]>([]),
    [notices, setNotices] = useState<Notice[]>([]),
    [notifications, setNotifications] = useState<Notification[]>([]);
  const [modal, setModal] = useState<ReactNode>(null),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button,[role="button"],input,textarea,select,[tabindex="0"]',
        ) || [],
      ).filter((el) => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal(null);
      if (e.key === 'Tab') {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [modal]);
  const notify = (message: string) => {
    setToast(message);
  };
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const refresh = async () => {
    setLoading(true);
    try {
      const [e, r, n, a] = await Promise.all([
        api<Event[]>('/events'),
        api<Registration[]>('/registrations'),
        api<Notice[]>('/notices'),
        api<Notification[]>('/notifications'),
      ]);
      setEvents(e);
      setRegistrations(r);
      setNotices(n);
      setNotifications(a);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch(() => {})
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (user) void refresh();
  }, [user]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(
      () => {
        if (document.visibilityState !== 'visible') return;
        api<Notification[]>('/notifications')
          .then(setNotifications)
          .catch(() => {});
      },
      cloudDeployment ? 60000 : 15000,
    );
    return () => clearInterval(timer);
  }, [user]);
  const go = (target: string) => {
    setPage(target);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const logout = async () => {
    try {
      await post('/auth/logout');
      setUser(null);
      setEvents([]);
      setRegistrations([]);
      setNotices([]);
      setNotifications([]);
      setPage('home');
      setModal(null);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const inspect = (event: Event) =>
    setModal(
      <EventDetail
        event={event}
        viewRegistration={() => {
          setModal(null);
          go('registrations');
        }}
        registration={registrations.find(
          (r) => r.event_id === event.id && r.status !== 'cancelled',
        )}
        close={() => setModal(null)}
        register={async () => {
          const r = await post<Registration>(`/events/${event.id}/register`);
          await refresh();
          setModal(null);
          go('registrations');
          notify(
            r.status === 'pending'
              ? 'Vaga reservada! Conclua o pagamento de demonstração.'
              : 'Inscrição confirmada. Esperamos você!',
          );
        }}
      />,
    );
  const unread = notifications.filter((n) => !n.read).length;
  if (boot)
    return (
      <Box className="boot">
        <Brand />
        <LoaderCircle className="spin" />
        <T className="muted">Preparando seu espaço…</T>
      </Box>
    );
  if (!user) return <Login onLogin={setUser} />;
  const titles: Record<string, string> = {
    home: 'Seu espaço na comunidade',
    events: 'Agenda da comunidade',
    registrations: 'Minhas inscrições',
    notices: 'Mural da comunidade',
    chat: 'Atendimento',
    notifications: 'Sua caixa de novidades',
    admin: 'Cuidar da comunidade',
  };
  return (
    <Box className="app-shell">
      {menu && <div className="mobile-scrim" onClick={() => setMenu(false)} />}
      <aside inert={width <= 650 && !menu} className={`sidebar ${menu ? 'open' : ''}`}>
        <Brand />
        <Box className="community-switch">
          <Box className="community-icon">
            <Sun size={20} />
          </Box>
          <Box>
            <T className="community-name">Comunidade Horizonte</T>
            <T className="tiny muted">Um lugar para pertencer</T>
          </Box>
        </Box>
        <T className="nav-caption">MINHA COMUNIDADE</T>
        <nav>
          {navItems.map((n) => (
            <Button
              key={n.id}
              variant={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              <T>{n.label}</T>
            </Button>
          ))}
        </nav>
        {user.role === 'admin' && (
          <>
            <T className="nav-caption admin-caption">GESTÃO</T>
            <Button
              variant={`nav-item ${page === 'admin' ? 'active' : ''}`}
              onClick={() => go('admin')}
            >
              <LayoutDashboard size={19} />
              <T>Painel administrativo</T>
            </Button>
          </>
        )}
        <Box className="sidebar-bottom">
          <Box className="sidebar-note">
            <Heart size={20} />
            <T className="sidebar-note-title">
              Comunidade Horizonte
              <br />
              Portal dos membros
            </T>
            <T className="tiny muted">
              Eventos, informações e<br />
              atendimento em um só lugar.
            </T>
          </Box>
          <Box className="local-indicator">
            <span />
            <T>Ambiente de demonstração</T>
          </Box>
        </Box>
      </aside>
      <Box className="workspace">
        <header className="topbar">
          <Box className="row topbar-left">
            <Button
              variant="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              label="Abrir menu"
            >
              <Menu size={22} />
            </Button>
            <T className="breadcrumb">
              Comunidade <ChevronRight size={13} />{' '}
              <T className="breadcrumb-current">
                {page === 'admin'
                  ? 'Administração'
                  : page === 'notifications'
                    ? 'Notificações'
                    : navItems.find((n) => n.id === page)?.label}
              </T>
            </T>
          </Box>
          <Box className="row topbar-actions">
            <Badge kind="outline desktop-only">
              {cloudDeployment ? 'V1 · DEMONSTRAÇÃO' : 'V1 · LOCAL'}
            </Badge>
            <Button
              variant={`icon-button notification-button ${page === 'notifications' ? 'selected' : ''}`}
              onClick={() => go('notifications')}
              label={`Notificações, ${unread} não lidas`}
            >
              <Bell size={20} />
              {unread > 0 && <span className="notification-dot" />}
            </Button>
            <span className="topbar-divider" />
            <Box className="row profile">
              <Box className="avatar">{user.name.slice(0, 1)}</Box>
              <Box className="desktop-only">
                <T className="profile-name">{user.name}</T>
                <T className="tiny muted">
                  {user.role === 'admin' ? 'Administrador' : 'Membro da comunidade'}
                </T>
              </Box>
            </Box>
            <Button variant="icon-button" onClick={logout} label="Sair da conta">
              <LogOut size={17} />
            </Button>
          </Box>
        </header>
        <main className={`main-content ${page === 'chat' ? 'chat-main' : ''}`}>
          <Box className="page-heading">
            <Box>
              <T className="eyebrow">
                {page === 'home'
                  ? 'SEU PAINEL'
                  : page === 'admin'
                    ? 'PAINEL DA COMUNIDADE'
                    : 'COMUNIDADE HORIZONTE'}
              </T>
              <T accessibilityRole="header" className="page-title">
                {page === 'home' ? `Olá, ${user.name.split(' ')[0]}.` : titles[page]}
                {page === 'home' && (
                  <span className="hello-sun">
                    <Sun size={28} />
                  </span>
                )}
              </T>
              <T className="page-subtitle">
                {page === 'home'
                  ? 'Confira a agenda e acompanhe suas inscrições.'
                  : page === 'events'
                    ? 'Há sempre um novo jeito de participar e compartilhar.'
                    : page === 'registrations'
                      ? 'Acompanhe suas inscrições e encontre seus ingressos.'
                      : page === 'notices'
                        ? 'Avisos, histórias e novidades da nossa comunidade.'
                        : page === 'chat'
                          ? 'Informações da comunidade, de um jeito simples e acolhedor.'
                          : page === 'notifications'
                            ? 'Novos eventos, avisos e atualizações das suas inscrições.'
                            : 'Organize encontros, compartilhe informações e acolha pessoas.'}
              </T>
            </Box>
            {page === 'home' && (
              <Box className="today desktop-only">
                <CalendarDays size={16} />
                <T>{date(new Date().toISOString(), { day: 'numeric', month: 'long' })}</T>
              </Box>
            )}
          </Box>
          {error && (
            <Box className="error-banner">
              <AlertCircle size={18} />
              <T>{error}</T>
              <Button variant="text-button" onClick={refresh}>
                Tentar novamente
              </Button>
            </Box>
          )}
          {loading && events.length === 0 ? (
            <Box className="loading">
              <LoaderCircle className="spin" />
              <T>Carregando a comunidade…</T>
            </Box>
          ) : (
            <>
              {page === 'home' && (
                <HomePage
                  events={events}
                  registrations={registrations}
                  notices={notices}
                  unread={unread}
                  go={go}
                  inspect={inspect}
                />
              )}
              {page === 'events' && (
                <EventsPage
                  events={events.filter((e) => e.published)}
                  registrations={registrations}
                  inspect={inspect}
                />
              )}
              {page === 'registrations' && (
                <RegistrationsPage
                  items={registrations}
                  go={go}
                  modal={setModal}
                  refresh={refresh}
                  notify={notify}
                />
              )}
              {page === 'notices' && (
                <Box className="notices-page">
                  {notices.map((n) => (
                    <Box className="notice-full panel" key={n.id}>
                      <Box className="row between">
                        <Badge kind="green">{n.category}</Badge>
                        <T className="tiny muted">
                          {date(n.created_at, { day: 'numeric', month: 'long' })}
                        </T>
                      </Box>
                      <T className="section-title">{n.title}</T>
                      <T className="notice-body">{n.body}</T>
                      <Box className="row notice-author">
                        <Box className="mini-avatar">
                          <Sun size={16} />
                        </Box>
                        <T className="tiny muted">Equipe Comunidade Horizonte</T>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              {page === 'chat' && <ChatPage user={user} />}
              {page === 'notifications' && (
                <Box className="panel notifications-panel">
                  <Box className="section-heading">
                    <T className="section-title">
                      Notificações <span className="count-pill">{unread}</span>
                    </T>
                    <Button
                      variant="text-button"
                      onClick={async () => {
                        try {
                          await post('/notifications/read');
                          await refresh();
                          notify('Todas as notificações foram marcadas como lidas.');
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      <CheckCheck size={16} /> Marcar como lidas
                    </Button>
                  </Box>
                  {notifications.length ? (
                    notifications.map((n) => (
                      <Box className={`notification-row ${!n.read ? 'unread' : ''}`} key={n.id}>
                        <Box className="notification-icon">
                          <Bell size={19} />
                        </Box>
                        <Box className="grow">
                          <T className="card-title">{n.title}</T>
                          <T className="body muted">{n.body}</T>
                          <T className="tiny muted">
                            {date(n.created_at)} · {time(n.created_at)}
                          </T>
                        </Box>
                        {!n.read && <span className="unread-dot" />}
                      </Box>
                    ))
                  ) : (
                    <Empty
                      title="Tudo em dia por aqui"
                      body="As novidades da comunidade aparecerão neste espaço."
                    />
                  )}
                </Box>
              )}
              {page === 'admin' && user.role === 'admin' && (
                <AdminPage
                  events={events}
                  notices={notices}
                  modal={setModal}
                  refresh={refresh}
                  notify={notify}
                />
              )}
            </>
          )}
          <footer className="footer">
            <T>
              ComunIA <span>·</span> Portal da Comunidade Horizonte.
            </T>
            <T>Comunidade fictícia · Versão 1.0</T>
          </footer>
        </main>
      </Box>
      <nav className="mobile-navigation" aria-label="Navegação principal no celular">
        {[
          { id: 'home', label: 'Início', icon: Home },
          { id: 'events', label: 'Agenda', icon: CalendarDays },
          { id: 'registrations', label: 'Inscrições', icon: Ticket },
          { id: 'notices', label: 'Mural', icon: BookOpen },
          { id: 'chat', label: 'Assistente', icon: MessageCircle },
        ].map((n) => (
          <button
            key={n.id}
            aria-current={page === n.id ? 'page' : undefined}
            onClick={() => go(n.id)}
          >
            <n.icon size={20} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      {page !== 'chat' && (
        <Button variant="chat-fab" onClick={() => go('chat')} label="Abrir assistente ComunIA">
          <MessageCircle size={23} />
          <T>Atendimento</T>
          <MessageCircle size={14} />
        </Button>
      )}
      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section className="modal" role="dialog" aria-modal="true" aria-label="Detalhes e ações">
            {modal}
          </section>
        </div>
      )}
      {toast && (
        <Box className="toast" accessibilityRole="alert">
          <CheckCircle2 size={19} />
          <T>{toast}</T>
          <Button variant="icon-button" onClick={() => setToast('')} label="Fechar mensagem">
            <X size={15} />
          </Button>
        </Box>
      )}
    </Box>
  );
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState(cloudDeployment ? '' : 'membro@comunia.local'),
    [password, setPassword] = useState(cloudDeployment ? '' : 'Comunia@123'),
    [name, setName] = useState(''),
    [register, setRegister] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      onLogin(
        await post<User>(`/auth/${register ? 'register' : 'login'}`, {
          email,
          password,
          ...(register ? { name } : {}),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box className="login-shell">
      <Box className="login-story">
        <Brand />
        <Box className="login-copy">
          <T className="eyebrow">BEM-VINDO À COMUNIDADE</T>
          <T className="login-headline">
            Comunidade Horizonte.
            <br />
            Agenda e atendimento.
          </T>
          <T className="login-description">
            Consulte os próximos eventos e suas inscrições.
            <br />
            Informações da comunidade em um só lugar.
          </T>
          <Box className="login-art">
            <Art hero />
            <Box className="login-art-label">
              <Heart size={21} />
              <T>Comunidade Horizonte</T>
            </Box>
          </Box>
        </Box>
        <T className="tiny">ComunIA · Aplicativo para comunidades religiosas</T>
      </Box>
      <Box className="login-form-side">
        <Box className="login-form">
          <Badge kind="green">BEM-VINDO À NOSSA COMUNIDADE</Badge>
          <T className="login-title">{register ? 'Crie sua conta' : 'Entre na sua conta'}</T>
          <T className="muted login-caption">
            {register
              ? 'Crie sua conta para participar da comunidade.'
              : 'Entre para acompanhar a agenda e participar.'}
          </T>
          {register && (
            <Field
              label="Seu nome"
              value={name}
              onChange={setName}
              placeholder="Como podemos chamar você?"
            />
          )}
          <Field label="E-mail" value={email} onChange={setEmail} />
          <Field label="Senha" value={password} onChange={setPassword} secure />
          {error && (
            <T className="form-error" accessibilityRole="alert">
              {error}
            </T>
          )}
          <Button className="full" onClick={submit} disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                {register ? 'Criar minha conta' : 'Entrar na comunidade'}
                <ArrowRight size={18} />
              </>
            )}
          </Button>
          <Button
            variant="text-button"
            onClick={() => {
              setRegister(!register);
              setError('');
            }}
          >
            {register ? 'Já tenho uma conta' : 'Ainda não tem conta? Cadastre-se'}
          </Button>
          {!cloudDeployment && (
            <Box className="demo-logins">
              <T className="field-label">EXPLORE A V1</T>
              <T className="tiny muted">Contas fictícias prontas para testar. Senha: Comunia@123</T>
              <Box className="row">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEmail('membro@comunia.local');
                    setPassword('Comunia@123');
                    setRegister(false);
                  }}
                >
                  <Users size={16} /> Membro
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEmail('admin@comunia.local');
                    setPassword('Comunia@123');
                    setRegister(false);
                  }}
                >
                  <ShieldCheck size={16} /> Administrador
                </Button>
              </Box>
            </Box>
          )}
          <T className="login-disclaimer">Ambiente de demonstração. Pagamentos simulados.</T>
        </Box>
      </Box>
    </Box>
  );
}

function HomePage({
  events,
  registrations,
  notices,
  unread,
  go,
  inspect,
}: {
  events: Event[];
  registrations: Registration[];
  notices: Notice[];
  unread: number;
  go: (s: string) => void;
  inspect: (e: Event) => void;
}) {
  const upcoming = events.filter((e) => e.published && new Date(e.starts_at) > new Date());
  const active = registrations.filter((r) => r.status !== 'cancelled');
  const nextRegistration = [...active]
    .filter((r) => new Date(r.starts_at) > new Date())
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))[0];
  return (
    <>
      <section className="community-brief">
        <div className="brief-intro">
          <span className="brief-kicker">VIDA EM COMUNIDADE</span>
          <h2>
            A semana <br />
            começa por aqui.
          </h2>
          <p>
            Encontros, avisos e tudo o que você precisa para participar da Comunidade Horizonte.
          </p>
          <Button variant="secondary" onClick={() => go('events')}>
            Ver agenda completa <ArrowRight size={17} />
          </Button>
        </div>
        {upcoming[0] ? (
          <button
            className="next-event"
            onClick={() => inspect(upcoming[0])}
            aria-label={`Próximo encontro: ${upcoming[0].title}`}
          >
            <div className="next-event-top">
              <span>PRÓXIMO ENCONTRO</span>
              <span>{money(upcoming[0].price_cents)}</span>
            </div>
            <div className="next-event-date">
              <strong>{date(upcoming[0].starts_at, { day: '2-digit' })}</strong>
              <div>
                <span>{date(upcoming[0].starts_at, { month: 'long' }).toUpperCase()}</span>
                <span>
                  {date(upcoming[0].starts_at, { weekday: 'long' })} · {time(upcoming[0].starts_at)}
                </span>
              </div>
            </div>
            <h3>{upcoming[0].title}</h3>
            <div className="next-event-bottom">
              <span>
                <MapPin size={15} />
                {upcoming[0].location}
              </span>
              <span className="next-event-arrow">
                <ArrowUpRight size={22} />
              </span>
            </div>
          </button>
        ) : (
          <div className="next-event next-event-empty">
            <CalendarDays size={32} />
            <h3>A agenda está sendo preparada.</h3>
            <p>Os novos encontros aparecerão aqui.</p>
          </div>
        )}
      </section>
      <Box className="stats-grid">
        <Stat
          icon={<CalendarDays />}
          value={String(upcoming.length).padStart(2, '0')}
          label="Encontros na agenda"
          hint="Eventos publicados"
          onClick={() => go('events')}
          color="green"
        />
        <Stat
          icon={<Ticket />}
          value={String(active.length).padStart(2, '0')}
          label="Minhas inscrições"
          hint="Acompanhe suas reservas"
          onClick={() => go('registrations')}
          color="peach"
        />
        <Stat
          icon={<Bell />}
          value={String(unread).padStart(2, '0')}
          label="Novidades para você"
          hint="Notificações não lidas"
          onClick={() => go('notifications')}
          color="purple"
        />
      </Box>
      {nextRegistration && (
        <div className="my-next-event">
          <div className="my-next-icon">
            <Ticket size={23} />
          </div>
          <div>
            <span>NA SUA AGENDA</span>
            <strong>{nextRegistration.title}</strong>
            <p>
              {date(nextRegistration.starts_at, { day: 'numeric', month: 'long' })} ·{' '}
              {time(nextRegistration.starts_at)}
              {nextRegistration.status === 'pending' ? ' · Pagamento simulado pendente' : ''}
            </p>
          </div>
          <Button variant="text-button" onClick={() => go('registrations')}>
            {nextRegistration.status === 'pending' ? 'Concluir inscrição' : 'Minhas inscrições'}{' '}
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <Box className="home-columns">
        <Box className="home-primary">
          <Box className="section-heading">
            <Box>
              <T className="section-title">Próximos encontros</T>
              <T className="muted body">Confira as próximas datas da comunidade.</T>
            </Box>
            <Button variant="text-button" onClick={() => go('events')}>
              Ver agenda <ArrowRight size={16} />
            </Button>
          </Box>
          <Box className="featured-events">
            {upcoming.slice(0, 2).map((e) => (
              <EventCard
                event={e}
                key={e.id}
                registered={registrations.some(
                  (r) => r.event_id === e.id && r.status !== 'cancelled',
                )}
                onClick={() => inspect(e)}
              />
            ))}
            {!upcoming.length && (
              <Empty
                title="Novos encontros vêm aí"
                body="A agenda aparecerá aqui assim que a equipe publicar um evento."
              />
            )}
          </Box>
        </Box>
        <Box className="home-aside">
          <Box className="section-heading">
            <T className="section-title">No mural</T>
            <span className="mini-dot" />
          </Box>
          <Box className="notice-preview panel">
            {notices.slice(0, 2).map((n, i) => (
              <Box key={n.id} className={`notice-snippet ${i ? 'with-border' : ''}`}>
                <Box className="row between">
                  <Badge kind={i ? 'green' : 'amber'}>{n.category}</Badge>
                  <T className="tiny muted">{date(n.created_at)}</T>
                </Box>
                <T className="card-title">{n.title}</T>
                <T className="notice-excerpt">{n.body}</T>
              </Box>
            ))}
            <Button variant="text-button notice-link" onClick={() => go('notices')}>
              Abrir mural da comunidade <ArrowUpRight size={15} />
            </Button>
          </Box>
          <Box className="assistant-teaser">
            <Box className="row">
              <Box className="assistant-icon">
                <MessageCircle size={20} />
              </Box>
              <T className="card-title">Precisa de uma informação?</T>
            </Box>
            <T className="muted body">
              Horários, eventos ou uma dúvida?
              <br />
              Converse com o assistente ComunIA.
            </T>
            <Button variant="text-button" onClick={() => go('chat')}>
              Abrir conversa <ArrowRight size={16} />
            </Button>
          </Box>
        </Box>
      </Box>
    </>
  );
}
function Stat({
  icon,
  value,
  label,
  hint,
  onClick,
  color,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  hint: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <Button variant="stat-card" onClick={onClick}>
      <Box className={`stat-icon ${color}`}>{icon}</Box>
      <Box className="stat-content">
        <T className="stat-label">{label}</T>
        <T className="stat-value">{value}</T>
        <T className="stat-hint">{hint}</T>
      </Box>
      <ArrowUpRight size={17} className="stat-arrow" />
    </Button>
  );
}
function EventCard({
  event: e,
  onClick,
  registered = false,
}: {
  event: Event;
  onClick: () => void;
  registered?: boolean;
}) {
  return (
    <Box className="event-card">
      <Pressable
        {...({ role: 'button', 'aria-label': `Ver detalhes de ${e.title}` } as any)}
        onPress={onClick}
      >
        <Art theme={e.theme} category={e.category} />
        <Box className="event-date">
          <T>{date(e.starts_at, { day: '2-digit' })}</T>
          <T>{date(e.starts_at, { month: 'short' }).replace('.', '').toUpperCase()}</T>
        </Box>
      </Pressable>
      <Box className="event-card-body">
        <Box className="row between">
          <Badge kind="subtle">{e.category}</Badge>
          <T className={`event-price ${e.price_cents === 0 ? 'free' : ''}`}>
            {money(e.price_cents)}
          </T>
        </Box>
        <T className="event-title">{e.title}</T>
        <Box className="event-meta">
          <Clock size={14} />
          <T>
            {date(e.starts_at, { weekday: 'long' })} · {time(e.starts_at)}
          </T>
        </Box>
        <Box className="event-meta">
          <MapPin size={14} />
          <T>{e.location}</T>
        </Box>
        <Box className="event-card-footer">
          <T className="tiny muted">
            <Users size={13} /> {Math.max(0, e.capacity - e.registered)} vagas disponíveis
          </T>
          <Button variant="text-button" onClick={onClick}>
            {registered ? 'Minha inscrição' : 'Ver detalhes'} <ArrowRight size={15} />
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
function EventsPage({
  events,
  registrations,
  inspect,
}: {
  events: Event[];
  registrations: Registration[];
  inspect: (e: Event) => void;
}) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('Todos'),
    [past, setPast] = useState(false),
    [view, setView] = useState<'list' | 'grid'>('list');
  const filtered = events.filter(
    (e) =>
      (filter === 'Todos' || e.category === filter) &&
      e.title.toLowerCase().includes(search.toLowerCase()) &&
      (past || new Date(e.starts_at) > new Date()),
  );
  return (
    <>
      <Box className="events-toolbar">
        <Box className="search-field">
          <Search size={18} />
          <TextInput
            accessibilityLabel="Buscar eventos"
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar um encontro..."
            dataSet={{ ui: 'search-input' }}
          />
        </Box>
        <Button variant={`secondary ${past ? 'chosen' : ''}`} onClick={() => setPast(!past)}>
          <CalendarDays size={16} />
          {past ? 'Incluindo anteriores' : 'Só próximos eventos'}
        </Button>
      </Box>
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList aria-label="Categorias de eventos">
          {['Todos', 'Jovens', 'Retiro', 'Comunidade', 'Voluntariado', 'Oficina'].map((c) => (
            <TabsTrigger key={c} value={c}>
              {c}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={filter} key={filter}>
          <div className="results-count">{filtered.length} eventos encontrados</div>
          <div className="agenda-view-bar">
            <span>Exibição da agenda</span>
            <div className="view-switch" role="group" aria-label="Formato da agenda">
              <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
                <List size={15} /> Lista
              </button>
              <button aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
                <Grid2X2 size={15} /> Cartões
              </button>
            </div>
          </div>
          {view === 'grid' ? (
            <Box className="events-grid">
              {filtered.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  registered={registrations.some(
                    (r) => r.event_id === e.id && r.status !== 'cancelled',
                  )}
                  onClick={() => inspect(e)}
                />
              ))}
            </Box>
          ) : (
            <div className="agenda-list">
              {filtered.map((e) => {
                const registered = registrations.some(
                  (r) => r.event_id === e.id && r.status !== 'cancelled',
                );
                return (
                  <article className="agenda-row" key={e.id}>
                    <div className="agenda-day">
                      <strong>{date(e.starts_at, { day: '2-digit' })}</strong>
                      <span>
                        {date(e.starts_at, { month: 'short' }).replace('.', '').toUpperCase()}
                      </span>
                    </div>
                    <div className="agenda-description">
                      <div className="agenda-category">
                        {e.category}
                        {registered && (
                          <span className="registered-indicator">
                            <Check size={12} /> Inscrição realizada
                          </span>
                        )}
                      </div>
                      <h3>{e.title}</h3>
                      <p>
                        <Clock size={14} />
                        {date(e.starts_at, { weekday: 'long' })} · {time(e.starts_at)}
                        <span className="agenda-separator">/</span>
                        <MapPin size={14} />
                        {e.location}
                      </p>
                    </div>
                    <div className="agenda-action">
                      <strong>{money(e.price_cents)}</strong>
                      <span>{Math.max(0, e.capacity - e.registered)} vagas disponíveis</span>
                      <Button variant="secondary" onClick={() => inspect(e)}>
                        {registered ? 'Minha inscrição' : 'Ver detalhes'}
                        <ArrowRight size={15} />
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {!filtered.length && (
            <Empty
              title="Nenhum encontro encontrado"
              body="Tente outra busca ou categoria para encontrar seu próximo momento."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilter('Todos');
                    setSearch('');
                  }}
                >
                  Limpar filtros
                </Button>
              }
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
function EventDetail({
  event: e,
  registration,
  close,
  register,
  viewRegistration,
}: {
  event: Event;
  registration?: Registration;
  close: () => void;
  register: () => Promise<void>;
  viewRegistration: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const ended = new Date(e.starts_at) < new Date();
  return (
    <>
      <Box className="modal-art">
        <Art theme={e.theme} category={e.category} />
        <Button variant="modal-close" onClick={close} label="Fechar detalhes">
          <X size={20} />
        </Button>
      </Box>
      <Box className="modal-body">
        <Box className="row between">
          <Badge kind="green">{e.category}</Badge>
          <T className="event-price">{money(e.price_cents)}</T>
        </Box>
        <T className="modal-title">{e.title}</T>
        <Box className="detail-meta">
          <CalendarDays size={18} />
          <T>
            {date(e.starts_at, { day: 'numeric', month: 'long', year: 'numeric' })} ·{' '}
            {time(e.starts_at)}
          </T>
        </Box>
        <Box className="detail-meta">
          <MapPin size={18} />
          <T>{e.location}</T>
        </Box>
        <Box className="detail-meta">
          <Users size={18} />
          <T>
            {Math.max(0, e.capacity - e.registered)} de {e.capacity} vagas disponíveis
          </T>
        </Box>
        <T className="detail-description">{e.description}</T>
        {e.price_cents > 0 && (
          <Box className="info-box">
            <Wallet size={18} />
            <T>Pagamento de demonstração. Nenhum valor real será cobrado.</T>
          </Box>
        )}
        {error && <T className="form-error">{error}</T>}
        <Button
          className="full"
          disabled={busy || (!registration && (e.registered >= e.capacity || ended))}
          onClick={async () => {
            if (registration) {
              viewRegistration();
              return;
            }
            setBusy(true);
            try {
              await register();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? (
            <LoaderCircle size={18} className="spin" />
          ) : registration ? (
            <>
              <CheckCircle2 size={18} /> Abrir minha inscrição
            </>
          ) : ended ? (
            'Inscrições encerradas'
          ) : e.registered >= e.capacity ? (
            'Vagas esgotadas'
          ) : (
            <>
              Confirmar minha inscrição <ArrowRight size={18} />
            </>
          )}
        </Button>
      </Box>
    </>
  );
}
function RegistrationsPage({
  items,
  go,
  modal,
  refresh,
  notify,
}: {
  items: Registration[];
  go: (s: string) => void;
  modal: (n: ReactNode) => void;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  return (
    <>
      {!items.length ? (
        <Box className="panel">
          <Empty
            icon={<Ticket size={30} />}
            title="Seu próximo encontro está te esperando"
            body="Explore a agenda e faça sua primeira inscrição. Seu ingresso ficará guardado aqui."
            action={
              <Button onClick={() => go('events')}>
                Explorar eventos <ArrowRight size={17} />
              </Button>
            }
          />
        </Box>
      ) : (
        <Box className="registration-list">
          {items.map((r) => (
            <Box
              className={`registration-card panel ${r.status === 'cancelled' ? 'cancelled' : ''}`}
              key={r.id}
            >
              <Box className={`registration-date ${r.theme}`}>
                <T>{date(r.starts_at, { day: '2-digit' })}</T>
                <T>{date(r.starts_at, { month: 'short' }).toUpperCase()}</T>
              </Box>
              <Box className="registration-info">
                <Status status={r.status} />
                <T className="section-title">{r.title}</T>
                <T className="muted body">
                  {date(r.starts_at, { day: 'numeric', month: 'long' })} · {time(r.starts_at)} ·{' '}
                  {r.location}
                </T>
                <T className="tiny muted">
                  {money(r.amount_cents)} · {r.ticket}
                </T>
              </Box>
              <Box className="registration-actions">
                {r.status === 'pending' && (
                  <Button
                    onClick={() =>
                      modal(
                        <Confirm
                          title="Concluir pagamento simulado"
                          body={`Valor de demonstração: ${money(r.amount_cents)}. Esta ação confirma sua inscrição e registra um pagamento fictício. Não há PIX, cartão ou cobrança real.`}
                          label="Simular aprovação"
                          close={() => modal(null)}
                          action={async () => {
                            await post(`/registrations/${r.id}/pay`);
                            await refresh();
                            modal(null);
                            notify('Pagamento simulado aprovado. Seu ingresso está pronto!');
                          }}
                        />,
                      )
                    }
                  >
                    <Wallet size={17} /> Simular pagamento
                  </Button>
                )}
                {r.status === 'confirmed' && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      modal(
                        <Box className="modal-body ticket-modal">
                          <Button
                            variant="modal-close plain"
                            onClick={() => modal(null)}
                            label="Fechar ingresso"
                          >
                            <X size={20} />
                          </Button>
                          <Brand small />
                          <Box className="ticket-icon">
                            <Ticket size={36} />
                          </Box>
                          <Badge kind="green">PRESENÇA CONFIRMADA</Badge>
                          <T className="modal-title">{r.title}</T>
                          <T className="muted">
                            {date(r.starts_at, { day: 'numeric', month: 'long' })} ·{' '}
                            {time(r.starts_at)}
                          </T>
                          <T className="muted">{r.location}</T>
                          <Box className="ticket-code">
                            <T>SEU CÓDIGO DE INSCRIÇÃO</T>
                            <T>{r.ticket}</T>
                          </Box>
                          <T className="tiny muted center">
                            Apresente este código à equipe do evento.
                            <br />
                            Ingresso de demonstração · ComunIA V1
                          </T>
                        </Box>,
                      )
                    }
                  >
                    <Ticket size={17} /> Ver ingresso
                  </Button>
                )}
                {r.status !== 'cancelled' && (
                  <Button
                    variant="text-button cancel-button"
                    onClick={() =>
                      modal(
                        <Confirm
                          title="Cancelar sua inscrição?"
                          body="Sua vaga será liberada para outra pessoa. Se houve pagamento simulado, o sistema registrará um estorno de demonstração."
                          label="Cancelar inscrição"
                          close={() => modal(null)}
                          action={async () => {
                            await post(`/registrations/${r.id}/cancel`);
                            await refresh();
                            modal(null);
                            notify('Inscrição cancelada e vaga liberada.');
                          }}
                        />,
                      )
                    }
                  >
                    Cancelar inscrição
                  </Button>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}
function Confirm({
  title,
  body,
  label,
  close,
  action,
}: {
  title: string;
  body: string;
  label: string;
  close: () => void;
  action: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Box className="modal-body">
      <Box className="row between">
        <Box className="empty-icon">
          <Ticket size={25} />
        </Box>
        <Button variant="icon-button" onClick={close} label="Fechar">
          <X size={20} />
        </Button>
      </Box>
      <T className="modal-title">{title}</T>
      <T className="detail-description">{body}</T>
      {error && <T className="form-error">{error}</T>}
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await action();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Processando…' : label}
      </Button>
      <Button variant="text-button" onClick={close}>
        Voltar
      </Button>
    </Box>
  );
}

function ChatPage({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api<Message[]>('/chat')
      .then(setMessages)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);
  const send = async (value = input) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await post('/chat', { message: value });
      setMessages((previous) => [
        ...previous,
        { id: Date.now(), role: 'user', content: value },
        { id: Date.now() + 1, role: 'assistant', content: result.answer, intent: result.intent },
      ]);
      setInput('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box className="chat-layout">
      <Box className="chat-panel panel">
        <Box className="chat-header">
          <Box className="assistant-icon">
            <MessageCircle size={22} />
          </Box>
          <Box>
            <T className="card-title">Assistente ComunIA</T>
            <T className="tiny muted">
              <span className="live-dot" /> Informações da nossa comunidade
            </T>
          </Box>
          <Badge kind="subtle">V1 · Intenções + FAQ</Badge>
        </Box>
        <Box className="chat-history">
          <Box className="chat-welcome">
            <Box className="welcome-spark">
              <MessageCircle size={31} />
            </Box>
            <T className="section-title">Olá, {user.name.split(' ')[0]}. Como posso ajudar?</T>
            <T className="muted center">
              Estou aqui para aproximar você da comunidade.
              <br />
              Escolha uma sugestão ou escreva sua pergunta.
            </T>
          </Box>
          <Box className="suggestions">
            {[
              'Quais são os próximos eventos?',
              'Qual o horário dos cultos?',
              'Minhas inscrições',
              'Como chegar?',
            ].map((s) => (
              <Button variant="suggestion" key={s} disabled={busy} onClick={() => send(s)}>
                {s}
                <ArrowUpRight size={14} />
              </Button>
            ))}
          </Box>
          {messages.map((m) => (
            <Box key={m.id} className={`chat-message ${m.role}`}>
              <Box className="message-avatar">
                {m.role === 'assistant' ? <MessageCircle size={16} /> : user.name[0]}
              </Box>
              <Box className="message-bubble">
                <T>{m.content}</T>
                {m.role === 'assistant' && (
                  <T className="message-source">
                    {m.intent === 'events' || m.intent === 'registrations'
                      ? 'Consulta ao banco da comunidade'
                      : m.intent === 'human'
                        ? 'Solicitação registrada para a equipe'
                        : 'Base de informações da comunidade'}
                  </T>
                )}
              </Box>
            </Box>
          ))}
          {busy && <T className="muted body typing">ComunIA está consultando as informações…</T>}
          <div ref={end} />
        </Box>
        <Box className="chat-composer">
          {error && <T className="form-error">{error}</T>}
          <Box className="composer-input">
            <TextInput
              accessibilityLabel="Sua mensagem"
              value={input}
              onChangeText={setInput}
              placeholder="Escreva sua pergunta..."
              onSubmitEditing={() => send()}
              dataSet={{ ui: 'search-input' }}
            />
            <Button disabled={busy || !input.trim()} onClick={() => send()} label="Enviar mensagem">
              <Send size={18} />
            </Button>
          </Box>
          <T className="tiny muted center">
            Respostas baseadas em informações cadastradas. Sem IA generativa nesta versão.
          </T>
        </Box>
      </Box>
      <Box className="chat-side">
        <Box className="panel chat-help">
          <Leaf size={26} />
          <T className="section-title">Como podemos ajudar?</T>
          <T className="muted body">Um caminho mais simples para encontrar o que você precisa.</T>
          {[
            [CalendarDays, 'Agenda e eventos'],
            [Ticket, 'Suas inscrições'],
            [Clock, 'Horários dos encontros'],
            [MapPin, 'Localização'],
          ].map(([Icon, label]: any) => (
            <Box key={label} className="row">
              <Icon size={18} />
              <T className="body">{label}</T>
            </Box>
          ))}
        </Box>
        <Box className="human-help">
          <HandHeart size={24} />
          <T className="card-title">Prefere falar com alguém?</T>
          <T className="muted body">Nossa equipe também pode acolher sua dúvida.</T>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => send('Quero falar com um atendente')}
          >
            Solicitar atendimento <ArrowRight size={16} />
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

function AdminPage({
  events,
  notices,
  modal,
  refresh,
  notify,
}: {
  events: Event[];
  notices: Notice[];
  modal: (n: ReactNode) => void;
  refresh: () => Promise<void>;
  notify: (s: string) => void;
}) {
  const [tab, setTab] = useState('events'),
    [overview, setOverview] = useState<Overview | null>(null),
    [knowledge, setKnowledge] = useState<Knowledge[]>([]),
    [error, setError] = useState('');
  const load = async () => {
    try {
      const [o, k] = await Promise.all([
        api<Overview>('/admin/overview'),
        api<Knowledge[]>('/admin/knowledge'),
      ]);
      setOverview(o);
      setKnowledge(k);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const saved = async () => {
    await Promise.all([load(), refresh()]);
    modal(null);
    notify('Informações salvas na comunidade.');
  };
  const edit = (event?: Event) =>
    modal(<EventForm event={event} close={() => modal(null)} saved={saved} />);
  return (
    <>
      <Box className="admin-demo">
        <ShieldCheck size={19} />
        <T>
          Gestão da Comunidade Horizonte. Valores financeiros são exclusivamente de demonstração.
        </T>
      </Box>
      {error && <T className="form-error">{error}</T>}
      <Box className="admin-stats">
        {[
          [Users, overview?.stats.members ?? '—', 'Membros'],
          [CalendarDays, overview?.stats.events ?? '—', 'Próximos eventos'],
          [Ticket, overview?.stats.registrations ?? '—', 'Inscrições ativas'],
          [
            Wallet,
            overview ? money(overview.stats.revenue).replace('Gratuito', 'R$ 0,00') : '—',
            'Receita simulada',
          ],
        ].map(([Icon, value, label]: any) => (
          <Box className="panel admin-stat" key={label}>
            <Box className="row between">
              <T className="muted body">{label}</T>
              <Icon size={18} />
            </Box>
            <T className="stat-value">{value}</T>
          </Box>
        ))}
      </Box>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          void load();
        }}
      >
        <TabsList aria-label="Seções da administração" className="admin-origin-tabs">
          {[
            ['events', 'Eventos'],
            ['registrations', 'Inscrições'],
            ['knowledge', 'Chatbot'],
            ['notices', 'Avisos'],
            ['support', `Atendimento (${overview?.stats.support ?? 0})`],
            ['users', 'Membros'],
            ['messages', 'Interações'],
          ].map(([id, label]) => (
            <TabsTrigger key={id} value={id}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} key={tab}>
          {tab === 'events' && (
            <Box className="panel admin-panel">
              <Box className="section-heading">
                <Box>
                  <T className="section-title">Agenda da comunidade</T>
                  <T className="muted body">Publique encontros e acompanhe a ocupação.</T>
                </Box>
                <Button onClick={() => edit()}>
                  <Plus size={17} /> Criar evento
                </Button>
              </Box>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>EVENTO</th>
                      <th>DATA</th>
                      <th>INSCRIÇÕES</th>
                      <th>VALOR</th>
                      <th>STATUS</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Box className="row">
                            <Box className={`table-icon ${e.theme}`}>
                              <CalendarDays size={19} />
                            </Box>
                            <Box>
                              <T className="table-title">{e.title}</T>
                              <T className="tiny muted">{e.category}</T>
                            </Box>
                          </Box>
                        </td>
                        <td>
                          {date(e.starts_at)} · {time(e.starts_at)}
                        </td>
                        <td>
                          <T>
                            {e.registered} / {e.capacity}
                          </T>
                          <div className="capacity-bar">
                            <span
                              style={{
                                width: `${Math.min(100, (e.registered / e.capacity) * 100)}%`,
                              }}
                            />
                          </div>
                        </td>
                        <td>{money(e.price_cents)}</td>
                        <td>
                          <Badge kind={e.published ? 'green' : 'gray'}>
                            {e.published ? 'Publicado' : 'Rascunho'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="icon-button"
                            label={`Editar ${e.title}`}
                            onClick={() => edit(e)}
                          >
                            <Pencil size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          )}
          {tab === 'registrations' && (
            <Box className="panel admin-panel">
              <T className="section-title">Inscrições da comunidade</T>
              {overview?.registrations.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>PARTICIPANTE</th>
                        <th>EVENTO</th>
                        <th>STATUS</th>
                        <th>VALOR</th>
                        <th>INGRESSO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.registrations.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <T className="table-title">{r.name}</T>
                            <T className="tiny muted block">{r.email}</T>
                          </td>
                          <td>{r.title}</td>
                          <td>
                            <Status status={r.status} />
                          </td>
                          <td>{money(r.amount_cents)}</td>
                          <td className="mono">{r.ticket}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="As primeiras inscrições vêm aí"
                  body="Quando um membro se inscrever, você poderá acompanhar por aqui."
                />
              )}
            </Box>
          )}
          {tab === 'knowledge' && (
            <Box className="panel admin-panel">
              <Box className="section-heading">
                <Box>
                  <T className="section-title">O que o ComunIA sabe</T>
                  <T className="body muted">Palavras e respostas que ajudam a comunidade.</T>
                </Box>
                <Button
                  onClick={() => modal(<KnowledgeForm close={() => modal(null)} saved={saved} />)}
                >
                  <Plus size={17} /> Adicionar conteúdo
                </Button>
              </Box>
              {knowledge.map((k) => (
                <Box className="knowledge-row" key={k.id}>
                  <Box className="grow">
                    <T className="card-title">{k.title}</T>
                    <T className="body muted">{k.answer}</T>
                    <T className="keyword-label">{k.keywords.split(',').join(' · ')}</T>
                  </Box>
                  <Button
                    variant="icon-button"
                    label={`Editar ${k.title}`}
                    onClick={() =>
                      modal(<KnowledgeForm item={k} close={() => modal(null)} saved={saved} />)
                    }
                  >
                    <Pencil size={17} />
                  </Button>
                </Box>
              ))}
            </Box>
          )}
          {tab === 'notices' && (
            <Box className="panel admin-panel">
              <Box className="section-heading">
                <T className="section-title">Mural e comunicados</T>
                <Button
                  onClick={() => modal(<NoticeForm close={() => modal(null)} saved={saved} />)}
                >
                  <Plus size={17} /> Publicar aviso
                </Button>
              </Box>
              {notices.map((n) => (
                <Box className="knowledge-row" key={n.id}>
                  <Box>
                    <Badge kind="green">{n.category}</Badge>
                    <T className="card-title">{n.title}</T>
                    <T className="body muted">{n.body}</T>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          {tab === 'support' && (
            <Box className="panel admin-panel">
              <T className="section-title">Acolhimento e atendimento</T>
              <T className="muted body">
                Pedidos enviados pelo chatbot. Entre em contato com o membro e marque como atendido.
              </T>
              {overview?.support.length ? (
                overview.support.map((s) => (
                  <Box className="knowledge-row" key={s.id}>
                    <Box className="grow">
                      <Box className="row">
                        <T className="card-title">{s.name}</T>
                        <Badge kind={s.status === 'open' ? 'amber' : 'green'}>
                          {s.status === 'open' ? 'Aguardando' : 'Atendido'}
                        </Badge>
                      </Box>
                      <T className="tiny muted">{s.email}</T>
                      <T className="body">{s.message}</T>
                    </Box>
                    {s.status === 'open' && (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await post(`/admin/support/${s.id}/close`);
                            await load();
                            notify('Solicitação marcada como atendida.');
                          } catch (e) {
                            notify((e as Error).message);
                          }
                        }}
                      >
                        <Check size={16} /> Atendido
                      </Button>
                    )}
                  </Box>
                ))
              ) : (
                <Empty
                  icon={<HandHeart size={30} />}
                  title="Nenhum pedido por enquanto"
                  body="Os pedidos de atendimento humano aparecem aqui."
                />
              )}
            </Box>
          )}
          {tab === 'users' && (
            <Box className="panel admin-panel">
              <T className="section-title">Pessoas da comunidade</T>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>NOME</th>
                      <th>E-MAIL</th>
                      <th>PERFIL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview?.users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.email}</td>
                        <td>
                          <Badge kind={u.role === 'admin' ? 'amber' : 'green'}>
                            {u.role === 'admin' ? 'Administrador' : 'Membro'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          )}
          {tab === 'messages' && (
            <Box className="panel admin-panel">
              <T className="section-title">Últimas interações com o chatbot</T>
              {overview?.messages.length ? (
                overview.messages.map((m) => (
                  <Box className="knowledge-row" key={m.id}>
                    <Box>
                      <T className="card-title">{m.name}</T>
                      <T className="body muted">{m.content}</T>
                      <Badge kind="subtle">{m.intent}</Badge>
                    </Box>
                  </Box>
                ))
              ) : (
                <Empty
                  title="Nenhuma conversa registrada"
                  body="As perguntas feitas ao assistente serão exibidas aqui."
                />
              )}
            </Box>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function EventForm({
  event,
  close,
  saved,
}: {
  event?: Event;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const localDate = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const [title, setTitle] = useState(event?.title || ''),
    [description, setDescription] = useState(event?.description || ''),
    [category, setCategory] = useState(event?.category || 'Comunidade'),
    [starts, setStarts] = useState(event ? localDate(event.starts_at) : ''),
    [location, setLocation] = useState(event?.location || ''),
    [capacity, setCapacity] = useState(String(event?.capacity || 50)),
    [price, setPrice] = useState(String((event?.price_cents || 0) / 100)),
    [published, setPublished] = useState(event?.published ?? true),
    [theme, setTheme] = useState(event?.theme || 'forest'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (
        !starts ||
        !Number.isFinite(Number(capacity)) ||
        !Number.isFinite(Number(price.replace(',', '.')))
      )
        throw new Error('Informe uma data, capacidade e valor válidos.');
      await api(`/admin/events${event ? `/${event.id}` : ''}`, {
        method: event ? 'PUT' : 'POST',
        body: JSON.stringify({
          title,
          description,
          category,
          starts_at: new Date(starts).toISOString(),
          location,
          capacity: Number(capacity),
          price_cents: Math.round(Number(price.replace(',', '.')) * 100),
          theme,
          published,
        }),
      });
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box className="modal-body form-modal">
      <Box className="row between">
        <T className="modal-title">{event ? 'Editar encontro' : 'Um novo encontro'}</T>
        <Button variant="icon-button" onClick={close} label="Fechar formulário">
          <X size={20} />
        </Button>
      </Box>
      <Field
        label="Nome do evento"
        value={title}
        onChange={setTitle}
        placeholder="Ex.: Café em comunidade"
      />
      <Field
        label="Descrição"
        value={description}
        onChange={setDescription}
        multiline
        placeholder="Conte o que vai acontecer e como participar."
      />
      <Box className="form-grid">
        <label className="field">
          <span className="field-label">Categoria</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {['Comunidade', 'Jovens', 'Retiro', 'Voluntariado', 'Oficina'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Data e hora</span>
          <input
            className="input"
            type="datetime-local"
            value={starts}
            onInput={(e) => setStarts(e.currentTarget.value)}
            onChange={(e) => setStarts(e.target.value)}
          />
        </label>
      </Box>
      <Field label="Local" value={location} onChange={setLocation} />
      <Box className="form-grid">
        <Field label="Número de vagas" value={capacity} onChange={setCapacity} />
        <Field label="Valor em R$ (0 = gratuito)" value={price} onChange={setPrice} />
      </Box>
      <T className="field-label">Capa do evento</T>
      <Box className="row theme-picker">
        {['forest', 'sand', 'peach', 'sage', 'blue'].map((t) => (
          <Button
            key={t}
            variant={`theme-option ${t} ${theme === t ? 'picked' : ''}`}
            onClick={() => setTheme(t)}
            label={`Capa ${t}`}
          >
            {theme === t ? <Check size={18} /> : <Leaf size={16} />}
          </Button>
        ))}
      </Box>
      <Button
        variant={`publish-toggle ${published ? 'checked' : ''}`}
        onClick={() => setPublished(!published)}
      >
        <span>{published && <Check size={14} />}</span>
        <T>Publicar na agenda da comunidade</T>
      </Button>
      <T className="tiny muted">
        Eventos novos publicados geram uma notificação no aplicativo. Alterações de preço valem
        apenas para novas inscrições.
      </T>
      {error && <T className="form-error">{error}</T>}
      <Button disabled={busy} onClick={save}>
        {busy
          ? 'Salvando…'
          : event
            ? 'Salvar alterações'
            : published
              ? 'Publicar evento'
              : 'Salvar rascunho'}
        <Check size={17} />
      </Button>
    </Box>
  );
}
function KnowledgeForm({
  item,
  close,
  saved,
}: {
  item?: Knowledge;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item?.title || ''),
    [keywords, setKeywords] = useState(item?.keywords || ''),
    [answer, setAnswer] = useState(item?.answer || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Box className="modal-body form-modal">
      <Box className="row between">
        <T className="modal-title">{item ? 'Editar conteúdo' : 'Ensinar ao ComunIA'}</T>
        <Button variant="icon-button" onClick={close} label="Fechar">
          <X size={20} />
        </Button>
      </Box>
      <Field label="Assunto" value={title} onChange={setTitle} />
      <Field
        label="Palavras-chave, separadas por vírgula"
        value={keywords}
        onChange={setKeywords}
        placeholder="culto, horário, domingo"
      />
      <Field label="Resposta da comunidade" value={answer} onChange={setAnswer} multiline />
      {error && <T className="form-error">{error}</T>}
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/admin/knowledge${item ? `/${item.id}` : ''}`, {
              method: item ? 'PUT' : 'POST',
              body: JSON.stringify({ title, keywords, answer }),
            });
            await saved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Salvando…' : 'Salvar conteúdo'}
        <Check size={17} />
      </Button>
    </Box>
  );
}
function NoticeForm({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
  const [title, setTitle] = useState(''),
    [body, setBody] = useState(''),
    [category, setCategory] = useState('Comunidade'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Box className="modal-body form-modal">
      <Box className="row between">
        <T className="modal-title">Compartilhe uma novidade</T>
        <Button variant="icon-button" onClick={close} label="Fechar">
          <X size={20} />
        </Button>
      </Box>
      <Field label="Título do aviso" value={title} onChange={setTitle} />
      <Field label="Categoria" value={category} onChange={setCategory} />
      <Field label="Mensagem" value={body} onChange={setBody} multiline />
      <Box className="info-box">
        <Bell size={18} />
        <T>O aviso vai para o mural e para a caixa de notificações dos membros.</T>
      </Box>
      {error && <T className="form-error">{error}</T>}
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await post('/admin/notices', { title, body, category });
            await saved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Publicando…' : 'Publicar aviso'}
        <Send size={17} />
      </Button>
    </Box>
  );
}
