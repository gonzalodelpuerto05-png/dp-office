-- Registro de actividad: qué hizo cada usuario y cuándo.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  user_nombre text not null,
  accion text not null,
  entidad text not null,
  entidad_nombre text not null,
  detalle text,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "authenticated read activity_log" on public.activity_log
  for select to authenticated using (true);

create policy "authenticated insert activity_log" on public.activity_log
  for insert to authenticated with check (true);

create index activity_log_created_at_idx on public.activity_log (created_at desc);

-- Storage: archivos adjuntos por inversión (contratos, comprobantes, etc).
insert into storage.buckets (id, name, public)
values ('investment-files', 'investment-files', false)
on conflict (id) do nothing;

create policy "authenticated read investment files" on storage.objects
  for select to authenticated using (bucket_id = 'investment-files');

create policy "authenticated upload investment files" on storage.objects
  for insert to authenticated with check (bucket_id = 'investment-files');

create policy "authenticated delete investment files" on storage.objects
  for delete to authenticated using (bucket_id = 'investment-files');
