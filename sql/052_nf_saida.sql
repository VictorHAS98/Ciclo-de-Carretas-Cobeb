-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 052 — NF de Saída (Revenda → Fábrica) nas viagens
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- NF emitida pela revenda contra a fábrica para retorno de ativos de giro
-- (paletes de madeira, vasilhame). Opcional: motorista pode subir só com pedido.

ALTER TABLE public.viagens
  ADD COLUMN IF NOT EXISTS numero_nf_saida TEXT;

-- Copia a NF Saída para o atendimento de portaria ao chegar na revenda,
-- assim a portaria pode exibi-la sem precisar fazer join em viagens.
ALTER TABLE public.portaria_atendimentos
  ADD COLUMN IF NOT EXISTS numero_nf_saida TEXT;
