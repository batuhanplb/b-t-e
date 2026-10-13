
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  type text not null default 'banka',
  color text not null default '#0f6e66',
  start_balance numeric not null default 0,
  exclude_from_total boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  kind text not null default 'gider',
  color text not null default '#7d8a90',
  monthly_budget numeric,
  created_at timestamptz not null default now()
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  account_id uuid references public.accounts(id) on delete set null,
  to_account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  note text,
  group_id uuid,
  inst_no int,
  inst_total int,
  created_at timestamptz not null default now()
);
create index on public.transactions(user_id, date);
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  kind text not null default 'kredi',
  total numeric not null,
  monthly_payment numeric,
  start_date date not null default current_date,
  months int,
  note text,
  created_at timestamptz not null default now()
);
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['accounts','categories','transactions','debts','debt_payments'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

create or replace function public.seed_user_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.accounts(user_id,name,type,color,sort) values
    (new.id,'Nakit','nakit','#1d7f47',0),(new.id,'Banka','banka','#3166c9',1),(new.id,'Kredi Kartı','kart','#c53a2e',2);
  insert into public.categories(user_id,name,kind,color) values
    (new.id,'Market','gider','#e08a2c'),(new.id,'Kira','gider','#8a5cc9'),(new.id,'Faturalar','gider','#3166c9'),
    (new.id,'Ulaşım','gider','#0f8fa3'),(new.id,'Yeme-İçme','gider','#c53a2e'),(new.id,'Sağlık','gider','#d14d8a'),
    (new.id,'Eğlence','gider','#c9a227'),(new.id,'Giyim','gider','#6a6f74'),(new.id,'Diğer','gider','#7d8a90'),
    (new.id,'Maaş','gelir','#1d7f47'),(new.id,'Ek Gelir','gelir','#0f6e66'),(new.id,'Yatırım Getirisi','gelir','#3c9a5f');
  return new;
end $$;
create trigger on_auth_user_created_seed after insert on auth.users
  for each row execute function public.seed_user_defaults();
