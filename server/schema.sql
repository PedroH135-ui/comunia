CREATE TABLE IF NOT EXISTS users (
 id serial PRIMARY KEY, name text NOT NULL, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')), created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions(token text PRIMARY KEY, user_id integer REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS events (
 id serial PRIMARY KEY, title text NOT NULL, description text NOT NULL, category text NOT NULL,
 starts_at timestamptz NOT NULL, location text NOT NULL, capacity integer NOT NULL CHECK(capacity>0),
 price_cents integer NOT NULL DEFAULT 0 CHECK(price_cents>=0), theme text NOT NULL DEFAULT 'forest',
 published boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS registrations (
 id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), event_id integer NOT NULL REFERENCES events(id),
 status text NOT NULL CHECK(status IN ('confirmed','pending','cancelled')), amount_cents integer NOT NULL,
 ticket text UNIQUE NOT NULL, created_at timestamptz DEFAULT now(), UNIQUE(user_id,event_id)
);
CREATE TABLE IF NOT EXISTS payments (
 id serial PRIMARY KEY, registration_id integer UNIQUE NOT NULL REFERENCES registrations(id),
 amount_cents integer NOT NULL, status text NOT NULL CHECK(status IN ('approved','refunded')), simulated boolean NOT NULL DEFAULT true,
 created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notices (
 id serial PRIMARY KEY, title text NOT NULL, body text NOT NULL, category text NOT NULL DEFAULT 'Comunidade', created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), title text NOT NULL, body text NOT NULL,
 read boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS knowledge (
 id serial PRIMARY KEY, title text NOT NULL, keywords text NOT NULL, answer text NOT NULL, updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), role text NOT NULL CHECK(role IN ('user','assistant')),
 content text NOT NULL, intent text, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS support_requests (
 id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), message text NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS chat_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_attempts (
 key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_attempts_expiry ON auth_attempts(expires_at);
