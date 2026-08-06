-- Módulos vendáveis para as verticais Saboaria e Perfumaria (o slug do módulo
-- casa com o slug da vertical, permitindo contratar a frente self-service).
insert into public.modules (name, slug, category, sellable, price_monthly, is_active)
select * from (values
  ('Saboaria Experience','saboaria','vertical', true, 0, true),
  ('Perfumaria Experience','perfumaria','vertical', true, 0, true)
) as v(name,slug,category,sellable,price_monthly,is_active)
where not exists (select 1 from public.modules m where m.slug = v.slug);
