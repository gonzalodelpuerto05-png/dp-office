-- Ingresos y costos ahora pueden estar en una moneda distinta a la
-- de compra de la inversión (ej: alquiler cobrado en USD sobre un
-- inmueble comprado en UYU).

alter table public.investment_income
  add column moneda text not null default 'USD' check (moneda in ('USD', 'UYU', 'ARS', 'EUR', 'OTHER'));

alter table public.investment_costs
  add column moneda text not null default 'USD' check (moneda in ('USD', 'UYU', 'ARS', 'EUR', 'OTHER'));
