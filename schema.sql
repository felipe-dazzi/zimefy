-- ==========================================
-- ZimeFY: Database Schema (Supabase)
-- Protocolo: ROI Real-Time Tracking
-- ==========================================

-- 1. Tabela de Vendas (Receita Líquida)
CREATE TABLE IF NOT EXISTS public.zimefy_vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_venda TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    cliente_email TEXT,
    produto TEXT,
    valor_bruto DECIMAL(10,2),
    valor_liquido DECIMAL(10,2), -- Valor após taxas da Kiwify
    plataforma TEXT DEFAULT 'Kiwify',
    utm_campaign TEXT, -- ID da Campanha FB
    utm_content TEXT,   -- ID do Anúncio (Ad) FB
    src TEXT,          -- Origem extra
    status TEXT DEFAULT 'aprovado'
);

-- 2. Tabela de Gastos de Anúncios (Custos)
CREATE TABLE IF NOT EXISTS public.zimefy_gastos_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_referencia DATE DEFAULT CURRENT_DATE,
    valor_gasto DECIMAL(10,2),
    cliques INTEGER DEFAULT 0,
    impressoes INTEGER DEFAULT 0,
    account_id TEXT,
    plataforma TEXT DEFAULT 'Facebook Ads',
    last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(data_referencia, account_id, plataforma)
);

-- Habilitar RLS (Segurança)
ALTER TABLE public.zimefy_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zimefy_gastos_ads ENABLE ROW LEVEL SECURITY;

-- Nota: Para simplificar o dashboard inicial, as políticas de leitura permitida para a chave anon podem ser aplicadas.
-- Em produção SaaS, usaríamos políticas baseadas em user_id.
