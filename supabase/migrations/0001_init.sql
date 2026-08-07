-- DP Office: esquema inicial

create extension if not exists "pgcrypto";

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  rol text not null default 'usuario' check (rol in ('admin', 'usuario')),
  created_at timestamptz not null default now()
);

-- Crea automáticamente un profile cuando se crea un usuario en auth.users
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'rol', 'usuario')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ categories ============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============ investments ============
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  nombre text not null,
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD', 'EUR', 'OTHER')),
  cotizacion numeric not null default 1,
  valor_compra numeric not null default 0,
  fecha_compra date not null default current_date,
  valor_actual numeric not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger investments_set_updated_at
  before update on public.investments
  for each row execute function public.set_updated_at();

-- ============ investment_income ============
create table public.investment_income (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  fecha date not null,
  monto numeric not null,
  concepto text not null,
  estado text not null default 'programado' check (estado in ('programado', 'cobrado')),
  created_at timestamptz not null default now()
);

-- ============ investment_costs ============
create table public.investment_costs (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid not null references public.investments(id) on delete cascade,
  fecha date not null,
  monto numeric not null,
  concepto text not null,
  created_at timestamptz not null default now()
);

-- ============ investment_responsibles ============
create table public.investment_responsibles (
  investment_id uuid not null references public.investments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (investment_id, user_id)
);

-- ============ tasks ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  dia_semana text not null check (dia_semana in ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  titulo text not null,
  asignado_a uuid references public.profiles(id) on delete set null,
  completada boolean not null default false,
  fecha_completada timestamptz,
  posicion integer not null default 0,
  creado_en timestamptz not null default now()
);

-- ============ Row Level Security ============
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.investments enable row level security;
alter table public.investment_income enable row level security;
alter table public.investment_costs enable row level security;
alter table public.investment_responsibles enable row level security;
alter table public.tasks enable row level security;

-- Cualquier usuario autenticado de la app puede leer y escribir todo
-- (todos los usuarios tienen el mismo nivel de acceso a los datos).
create policy "authenticated read profiles" on public.profiles
  for select to authenticated using (true);
create policy "authenticated update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

create policy "authenticated all categories" on public.categories
  for all to authenticated using (true) with check (true);

create policy "authenticated all investments" on public.investments
  for all to authenticated using (true) with check (true);

create policy "authenticated all investment_income" on public.investment_income
  for all to authenticated using (true) with check (true);

create policy "authenticated all investment_costs" on public.investment_costs
  for all to authenticated using (true) with check (true);

create policy "authenticated all investment_responsibles" on public.investment_responsibles
  for all to authenticated using (true) with check (true);

create policy "authenticated all tasks" on public.tasks
  for all to authenticated using (true) with check (true);
