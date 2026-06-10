ALTER TABLE public.coin_balances ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.coin_events ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS coin_balances_email_idx ON public.coin_balances (lower(email));
CREATE INDEX IF NOT EXISTS coin_events_email_idx ON public.coin_events (lower(email));