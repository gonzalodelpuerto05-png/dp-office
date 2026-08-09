-- Ingresos recurrentes: si se marca, la app genera sola la próxima
-- ocurrencia mensual cuando pasa el mes.
alter table public.investment_income
  add column recurrente boolean not null default false;

-- Historial de valor actual de cada inversión, para poder graficar su
-- evolución en el tiempo (antes solo se guardaba el valor presente).
create table public.investment_value_history (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  valor numeric not null,
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.investment_value_history enable row level security;

create policy "authenticated all investment_value_history" on public.investment_value_history
  for all to authenticated using (true) with check (true);

create index investment_value_history_investment_id_idx
  on public.investment_value_history (investment_id, fecha);

-- Sembrar el historial con el valor actual de las inversiones que ya
-- existen, para que el gráfico no arranque vacío.
insert into public.investment_value_history (investment_id, valor, fecha)
select id, valor_compra, fecha_compra from public.investments;

insert into public.investment_value_history (investment_id, valor, fecha)
select id, valor_actual, current_date from public.investments
where valor_actual <> valor_compra;
