-- ================================================================
-- COBEB CICLO DE CARRETAS
-- Script: 030 — Admin Total multi-módulo: políticas RLS completas
-- Executar no Supabase Studio > SQL Editor
-- ================================================================

-- ── Viagens: admin_total pode criar e atualizar (visão motorista) ─────────────

DROP POLICY IF EXISTS "admin_total cria viagens" ON public.viagens;
CREATE POLICY "admin_total cria viagens"
  ON public.viagens FOR INSERT TO authenticated
  WITH CHECK (is_admin_total());

DROP POLICY IF EXISTS "admin_total atualiza viagens" ON public.viagens;
CREATE POLICY "admin_total atualiza viagens"
  ON public.viagens FOR UPDATE TO authenticated
  USING  (is_admin_total())
  WITH CHECK (is_admin_total());

-- ── Tarefas: admin_total pode criar (visão motorista) e atualizar (visão conferente) ──

DROP POLICY IF EXISTS "admin_total cria tarefas" ON public.tarefas;
CREATE POLICY "admin_total cria tarefas"
  ON public.tarefas FOR INSERT TO authenticated
  WITH CHECK (is_admin_total());

DROP POLICY IF EXISTS "admin_total atualiza tarefas" ON public.tarefas;
CREATE POLICY "admin_total atualiza tarefas"
  ON public.tarefas FOR UPDATE TO authenticated
  USING  (is_admin_total())
  WITH CHECK (is_admin_total());

-- ── Conferencia_itens: admin_total pode gerenciar (visão conferente) ──────────

DROP POLICY IF EXISTS "admin_total gerencia conf_itens" ON public.conferencia_itens;
CREATE POLICY "admin_total gerencia conf_itens"
  ON public.conferencia_itens FOR ALL TO authenticated
  USING  (is_admin_total())
  WITH CHECK (is_admin_total());

-- ── Anomalias: admin_total pode inserir (visão conferente) ───────────────────

DROP POLICY IF EXISTS "admin_total insere anomalias" ON public.anomalias;
CREATE POLICY "admin_total insere anomalias"
  ON public.anomalias FOR INSERT TO authenticated
  WITH CHECK (is_admin_total());

-- ── Storage anomalias-fotos: admin_total pode fazer upload ───────────────────

DROP POLICY IF EXISTS "admin_total upload anomalias fotos" ON storage.objects;
CREATE POLICY "admin_total upload anomalias fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anomalias-fotos' AND is_admin_total());

DROP POLICY IF EXISTS "admin_total update anomalias fotos" ON storage.objects;
CREATE POLICY "admin_total update anomalias fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'anomalias-fotos' AND is_admin_total());

-- ── Portaria: admin_total pode criar e atualizar (visão motorista + portaria) ─

DROP POLICY IF EXISTS "admin_total gerencia portaria_atendimentos" ON public.portaria_atendimentos;
CREATE POLICY "admin_total gerencia portaria_atendimentos"
  ON public.portaria_atendimentos FOR ALL TO authenticated
  USING  (is_admin_total())
  WITH CHECK (is_admin_total());
