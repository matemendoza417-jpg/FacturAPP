-- Paso 1: Limpiar duplicados PRIMERO
DELETE FROM emisores a USING emisores b WHERE a.user_id = b.user_id AND a.nombre = b.nombre AND a.created_at < b.created_at;
DELETE FROM clientes a USING clientes b WHERE a.user_id = b.user_id AND a.nombre = b.nombre AND a.created_at < b.created_at;
DELETE FROM catalogo a USING catalogo b WHERE a.user_id = b.user_id AND a.nombre = b.nombre AND a.created_at < b.created_at;
DELETE FROM series a USING series b WHERE a.user_id = b.user_id AND a.nombre = b.nombre AND a.created_at < b.created_at;
DELETE FROM rectificativas a USING rectificativas b WHERE a.user_id = b.user_id AND a.nombre = b.nombre AND a.created_at < b.created_at;
DELETE FROM facturas a USING facturas b WHERE a.user_id = b.user_id AND a.nombre = b.nombre AND a.created_at < b.created_at;
DELETE FROM presupuestos a USING presupuestos b WHERE a.user_id = b.user_id AND a.numero = b.numero AND a.created_at < b.created_at;
DELETE FROM ordenes_trabajo a USING ordenes_trabajo b WHERE a.user_id = b.user_id AND a.numero = b.numero AND a.created_at < b.created_at;

-- Paso 2: Agregar columna logo
ALTER TABLE emisores ADD COLUMN IF NOT EXISTS logo TEXT;

-- Paso 3: Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_emisores_user_nombre ON emisores(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_user_nombre ON clientes(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalogo_user_nombre ON catalogo(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_series_user_nombre ON series(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rectificativas_user_nombre ON rectificativas(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_user_nombre ON facturas(user_id, nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_presupuestos_user_numero ON presupuestos(user_id, numero);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_user_numero ON ordenes_trabajo(user_id, numero);

-- Paso 4: Tablas nuevas (gastos y recurrentes)
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

-- Paso 5: RLS para tablas nuevas
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_gastos" ON gastos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_recurrentes" ON recurrentes FOR ALL USING (auth.uid() = user_id);

-- Paso 6: Índices para tablas nuevas
CREATE INDEX IF NOT EXISTS idx_gastos_user ON gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_recurrentes_user ON recurrentes(user_id);
