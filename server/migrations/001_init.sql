create extension if not exists pgcrypto;

create table if not exists users (
  id bigserial primary key,
  username text not null unique,
  pass_hash text not null,
  email text,
  is_admin boolean not null default false,
  coins bigint not null default 0,
  level int not null default 1,
  luck boolean not null default false,
  arena_auto_win boolean not null default false,
  avatar text not null default 'elf.svg',
  title text not null default 'Member',
  created_at timestamptz not null default now(),
  last_hourly_coin_claim_at timestamptz
);

create table if not exists user_inventory (
  user_id bigint not null references users(id) on delete cascade,
  blook_name text not null,
  count int not null default 0,
  primary key (user_id, blook_name)
);

create table if not exists sessions (
  sid text primary key,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

create table if not exists bans (
  username text primary key,
  banned_at timestamptz not null default now(),
  reason text
);

create table if not exists global_chat_messages (
  id bigserial primary key,
  from_user_id bigint not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists global_chat_messages_created_at_idx on global_chat_messages(created_at);

create table if not exists news_posts (
  id bigserial primary key,
  author_user_id bigint not null references users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists news_posts_created_at_idx on news_posts(created_at);

create table if not exists community_posts (
  id bigserial primary key,
  author_user_id bigint not null references users(id) on delete cascade,
  category text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_created_at_idx on community_posts(created_at);

create table if not exists market_listings (
  id bigserial primary key,
  seller_user_id bigint not null references users(id) on delete cascade,
  blook_name text not null,
  price_per int not null,
  quantity int not null,
  created_at timestamptz not null default now()
);
create index if not exists market_listings_created_at_idx on market_listings(created_at);

create table if not exists trades (
  id bigserial primary key,
  from_user_id bigint not null references users(id) on delete cascade,
  to_user_id bigint not null references users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists trades_to_user_id_idx on trades(to_user_id);

create table if not exists trade_items (
  trade_id bigint not null references trades(id) on delete cascade,
  side text not null check (side in ('from','to')),
  blook_name text not null,
  count int not null,
  primary key (trade_id, side, blook_name)
);

create table if not exists trade_coins (
  trade_id bigint primary key references trades(id) on delete cascade,
  from_coins int not null default 0,
  to_coins int not null default 0
);

