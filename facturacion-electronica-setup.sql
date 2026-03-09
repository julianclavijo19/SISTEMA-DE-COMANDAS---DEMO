-- Tabla para almacenar las referencias locales de facturas electrónicas emitidas en Factus
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS electronic_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factus_id INTEGER,
  bill_number VARCHAR(50) NOT NULL,
  reference_code VARCHAR(100),
  cufe VARCHAR(255),
  status INTEGER DEFAULT 1,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  customer_name VARCHAR(255) DEFAULT 'Consumidor Final',
  customer_identification VARCHAR(50),
  customer_email VARCHAR(255),
  order_id TEXT REFERENCES orders(id),
  public_url TEXT,
  qr_image TEXT,
  payment_method VARCHAR(10),
  factus_created_at VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_bill_number ON electronic_invoices(bill_number);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_order_id ON electronic_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_customer_identification ON electronic_invoices(customer_identification);
CREATE INDEX IF NOT EXISTS idx_electronic_invoices_created_at ON electronic_invoices(created_at DESC);

-- Habilitar RLS
ALTER TABLE electronic_invoices ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (el API maneja la autenticación)
CREATE POLICY "Allow all operations on electronic_invoices" ON electronic_invoices
  FOR ALL USING (true) WITH CHECK (true);
