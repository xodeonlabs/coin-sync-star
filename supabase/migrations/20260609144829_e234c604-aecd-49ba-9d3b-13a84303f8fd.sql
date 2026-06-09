ALTER TABLE public.coin_balances REPLICA IDENTITY FULL;
ALTER TABLE public.coin_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_events;