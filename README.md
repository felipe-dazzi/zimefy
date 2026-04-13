# 🚀 ZimeFY ROI Dashboard

Dashboard de alta performance para monitoramento de ROI em tempo real (Kiwify + Meta Ads).

## 🛠️ Configuração de Deploy (Vercel)

Como o projeto usa o `.gitignore` para proteger suas chaves, você precisará configurar as **Environment Variables** (Variáveis de Ambiente) dentro do painel da Vercel após importar o repositório do GitHub.

### Variáveis Necessárias:

Adicione estas chaves em **Settings > Environment Variables** na Vercel:

1. `SUPABASE_URL`: Sua URL do Supabase.
2. `SUPABASE_ANON_KEY`: Sua Anon Key do Supabase.
3. `META_ACCESS_TOKEN`: O Token que acabamos de gerar.
4. `META_AD_ACCOUNT_ID`: O ID da sua conta de anúncios (ex: `act_...`).

## 📁 Estrutura do Projeto

- `/index.html`: Dashboard Principal.
- `/style.css`: Design System (Glassmorphism).
- `/app.js`: Motor de sincronização com Supabase.
- `/kiwify_roi_sync.json`: Workflow n8n para Vendas.
- `/meta_ads_sync.json`: Workflow n8n para Gastos Ads.

## 🔐 Segurança
O arquivo `.env` **nunca** deve ser enviado para o GitHub. Use sempre o painel da Vercel para gerenciar as chaves em produção.

---
**Desenvolvido por Antigravity para Zime Digital.**
