
create table public.user_docs (
  user_id uuid not null default auth.uid(),
  coll text not null,
  doc_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, coll, doc_id)
);
grant select, insert, update, delete on public.user_docs to authenticated;
grant all on public.user_docs to service_role;
alter table public.user_docs enable row level security;
create policy "own docs" on public.user_docs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.shares (
  token text primary key,
  owner uuid not null default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.shares to authenticated;
grant all on public.shares to service_role;
alter table public.shares enable row level security;
create policy "own shares" on public.shares for all to authenticated
  using (auth.uid() = owner) with check (auth.uid() = owner);

create or replace function public.get_share(_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select data from public.shares where token = _token
$$;
revoke all on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

drop trigger if exists on_auth_user_created_seed on auth.users;
comment on table public.accounts is 'DEPRECATED: replaced by user_docs';
comment on table public.categories is 'DEPRECATED: replaced by user_docs';
comment on table public.transactions is 'DEPRECATED: replaced by user_docs';
comment on table public.debts is 'DEPRECATED: replaced by user_docs';
comment on table public.debt_payments is 'DEPRECATED: replaced by user_docs';
