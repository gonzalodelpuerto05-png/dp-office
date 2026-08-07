-- La moneda base (en la que cada inversión guarda su "cotización")
-- pasa a ser USD en vez de UYU.

alter table public.investments
  alter column moneda set default 'USD';
