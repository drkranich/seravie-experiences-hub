update public.sections set "order" = 1 where key = 'hero';

insert into public.sections (key, title, "order", content, published)
values
('about','Sobre', 2,
 '{"eyebrow":"Sobre nós","title":"Especialistas em criar experiências que conectam lugares, marcas e pessoas.","text":"Unimos design, estratégia e sensibilidade para transformar espaços comuns em destinos que encantam, acolhem e geram valor para o seu negócio.","cta_text":"Conhecer nossa história","image_url":"","background_url":""}'::jsonb, true),
('services','Entregáveis', 3,
 '{"eyebrow":"O que entregamos","title":"Cada projeto, uma experiência completa."}'::jsonb, true),
('portfolio','Portfólio', 4,
 '{"eyebrow":"Experiências que criamos","title":"Projetos que inspiram. Experiências que ficam.","cta_text":"Ver todos os projetos"}'::jsonb, true),
('process','Processo', 5,
 '{"eyebrow":"Nosso processo","title":"Do diagnóstico à experiência final."}'::jsonb, true),
('audience','Para quem', 6,
 '{"eyebrow":"Para quem criamos","title":"Marcas e destinos que querem ser lembrados."}'::jsonb, true),
('manifesto','Manifesto', 7,
 '{"line1":"Alguns lugares recebem visitantes.","line2":"Outros permanecem na memória.","line3":"Nós projetamos a diferença.","cta_text":"Conheça nossa história","background_url":""}'::jsonb, true),
('testimonials','Depoimentos', 8,
 '{"eyebrow":"Depoimentos","title":"Histórias que ficaram na memória."}'::jsonb, true),
('journal','Jornal', 9,
 '{"eyebrow":"Jornal","title":"Histórias e inspirações."}'::jsonb, true),
('faq','FAQ', 10,
 '{"eyebrow":"Perguntas frequentes","title":"Tudo que você precisa saber."}'::jsonb, true),
('team','Equipe', 11,
 '{"eyebrow":"Equipe","title":"Quem cria as experiências."}'::jsonb, true),
('contact','Contato', 12,
 '{"eyebrow":"Fale com um especialista","title":"Vamos conversar sobre o seu destino.","text":"Conte-nos sobre seu projeto. Responda algumas perguntas rápidas e nossa equipe entrará em contato com você.","closing":"Sua história merece o cenário perfeito."}'::jsonb, true)
on conflict (key) do nothing;
