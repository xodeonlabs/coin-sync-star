
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Apps
CREATE TABLE public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX apps_owner_idx ON public.apps(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apps TO authenticated;
GRANT ALL ON public.apps TO service_role;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own apps all" ON public.apps FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Coin balances
CREATE TABLE public.coin_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app_id, external_user_id)
);
CREATE INDEX coin_balances_user_idx ON public.coin_balances(external_user_id);
GRANT SELECT ON public.coin_balances TO authenticated;
GRANT ALL ON public.coin_balances TO service_role;
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads balances" ON public.coin_balances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.owner_id = auth.uid()));

-- Coin events (audit log)
CREATE TABLE public.coin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  external_user_id TEXT NOT NULL,
  delta BIGINT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX coin_events_app_user_idx ON public.coin_events(app_id, external_user_id, created_at DESC);
GRANT SELECT ON public.coin_events TO authenticated;
GRANT ALL ON public.coin_events TO service_role;
ALTER TABLE public.coin_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads events" ON public.coin_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.apps a WHERE a.id = app_id AND a.owner_id = auth.uid()));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
