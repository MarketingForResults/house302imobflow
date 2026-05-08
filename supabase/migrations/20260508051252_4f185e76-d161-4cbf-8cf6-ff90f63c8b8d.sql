
-- Roles enum + table (separado de profiles por segurança)
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'broker');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  cpf TEXT,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  address TEXT,
  creci TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Função has_role (security definer evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager'))
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Auto-create profile on signup; primeiro usuário vira admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'broker');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Brokers (corretores parceiros - registros, não necessariamente usuários do sistema)
CREATE TABLE public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  creci TEXT,
  birth_date DATE,
  avatar_url TEXT,
  address TEXT,
  commission_pct NUMERIC(5,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER brokers_updated BEFORE UPDATE ON public.brokers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Clients
CREATE TYPE public.interest_type AS ENUM ('buy','sell','rent','buy_rent');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  address TEXT,
  interest_type public.interest_type,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Properties
CREATE TYPE public.property_type AS ENUM ('house','apartment','land','lot','commercial');
CREATE TYPE public.property_status AS ENUM ('available','sold','reserved','negotiation','rented');

CREATE SEQUENCE public.property_code_seq START 1;

CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL DEFAULT ('IMB-' || lpad(nextval('public.property_code_seq')::text, 5, '0')),
  title TEXT,
  description TEXT,
  type public.property_type NOT NULL,
  status public.property_status NOT NULL DEFAULT 'available',
  area_m2 NUMERIC(10,2),
  bedrooms INT,
  bathrooms INT,
  suites INT,
  parking_spaces INT,
  planned_furniture BOOLEAN DEFAULT FALSE,
  furnished BOOLEAN DEFAULT FALSE,
  financed BOOLEAN DEFAULT FALSE,
  accepts_trade BOOLEAN DEFAULT FALSE,
  trade_notes TEXT,
  exclusive BOOLEAN DEFAULT FALSE,
  price NUMERIC(15,2),
  commission_pct NUMERIC(5,2),
  country TEXT DEFAULT 'Brasil',
  state TEXT,
  city TEXT,
  neighborhood TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  video_url TEXT,
  tour_url TEXT,
  wp_post_id BIGINT,
  wp_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ON public.properties (status);
CREATE INDEX ON public.properties (type);
CREATE INDEX ON public.properties (city);

CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.property_images (property_id);

CREATE TABLE public.wp_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  status_code INT,
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storage bucket para imagens de imóveis
INSERT INTO storage.buckets (id, name, public) VALUES ('property-images','property-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wp_sync_logs ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_staff(auth.uid()));
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- brokers policies
CREATE POLICY "brokers read auth" ON public.brokers FOR SELECT TO authenticated USING (true);
CREATE POLICY "brokers staff manage" ON public.brokers FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- clients policies
CREATE POLICY "clients read auth" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients staff manage" ON public.clients FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- properties policies
CREATE POLICY "properties read auth" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "properties staff manage" ON public.properties FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- property_images policies
CREATE POLICY "images read auth" ON public.property_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "images staff manage" ON public.property_images FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- wp_sync_logs policies
CREATE POLICY "logs admin read" ON public.wp_sync_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- storage policies para property-images bucket
CREATE POLICY "property images public read" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
CREATE POLICY "property images staff write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-images' AND public.is_staff(auth.uid()));
CREATE POLICY "property images staff update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'property-images' AND public.is_staff(auth.uid()));
CREATE POLICY "property images staff delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-images' AND public.is_staff(auth.uid()));
