-- Ворс: схема PostgreSQL (идемпотентная, можно запускать повторно)
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists admin_credentials (
  id int primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  token_hash text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);

create sequence if not exists order_number_seq start 101;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number int not null unique default nextval('order_number_seq'),
  public_token text not null unique,
  idempotency_key text not null unique,
  request_hash text not null,
  status text not null default 'new' check (status in ('new', 'agreed', 'done', 'cancelled')),
  customer_name text not null,
  phone text not null,
  address text not null,
  out_of_town boolean not null default false,
  wish_date date,
  wish_time text,
  comment text,
  consent_at timestamptz not null,
  items jsonb not null,
  estimate jsonb not null,
  pricing_snapshot jsonb not null,
  final_price int,
  agreed_visit_at timestamptz,
  owner_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);

create table if not exists order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders (id) on delete cascade,
  secret_hash text not null,
  mime text not null,
  width int not null,
  height int not null,
  bytes int not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists order_photos_order_idx on order_photos (order_id);

create table if not exists order_events (
  id bigserial primary key,
  order_id uuid not null references orders (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on order_events (order_id, created_at);

create table if not exists bonus_codes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders (id) on delete cascade,
  code text not null unique,
  amount int not null,
  min_order int not null,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
