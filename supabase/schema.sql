-- PrimeCreditScore - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- ─── Enable UUID extension ────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles (extends auth.users) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  cpf_cnpj TEXT,
  credits_balance INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Consultation Types ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultation_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE CHECK (code IN ('basica_pf', 'basica_pj', 'rating_pf', 'rating_pj')),
  name TEXT NOT NULL,
  description TEXT,
  credits_cost INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed consultation types
INSERT INTO public.consultation_types (code, name, description, credits_cost) VALUES
  ('basica_pf', 'Básica PF', 'Consulta básica de Pessoa Física: identificação, status, anotações, score e participações', 1),
  ('basica_pj', 'Básica PJ', 'Consulta básica de Pessoa Jurídica: identificação, status, anotações e detalhamento societário', 1),
  ('rating_pf', 'Rating PF', 'Análise completa de Pessoa Física com renda e capacidade de pagamento', 2),
  ('rating_pj', 'Rating PJ', 'Análise completa de Pessoa Jurídica com score, risco, faturamento e sócios', 2)
ON CONFLICT (code) DO NOTHING;

-- ─── Credit Packages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed credit packages
INSERT INTO public.credit_packages (name, credits, price, popular) VALUES
  ('Starter', 10, 19.90, false),
  ('Profissional', 30, 49.90, true),
  ('Empresarial', 100, 149.90, false)
ON CONFLICT DO NOTHING;

-- ─── Consultations (History) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consultation_type_id UUID NOT NULL REFERENCES public.consultation_types(id),
  document TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('cpf', 'cnpj')),
  result_data JSONB,
  credits_used INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_user_id ON public.consultations(user_id);
CREATE INDEX IF NOT EXISTS idx_consultations_document ON public.consultations(document);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON public.consultations(created_at DESC);

-- ─── Credit Transactions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit_purchase', 'consultation_debit', 'admin_adjustment')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);

-- ─── PIX Payments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pix_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.credit_packages(id),
  asaas_payment_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'RECEIVED', 'OVERDUE', 'REFUNDED')),
  amount DECIMAL(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  pix_code TEXT,
  pix_qr_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pix_payments_user_id ON public.pix_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_asaas_id ON public.pix_payments(asaas_payment_id);

-- ─── Stored Procedures ────────────────────────────────────────────────────────

-- Debit credits from user (atomic)
CREATE OR REPLACE FUNCTION public.debit_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Consulta'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before INTEGER;
BEGIN
  SELECT credits_balance INTO v_balance_before
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance_before < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: % < %', v_balance_before, p_amount;
  END IF;

  UPDATE public.profiles
  SET credits_balance = credits_balance - p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_before, balance_after, description)
  VALUES (p_user_id, 'consultation_debit', -p_amount, v_balance_before, v_balance_before - p_amount, p_description);
END;
$$;

-- Credit balance (after payment)
CREATE OR REPLACE FUNCTION public.credit_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Compra de créditos',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance_before INTEGER;
BEGIN
  SELECT credits_balance INTO v_balance_before
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  UPDATE public.profiles
  SET credits_balance = credits_balance + p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, type, amount, balance_before, balance_after, description, reference_id)
  VALUES (p_user_id, 'credit_purchase', p_amount, v_balance_before, v_balance_before + p_amount, p_description, p_reference_id);
END;
$$;

-- ─── Trigger: Auto-create profile on signup ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, cpf_cnpj)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'cpf_cnpj'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Row Level Security (RLS) ─────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own, admins see all
CREATE POLICY "profiles_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Consultations: users see own, admins see all
CREATE POLICY "consultations_own" ON public.consultations
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "consultations_insert" ON public.consultations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Credit transactions: users see own
CREATE POLICY "credit_transactions_own" ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "credit_transactions_insert" ON public.credit_transactions
  FOR INSERT WITH CHECK (true); -- controlled via service role

-- PIX payments: users see own
CREATE POLICY "pix_payments_own" ON public.pix_payments
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));
CREATE POLICY "pix_payments_insert" ON public.pix_payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Consultation types and packages: readable by all authenticated
CREATE POLICY "consultation_types_read" ON public.consultation_types
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "consultation_types_admin" ON public.consultation_types
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "credit_packages_read" ON public.credit_packages
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "credit_packages_admin" ON public.credit_packages
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- ─── Grant permissions for service role ──────────────────────────────────────
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_credits TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_credits TO service_role;
