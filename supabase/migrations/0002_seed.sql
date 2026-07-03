-- Seed de exemplo para rodar o protótipo local.
-- Cria uma psicóloga (nicho saúde) e dois serviços.

insert into professional (slug, display_name, headline, niche, specialty, timezone)
values (
  'dra-marina',
  'Dra. Marina Souza',
  'Psicóloga | Ansiedade e TCC',
  'saude',
  'Psicologia - TCC',
  'America/Sao_Paulo'
)
on conflict (slug) do nothing;

insert into service (professional_id, name, modality, visit_type, duration_minutes, sort_order)
select id, 'Primeira consulta', 'online', 'primeira', 50, 0 from professional where slug = 'dra-marina'
union all
select id, 'Retorno', 'online', 'retorno', 50, 1 from professional where slug = 'dra-marina'
on conflict do nothing;
