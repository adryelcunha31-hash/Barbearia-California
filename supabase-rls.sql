-- Blindagem de Banco de Dados (Supabase / PostgreSQL Row Level Security)
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  phone TEXT NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{10,13}$'),
  plan TEXT NOT NULL CHECK (plan IN ('avulso', 'mensal_2x', 'vip_4x')),
  price NUMERIC(10,2) NOT NULL DEFAULT 40.00,
  cuts_used INT NOT NULL DEFAULT 0,
  cuts_limit INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('active', 'overdue', 'rescheduled')),
  days_overdue INT NOT NULL DEFAULT 0,
  reschedule_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  due_date DATE NOT NULL,
  face_shape TEXT,
  recommended_cut TEXT,
  visagism_notes TEXT,
  consent_lgpd_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE live_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  position INT NOT NULL,
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'in_chair', 'relocated', 'done')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_queue ENABLE ROW LEVEL SECURITY;

-- Clientes só leem seus próprios dados; Barbeiro (admin) gerencia tudo
CREATE POLICY "member_self_select" ON members FOR SELECT USING (auth.uid() = id OR auth.jwt() ->> 'role' = 'barber_admin');
CREATE POLICY "admin_all_members" ON members FOR ALL USING (auth.jwt() ->> 'role' = 'barber_admin');
CREATE POLICY "public_queue_view" ON live_queue FOR SELECT USING (true);
CREATE POLICY "admin_queue_manage" ON live_queue FOR ALL USING (auth.jwt() ->> 'role' = 'barber_admin');
