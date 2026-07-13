-- ══════════════════════════════════════════════════════════════
--  FacturAPP — Supabase Schema
--  Copiá y pegá esto en: Supabase → SQL Editor → New query
-- ══════════════════════════════════════════════════════════════

-- Tabla: emisores
CREATE TABLE IF NOT EXISTS emisores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alias TEXT,
  nombre TEXT,
  direccion TEXT,
  cp_ciudad TEXT,
  doi TEXT,
  cuenta_bancaria TEXT,
  logo TEXT,
  _predefined BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alias TEXT,
  nombre TEXT,
  direccion TEXT,
  cp_ciudad TEXT,
  nif TEXT,
  email TEXT,
  _predefined BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: facturas (índice de archivos PDF)
CREATE TABLE IF NOT EXISTS facturas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  emisor_nombre TEXT,
  cliente_nombre TEXT,
  total DECIMAL(10,2),
  iva DECIMAL(10,2),
  retencion DECIMAL(10,2),
  base DECIMAL(10,2),
  cobrado BOOLEAN DEFAULT false,
  cobrado_fecha DATE,
  cobrado_monto DECIMAL(10,2),
  cobrado_nota TEXT,
  fecha_emision DATE,
  serie TEXT,
  numero TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: presupuestos
CREATE TABLE IF NOT EXISTS presupuestos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  emisor_nombre TEXT,
  cliente_nombre TEXT,
  total DECIMAL(10,2),
  iva DECIMAL(10,2),
  retencion DECIMAL(10,2),
  base DECIMAL(10,2),
  estado TEXT DEFAULT 'pendiente',
  fecha DATE,
  Items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: ordenes_trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  emisor_nombre TEXT,
  cliente_nombre TEXT,
  total DECIMAL(10,2),
  estado TEXT DEFAULT 'activa',
  fecha DATE,
  Items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: catalogo
CREATE TABLE IF NOT EXISTS catalogo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2),
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: series
CREATE TABLE IF NOT EXISTS series (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  prefijo TEXT,
  contador INTEGER DEFAULT 0,
  activa BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: rectificativas
CREATE TABLE IF NOT EXISTS rectificativas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  factura_ref TEXT,
  emisor_nombre TEXT,
  cliente_nombre TEXT,
  total DECIMAL(10,2),
  iva DECIMAL(10,2),
  retencion DECIMAL(10,2),
  base DECIMAL(10,2),
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: iva_history
CREATE TABLE IF NOT EXISTS iva_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  factura_nombre TEXT,
  base DECIMAL(10,2),
  iva DECIMAL(10,2),
  retencion DECIMAL(10,2),
  total DECIMAL(10,2),
  fecha DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: cobros
CREATE TABLE IF NOT EXISTS cobros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  factura_nombre TEXT,
  monto DECIMAL(10,2),
  fecha DATE,
  metodo TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: tg_contacts (contactos de Telegram)
CREATE TABLE IF NOT EXISTS tg_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT,
  chat_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla: gastos (gastos deducibles)
CREATE TABLE IF NOT EXISTS gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  monto DECIMAL(10,2),
  fecha DATE,
  categoria TEXT,
  metodo TEXT,
  notas TEXT,
  creado TIMESTAMPTZ DEFAULT now(),
  actualizado TIMESTAMPTZ DEFAULT now()
);

-- Tabla: recurrentes (plantillas de facturas recurrentes)
CREATE TABLE IF NOT EXISTS recurrentes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  frecuencia TEXT DEFAULT 'mensual',
  fecha_inicio DATE,
  fecha_fin DATE,
  serie TEXT,
  notas TEXT,
  emisor_nombre TEXT,
  cliente_nombre TEXT,
  activa BOOLEAN DEFAULT true,
  ultima_generacion DATE,
  proxima_generacion DATE,
  iva DECIMAL(5,2) DEFAULT 21,
  retencion_rate DECIMAL(5,2) DEFAULT 19,
  retencion_enabled BOOLEAN DEFAULT false,
  creado TIMESTAMPTZ DEFAULT now()
);

-- Tabla: settings (configuración del usuario)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  tg_bot_token TEXT,
  theme TEXT DEFAULT 'light',
  iva_default DECIMAL(5,2) DEFAULT 21,
  retencion_default DECIMAL(5,2) DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
--  Cada usuario solo ve sus propios datos
-- ══════════════════════════════════════════════════════════════

ALTER TABLE emisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_trabajo ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE rectificativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE iva_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;
ALTER TABLE tg_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrentes ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario solo accede a sus datos
CREATE POLICY "users_own_emisores" ON emisores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_clientes" ON clientes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_facturas" ON facturas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_presupuestos" ON presupuestos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_ordenes" ON ordenes_trabajo FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_catalogo" ON catalogo FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_series" ON series FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_rectificativas" ON rectificativas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_iva" ON iva_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_cobros" ON cobros FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_tg" ON tg_contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_gastos" ON gastos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_recurrentes" ON recurrentes FOR ALL USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════
--  UNIQUE CONSTRAINTS (requeridos para upsert)
-- ══════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS idx_emisores_user_nombre ON emisores(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_user_nombre ON clientes(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_user_nombre ON catalogo(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_series_user_nombre ON series(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rectificativas_user_nombre ON rectificativas(user_id, nombre);

-- ══════════════════════════════════════════════════════════════
--  ÍNDICES para performance
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_emisores_user ON emisores(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_user ON facturas(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_user_nombre ON facturas(user_id, nombre);
CREATE INDEX IF NOT EXISTS idx_presupuestos_user ON presupuestos(user_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_user_nombre ON presupuestos(user_id, numero);
CREATE INDEX IF NOT EXISTS idx_ordenes_user ON ordenes_trabajo(user_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_user_nombre ON ordenes_trabajo(user_id, numero);
CREATE INDEX IF NOT EXISTS idx_catalogo_user ON catalogo(user_id);
CREATE INDEX IF NOT EXISTS idx_series_user ON series(user_id);
CREATE INDEX IF NOT EXISTS idx_rectificativas_user ON rectificativas(user_id);
CREATE INDEX IF NOT EXISTS idx_iva_user ON iva_history(user_id);
CREATE INDEX IF NOT EXISTS idx_cobros_user ON cobros(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_user ON tg_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_user ON gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_recurrentes_user ON recurrentes(user_id);
