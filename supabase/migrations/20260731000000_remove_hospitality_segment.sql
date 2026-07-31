-- Remoção da área de hotelaria (hospedagem) do projeto.
-- Escopo: apenas lodging/hospitalidade. Turismo, cafeterias, vinícolas etc. permanecem.
-- Idempotente: seguro reexecutar.

delete from public.segments
where title = 'Pousadas & Hotéis';
