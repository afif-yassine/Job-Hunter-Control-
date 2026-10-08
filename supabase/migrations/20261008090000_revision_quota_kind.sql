-- NON APPLIQUÉE — à appliquer par le propriétaire (migration additive).
-- Les modifications IA d'un CV ou d'une lettre ont leur propre plafond journalier
-- (clé « revision », 15 par jour et par compte par défaut, QUOTA_REVISIONS_PER_DAY).
-- usage_events.kind n'accepte aujourd'hui que scan / analysis / generation :
-- sans cette migration le code retombe sur le plafond de rédaction (jamais illimité).
-- Aucune ligne existante n'est modifiée ; la nouvelle contrainte accepte les anciennes valeurs.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events
  add constraint usage_events_kind_check check (kind in ('scan', 'analysis', 'generation', 'revision'));
