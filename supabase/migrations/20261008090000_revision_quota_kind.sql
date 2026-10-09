-- NON APPLIQUÉE — à appliquer par le propriétaire (migration additive).
-- Les modifications IA d'un CV ou d'une lettre ont leur propre plafond journalier
-- (clé « revision », 15 par jour et par compte par défaut, QUOTA_REVISIONS_PER_DAY).
-- usage_events.kind n'accepte aujourd'hui que scan / analysis / generation :
-- sans cette migration le code retombe sur le plafond de rédaction (jamais illimité).
-- Aucune ligne existante n'est modifiée ; la nouvelle contrainte accepte les anciennes valeurs.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events
  add constraint usage_events_kind_check check (kind in ('scan', 'analysis', 'generation', 'revision', 'kit'));

-- Compteur de dossiers tenu par le serveur (offre gratuite : 2 par mois ; formule payante : plafond mensuel).
-- Un dossier = une ligne « kit » avec l'offre concernée, écrite par le serveur quand le CV est enregistré.
-- usage_events n'a aucune règle de suppression pour les comptes : supprimer un document ou une offre
-- n'efface pas la trace (job_id sans clé étrangère pour la même raison). Avant cette migration, le code
-- compte les documents comme aujourd'hui.
alter table public.usage_events add column if not exists job_id uuid;
create index if not exists usage_events_kit_month_idx on public.usage_events (user_id, created_at desc) where kind = 'kit';
