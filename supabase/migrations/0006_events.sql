-- Eventos importantes con fecha (vencimientos, reuniones, etc.)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha date not null,
  descripcion text,
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "authenticated all events" on public.events
  for all to authenticated using (true) with check (true);

create index events_fecha_idx on public.events (fecha);
