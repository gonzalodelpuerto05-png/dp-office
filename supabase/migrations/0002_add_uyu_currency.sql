-- Agrega UYU (peso uruguayo) como moneda válida y la vuelve la moneda
-- por defecto: es la moneda base en la que se consolida el patrimonio.

alter table public.investments
  drop constraint investments_moneda_check;

alter table public.investments
  add constraint investments_moneda_check
  check (moneda in ('UYU', 'ARS', 'USD', 'EUR', 'OTHER'));

alter table public.investments
  alter column moneda set default 'UYU';
