-- Hide sensitive game-state columns from public/anon/authenticated direct reads.
-- The "rooms public read" RLS policy still allows row-level SELECT, but column-level
-- privileges further restrict which columns can be returned. Realtime postgres_changes
-- payloads respect column privileges as well, so subscribers will receive NULL for
-- secret_word and word_choices.

REVOKE SELECT (secret_word, word_choices) ON public.rooms FROM anon;
REVOKE SELECT (secret_word, word_choices) ON public.rooms FROM authenticated;