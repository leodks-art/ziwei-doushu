import pg from 'pg';
import crypto from 'crypto';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const id = prefix => `${prefix}${crypto.randomBytes(16).toString('hex')}`;

const sql = `
create table if not exists app_users (
  id text primary key,
  openid text unique,
  unionid text,
  phone text,
  email text,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists paid_products (
  id text primary key,
  slug text not null unique,
  title text not null,
  description text not null default '',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'CNY',
  file_path text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists paid_orders (
  id text primary key,
  order_no text not null unique,
  product_id text not null references paid_products(id),
  user_id text references app_users(id),
  openid text,
  contact text not null default '',
  contact_type text not null default 'unknown',
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'CNY',
  status text not null default 'pending',
  wechat_prepay_id text,
  wechat_transaction_id text,
  download_token text unique,
  download_expires_at timestamptz,
  download_limit integer not null default 5,
  download_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists paid_orders_status_idx on paid_orders(status);
create index if not exists paid_orders_openid_idx on paid_orders(openid);
create index if not exists paid_orders_created_idx on paid_orders(created_at desc);

create table if not exists download_events (
  id text primary key,
  order_id text not null references paid_orders(id),
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists access_logs (
  id text primary key,
  event_type text not null,
  method text,
  path text,
  status_code integer,
  order_no text,
  openid_hash text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists access_logs_created_idx on access_logs(created_at desc);
create index if not exists access_logs_event_idx on access_logs(event_type);
`;

try {
  await pool.query(sql);
  const existing = await pool.query('select id from paid_products where slug=$1', ['classics-full']);
  if (!existing.rowCount) {
    await pool.query(
      `insert into paid_products
        (id, slug, title, description, amount_cents, currency, file_path, active)
       values ($1,$2,$3,$4,$5,'CNY',$6,false)`,
      [
        id('prod_'),
        'classics-full',
        '紫微古籍完整文档包',
        '包含古籍原典整理版与完整文档下载。请在后台确认文件路径和价格后上架。',
        9900,
        'classics-full.zip',
      ],
    );
  }
  console.log('Admin/payment database migration completed.');
} finally {
  await pool.end();
}
