-- NON APPLIQUÉE — à appliquer par le propriétaire (migration additive).
-- Problème : la règle « own ai usage insert » laisse un étudiant écrire ses propres lignes
-- avec n'importe quel coût, y compris négatif : les coûts de l'admin peuvent être faussés.
-- Remède : interdire les coûts et les jetons négatifs. Le code actuel n'écrit jamais de valeur
-- négative, donc rien ne change pour les écritures légitimes.
--
-- 1) CONTRÔLE à lancer AVANT (lecture seule). Si le résultat n'est pas 0, ne pas valider
--    la contrainte avant d'avoir regardé ces lignes :
--      select count(*) as lignes_negatives from public.ai_usage
--      where coalesce(cost_usd, 0) < 0 or input_tokens < 0 or output_tokens < 0;
--
-- 2) La contrainte est créée NOT VALID : elle s'applique tout de suite aux NOUVELLES lignes
--    sans relire l'historique. Elle ne peut donc pas échouer à cause de lignes existantes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_usage_nonnegative' and conrelid = 'public.ai_usage'::regclass) then
    alter table public.ai_usage
      add constraint ai_usage_nonnegative
      check (coalesce(cost_usd, 0) >= 0 and input_tokens >= 0 and output_tokens >= 0) not valid;
  end if;
end $$;

-- 3) OPTIONNEL, seulement quand le contrôle du 1) renvoie 0 :
--      alter table public.ai_usage validate constraint ai_usage_nonnegative;
--
-- Plus tard (hors de cette migration) : faire écrire recordAiUsage par le client de service,
-- puis retirer la règle d'insertion pour les comptes.
