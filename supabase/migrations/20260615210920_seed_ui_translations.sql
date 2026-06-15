insert into public.translations (namespace, key, locale, value)
select * from (values
  ('common','nav.home','pt','Home'),('common','nav.home','en','Home'),('common','nav.home','es','Inicio'),
  ('common','nav.about','pt','Sobre'),('common','nav.about','en','About'),('common','nav.about','es','Acerca'),
  ('common','nav.services','pt','Serviços'),('common','nav.services','en','Services'),('common','nav.services','es','Servicios'),
  ('common','nav.portfolio','pt','Portfólio'),('common','nav.portfolio','en','Portfolio'),('common','nav.portfolio','es','Portafolio'),
  ('common','nav.process','pt','Processo'),('common','nav.process','en','Process'),('common','nav.process','es','Proceso'),
  ('common','nav.audience','pt','Para quem'),('common','nav.audience','en','For whom'),('common','nav.audience','es','Para quién'),
  ('common','nav.journal','pt','Jornal'),('common','nav.journal','en','Journal'),('common','nav.journal','es','Diario'),
  ('common','nav.contact','pt','Contato'),('common','nav.contact','en','Contact'),('common','nav.contact','es','Contacto'),
  ('common','cta.process','pt','Conhecer nosso processo'),('common','cta.process','en','Discover our process'),('common','cta.process','es','Conocer nuestro proceso'),
  ('common','cta.evaluation','pt','Solicitar avaliação'),('common','cta.evaluation','en','Request a consultation'),('common','cta.evaluation','es','Solicitar evaluación')
) as v(namespace,key,locale,value)
on conflict (namespace,key,locale) do nothing;
