-- ============================================================
-- SISTEMA DE COMANDAS - DEMO
-- Script Consolidado de Base de Datos
-- ============================================================
-- Ejecutar este archivo COMPLETO en Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query > Pegar todo > Run)
--
-- Este script crea TODAS las tablas, funciones, vistas,
-- datos de ejemplo (menú, mesas, usuarios) necesarios
-- para que la demo funcione correctamente.
--
-- ORDEN DE EJECUCIÓN:
--   1. Tablas base (users, categories, products, areas, tables)
--   2. Tablas de pedidos (orders, order_items)
--   3. Tablas de pagos (payments, invoices, cash_registers)
--   4. Tablas auxiliares (refunds, discounts, print_queue, etc.)
--   5. Tablas de inventario (ingredients, stock_movements, etc.)
--   6. Funciones y vistas
--   7. RLS y políticas de acceso
--   8. Datos de demo (usuarios, menú, mesas, descuentos)
-- ============================================================


-- ############################################################
-- PARTE 1: ENUMS (tipos enumerados)
-- ############################################################

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'CASHIER', 'WAITER', 'KITCHEN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'table_status') THEN
    CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'IN_KITCHEN', 'READY', 'SERVED', 'PAID', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type') THEN
    CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEOUT', 'DELIVERY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_item_status') THEN
    CREATE TYPE "OrderItemStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cash_register_status') THEN
    CREATE TYPE "CashRegisterStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$;


-- ############################################################
-- PARTE 2: TABLAS BASE
-- ############################################################

-- ==================== USUARIOS ====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'WAITER',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== CATEGORÍAS ====================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PRODUCTOS ====================
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  image TEXT,
  is_active BOOLEAN DEFAULT true,
  in_stock BOOLEAN DEFAULT true,
  prep_time INT DEFAULT 10,
  category_id TEXT REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ÁREAS ====================
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== MESAS ====================
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number INT NOT NULL,
  name TEXT,
  capacity INT DEFAULT 4,
  status TEXT DEFAULT 'AVAILABLE',
  "areaId" TEXT REFERENCES areas(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== CONFIGURACIÓN ====================
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- PARTE 3: TABLAS DE PEDIDOS
-- ############################################################

-- ==================== ÓRDENES ====================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'PENDING',
  table_id TEXT REFERENCES tables(id),
  customer_id TEXT,
  customer_name TEXT,
  order_type TEXT DEFAULT 'DINE_IN',
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  discount_type TEXT,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  tip DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  waiter_id TEXT REFERENCES users(id),
  kitchen_printed BOOLEAN DEFAULT false,
  payment_method TEXT,
  paid_at TIMESTAMPTZ,
  paid_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ITEMS DE ORDEN ====================
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INT DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- PARTE 4: TABLAS DE PAGOS Y CAJA
-- ############################################################

-- ==================== CAJA REGISTRADORA (Turnos) ====================
CREATE TABLE IF NOT EXISTS cash_registers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id),
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_amount DECIMAL(10,2),
  expected_amount DECIMAL(10,2),
  difference DECIMAL(10,2),
  cash_sales DECIMAL(10,2) DEFAULT 0,
  card_sales DECIMAL(10,2) DEFAULT 0,
  transfer_sales DECIMAL(10,2) DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  register_type TEXT DEFAULT 'RESTAURANT',
  notes TEXT,
  status TEXT DEFAULT 'OPEN',
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PAGOS ====================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'CASH',
  reference TEXT,
  received_amount DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  status TEXT DEFAULT 'PAID',
  cash_register_id TEXT REFERENCES cash_registers(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== FACTURAS ====================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_number TEXT UNIQUE NOT NULL,
  order_id TEXT REFERENCES orders(id),
  payment_id TEXT REFERENCES payments(id),
  table_id TEXT REFERENCES tables(id),
  customer_name TEXT DEFAULT 'Consumidor Final',
  customer_nit TEXT DEFAULT 'CF',
  customer_address TEXT,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  tip DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT,
  status TEXT DEFAULT 'paid',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancelled_by TEXT REFERENCES users(id),
  cancellation_reason TEXT
);


-- ############################################################
-- PARTE 5: TABLAS AUXILIARES
-- ############################################################

-- ==================== DEVOLUCIONES ====================
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT REFERENCES orders(id),
  payment_id TEXT REFERENCES payments(id),
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  approved_by TEXT REFERENCES users(id),
  created_by TEXT REFERENCES users(id),
  notes TEXT,
  payment_method TEXT DEFAULT 'CASH',
  cash_register_id TEXT REFERENCES cash_registers(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- ==================== DESCUENTOS (Configurables) ====================
CREATE TABLE IF NOT EXISTS discounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  value DECIMAL(10,2) NOT NULL CHECK (value > 0),
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  requires_authorization BOOLEAN DEFAULT false,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  usage_limit INT,
  times_used INT DEFAULT 0,
  applies_to TEXT DEFAULT 'ALL',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES users(id)
);

-- ==================== DESCUENTOS APLICADOS (Historial) ====================
CREATE TABLE IF NOT EXISTS applied_discounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_id TEXT REFERENCES discounts(id),
  discount_type TEXT NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  original_total DECIMAL(10,2),
  new_total DECIMAL(10,2),
  reason TEXT,
  applied_by TEXT REFERENCES users(id),
  authorized_by TEXT REFERENCES users(id),
  coupon_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== COLA DE IMPRESIÓN ====================
CREATE TABLE IF NOT EXISTS print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('kitchen', 'correction', 'cash_drawer')),
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printed_at TIMESTAMPTZ NULL
);

-- ==================== LOGS DE IMPRESIÓN ====================
CREATE TABLE IF NOT EXISTS print_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT REFERENCES orders(id),
  print_type TEXT NOT NULL,
  printed_by TEXT REFERENCES users(id),
  printer_name TEXT,
  copies INT DEFAULT 1,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- PARTE 6: TABLAS DE INVENTARIO
-- ############################################################

-- ==================== INGREDIENTES ====================
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  current_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== MERMAS / DESPERDICIOS ====================
CREATE TABLE IF NOT EXISTS ingredient_waste (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== MOVIMIENTOS DE STOCK ====================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT', 'WASTE')),
  quantity DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################
-- PARTE 7: ÍNDICES
-- ############################################################

-- Usuarios
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Productos
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Mesas
CREATE INDEX IF NOT EXISTS idx_tables_area ON tables("areaId");
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);

-- Órdenes
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);

-- Items de orden
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Pagos
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_cash_register ON payments(cash_register_id);

-- Facturas
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Caja registradora
CREATE INDEX IF NOT EXISTS idx_cash_registers_user_id ON cash_registers(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_opened_at ON cash_registers(opened_at);
CREATE INDEX IF NOT EXISTS idx_cash_registers_type ON cash_registers(register_type);

-- Devoluciones
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_cash_register ON refunds(cash_register_id);

-- Descuentos
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(is_active);
CREATE INDEX IF NOT EXISTS idx_discounts_type ON discounts(discount_type);
CREATE INDEX IF NOT EXISTS idx_applied_discounts_order ON applied_discounts(order_id);
CREATE INDEX IF NOT EXISTS idx_applied_discounts_date ON applied_discounts(created_at);

-- Cola de impresión
CREATE INDEX IF NOT EXISTS idx_print_queue_printed_at ON print_queue(printed_at);
CREATE INDEX IF NOT EXISTS idx_print_queue_created_at ON print_queue(created_at);

-- Logs de impresión
CREATE INDEX IF NOT EXISTS idx_print_logs_order_id ON print_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_created_at ON print_logs(created_at);

-- Inventario
CREATE INDEX IF NOT EXISTS idx_ingredients_active ON ingredients(is_active);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_ingredient_waste_ingredient ON ingredient_waste(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_ingredient_waste_date ON ingredient_waste(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(type);


-- ############################################################
-- PARTE 8: ROW LEVEL SECURITY (RLS) + POLÍTICAS
-- ############################################################

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE applied_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_waste ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (acceso completo - demo)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'users', 'categories', 'products', 'areas', 'tables', 'settings',
    'orders', 'order_items', 'payments', 'invoices', 'cash_registers',
    'refunds', 'discounts', 'applied_discounts', 'print_queue', 'print_logs',
    'ingredients', 'ingredient_waste', 'stock_movements'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;


-- ############################################################
-- PARTE 9: FUNCIONES
-- ############################################################

-- Función para generar número de factura
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  today_date TEXT;
  count_today INT;
  new_number TEXT;
BEGIN
  today_date := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO count_today
  FROM invoices
  WHERE DATE(created_at) = CURRENT_DATE;
  new_number := 'INV-' || today_date || '-' || LPAD(count_today::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Función para procesar pago completo (atómico)
CREATE OR REPLACE FUNCTION process_order_payment(
  p_order_id TEXT,
  p_payment_method TEXT,
  p_received_amount DECIMAL(10,2),
  p_change_amount DECIMAL(10,2),
  p_tip DECIMAL(10,2) DEFAULT 0,
  p_discount DECIMAL(10,2) DEFAULT 0,
  p_discount_type TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_payment_id TEXT;
  v_invoice_id TEXT;
  v_invoice_number TEXT;
  v_final_total DECIMAL(10,2);
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Orden no encontrada');
  END IF;
  IF v_order.status = 'PAID' THEN
    RETURN json_build_object('success', false, 'error', 'La orden ya está pagada');
  END IF;

  v_final_total := v_order.subtotal + v_order.tax - p_discount + p_tip;

  INSERT INTO payments (order_id, amount, method, received_amount, change_amount)
  VALUES (p_order_id, v_final_total, p_payment_method, p_received_amount, p_change_amount)
  RETURNING id INTO v_payment_id;

  v_invoice_number := generate_invoice_number();

  INSERT INTO invoices (
    invoice_number, order_id, payment_id, table_id,
    subtotal, discount, tax, total, tip, payment_method, created_by
  ) VALUES (
    v_invoice_number, p_order_id, v_payment_id, v_order.table_id,
    v_order.subtotal, p_discount, v_order.tax, v_final_total, p_tip, p_payment_method, p_user_id
  ) RETURNING id INTO v_invoice_id;

  UPDATE orders SET
    status = 'PAID', discount = p_discount, discount_type = p_discount_type,
    tip = p_tip, total = v_final_total, paid_at = NOW(), paid_by = p_user_id,
    payment_method = p_payment_method, updated_at = NOW()
  WHERE id = p_order_id;

  IF v_order.table_id IS NOT NULL THEN
    UPDATE tables SET status = 'AVAILABLE', updated_at = NOW()
    WHERE id = v_order.table_id
    AND NOT EXISTS (
      SELECT 1 FROM orders
      WHERE table_id = v_order.table_id AND id != p_order_id
      AND status NOT IN ('PAID', 'CANCELLED')
    );
  END IF;

  RETURN json_build_object(
    'success', true, 'payment_id', v_payment_id,
    'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
    'total', v_final_total, 'change', p_change_amount
  );
END;
$$ LANGUAGE plpgsql;

-- Función para verificar caja abierta por tipo
CREATE OR REPLACE FUNCTION get_open_register_by_type(p_type TEXT)
RETURNS TABLE (
  id TEXT, user_id TEXT, opening_amount DECIMAL,
  cash_sales DECIMAL, card_sales DECIMAL, transfer_sales DECIMAL,
  total_sales DECIMAL, opened_at TIMESTAMPTZ, status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT cr.id, cr.user_id, cr.opening_amount,
    cr.cash_sales, cr.card_sales, cr.transfer_sales,
    cr.total_sales, cr.opened_at, cr.status
  FROM cash_registers cr
  WHERE cr.register_type = p_type AND cr.status = 'OPEN'
  ORDER BY cr.opened_at DESC LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Función para calcular total de devoluciones por turno
CREATE OR REPLACE FUNCTION calculate_shift_refunds(shift_id TEXT)
RETURNS DECIMAL AS $$
DECLARE
  total DECIMAL;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM refunds
  WHERE cash_register_id = shift_id AND status = 'APPROVED';
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar timestamp de ingredientes
CREATE OR REPLACE FUNCTION update_ingredient_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingredients_update_timestamp ON ingredients;
CREATE TRIGGER ingredients_update_timestamp
  BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION update_ingredient_timestamp();

-- Trigger para actualizar timestamp de descuentos
CREATE OR REPLACE FUNCTION update_discount_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_discount_timestamp ON discounts;
CREATE TRIGGER trigger_update_discount_timestamp
  BEFORE UPDATE ON discounts
  FOR EACH ROW EXECUTE FUNCTION update_discount_timestamp();

-- Función para resumen de inventario
CREATE OR REPLACE FUNCTION get_inventory_summary()
RETURNS TABLE (
  total_ingredients BIGINT, low_stock_count BIGINT,
  out_of_stock_count BIGINT, total_value DECIMAL, waste_this_month DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM ingredients WHERE is_active = true)::BIGINT,
    (SELECT COUNT(*) FROM ingredients WHERE is_active = true AND current_stock <= min_stock AND current_stock > 0)::BIGINT,
    (SELECT COUNT(*) FROM ingredients WHERE is_active = true AND current_stock = 0)::BIGINT,
    (SELECT COALESCE(SUM(current_stock * cost_per_unit), 0) FROM ingredients WHERE is_active = true)::DECIMAL,
    (SELECT COALESCE(SUM(w.quantity * i.cost_per_unit), 0)
     FROM ingredient_waste w JOIN ingredients i ON w.ingredient_id = i.id
     WHERE w.created_at >= date_trunc('month', CURRENT_DATE))::DECIMAL;
END;
$$ LANGUAGE plpgsql;


-- ############################################################
-- PARTE 10: VISTAS
-- ############################################################

-- Vista de resumen de ventas
CREATE OR REPLACE VIEW sales_summary AS
SELECT
  DATE(p.created_at) as sale_date,
  p.method as payment_method,
  COUNT(*) as transaction_count,
  SUM(p.amount) as total_amount,
  COALESCE(SUM(p.change_amount), 0) as total_change_given
FROM payments p
GROUP BY DATE(p.created_at), p.method
ORDER BY sale_date DESC, payment_method;

-- Vista de alertas de stock bajo
CREATE OR REPLACE VIEW low_stock_alerts AS
SELECT
  id, name, current_stock, min_stock, unit, supplier, category,
  CASE
    WHEN current_stock = 0 THEN 'AGOTADO'
    WHEN current_stock <= min_stock THEN 'STOCK_BAJO'
    ELSE 'OK'
  END as status
FROM ingredients
WHERE is_active = true AND current_stock <= min_stock
ORDER BY
  CASE WHEN current_stock = 0 THEN 0 ELSE 1 END,
  (min_stock - current_stock) DESC;

-- Vista de estadísticas por tipo de caja
CREATE OR REPLACE VIEW cash_register_stats AS
SELECT
  register_type,
  COUNT(*) as total_shifts,
  SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open_shifts,
  SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed_shifts,
  SUM(total_sales) as total_revenue,
  SUM(cash_sales) as total_cash,
  SUM(card_sales) as total_card,
  SUM(transfer_sales) as total_transfer,
  AVG(difference) as avg_difference
FROM cash_registers
WHERE status = 'CLOSED'
GROUP BY register_type;

-- Vista de resumen de descuentos
CREATE OR REPLACE VIEW discount_summary AS
SELECT
  d.id, d.name, d.discount_type, d.value, d.is_active, d.times_used,
  COALESCE(SUM(ad.discount_amount), 0) as total_discounted,
  COUNT(ad.id) as times_applied
FROM discounts d
LEFT JOIN applied_discounts ad ON d.id = ad.discount_id
GROUP BY d.id, d.name, d.discount_type, d.value, d.is_active, d.times_used;

-- Vista de devoluciones por día
CREATE OR REPLACE VIEW refunds_daily_summary AS
SELECT
  DATE(created_at) as fecha,
  payment_method,
  COUNT(*) as total_devoluciones,
  SUM(amount) as monto_total
FROM refunds
WHERE status = 'APPROVED'
GROUP BY DATE(created_at), payment_method
ORDER BY fecha DESC;

-- Vista de reimpresiones por día
CREATE OR REPLACE VIEW print_logs_summary AS
SELECT
  DATE(created_at) as fecha,
  print_type,
  COUNT(*) as total_impresiones,
  COUNT(*) FILTER (WHERE success = true) as exitosas,
  COUNT(*) FILTER (WHERE success = false) as fallidas
FROM print_logs
GROUP BY DATE(created_at), print_type
ORDER BY fecha DESC;


-- ############################################################
-- PARTE 11: COMENTARIOS DE DOCUMENTACIÓN
-- ############################################################

COMMENT ON TABLE users IS 'Usuarios del sistema (admin, cajero, mesero, cocina)';
COMMENT ON TABLE categories IS 'Categorías de productos del menú';
COMMENT ON TABLE products IS 'Productos/platos del menú';
COMMENT ON TABLE areas IS 'Áreas físicas del restaurante';
COMMENT ON TABLE tables IS 'Mesas del restaurante';
COMMENT ON TABLE orders IS 'Pedidos/comandas';
COMMENT ON TABLE order_items IS 'Items individuales de cada pedido';
COMMENT ON TABLE payments IS 'Registro de pagos realizados';
COMMENT ON TABLE invoices IS 'Facturas generadas';
COMMENT ON TABLE cash_registers IS 'Turnos de caja para control de efectivo';
COMMENT ON TABLE refunds IS 'Devoluciones procesadas';
COMMENT ON TABLE discounts IS 'Descuentos configurables del sistema';
COMMENT ON TABLE applied_discounts IS 'Historial de descuentos aplicados a órdenes';
COMMENT ON TABLE print_queue IS 'Cola de trabajos de impresión (cocina/caja)';
COMMENT ON TABLE print_logs IS 'Registro de impresiones realizadas';
COMMENT ON TABLE ingredients IS 'Ingredientes del inventario';
COMMENT ON TABLE ingredient_waste IS 'Registro de mermas/desperdicios';
COMMENT ON TABLE stock_movements IS 'Movimientos de entrada/salida de stock';
COMMENT ON TABLE settings IS 'Configuración general del sistema';
COMMENT ON FUNCTION process_order_payment IS 'Proceso atómico para procesar un pago completo';
COMMENT ON FUNCTION generate_invoice_number IS 'Genera número de factura único por día';


-- ############################################################
-- PARTE 12: DATOS DE DEMO
-- ############################################################

-- ==================== LIMPIAR DATOS EXISTENTES ====================
-- (Orden correcto para respetar foreign keys)
DELETE FROM print_logs;
DELETE FROM print_queue;
DELETE FROM applied_discounts;
DELETE FROM refunds;
DELETE FROM invoices;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM cash_registers;
DELETE FROM ingredient_waste;
DELETE FROM stock_movements;
DELETE FROM ingredients;
DELETE FROM discounts;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM tables;
DELETE FROM areas;
DELETE FROM settings;
DELETE FROM users;


-- ==================== USUARIOS DEMO ====================
-- Contraseñas en texto plano (el sistema las migra a bcrypt en el primer login)

INSERT INTO users (id, name, email, password, role, is_active) VALUES
  (gen_random_uuid()::text, 'Admin Demo', 'admin@demo.com', 'admin123', 'ADMIN', true),
  (gen_random_uuid()::text, 'Cajero Demo', 'cajero@demo.com', 'cajero123', 'CASHIER', true),
  (gen_random_uuid()::text, 'Mesero Demo', 'mesero@demo.com', 'mesero123', 'WAITER', true),
  (gen_random_uuid()::text, 'Cocina Demo', 'cocina@demo.com', 'cocina123', 'KITCHEN', true);


-- ==================== ÁREA Y MESAS ====================
INSERT INTO areas (id, name, description) VALUES
  (gen_random_uuid()::text, 'Salón Principal', 'Área principal del restaurante');

DO $$
DECLARE v_area_id TEXT;
BEGIN
  SELECT id INTO v_area_id FROM areas WHERE name = 'Salón Principal' LIMIT 1;
  INSERT INTO tables (id, number, name, capacity, "areaId", status) VALUES
    (gen_random_uuid()::text, 1, 'Mesa 1', 4, v_area_id, 'AVAILABLE'),
    (gen_random_uuid()::text, 2, 'Mesa 2', 4, v_area_id, 'AVAILABLE'),
    (gen_random_uuid()::text, 3, 'Mesa 3', 4, v_area_id, 'AVAILABLE'),
    (gen_random_uuid()::text, 4, 'Mesa 4', 4, v_area_id, 'AVAILABLE'),
    (gen_random_uuid()::text, 5, 'Mesa 5', 6, v_area_id, 'AVAILABLE'),
    (gen_random_uuid()::text, 6, 'Mesa 6', 6, v_area_id, 'AVAILABLE'),
    (gen_random_uuid()::text, 7, 'Mesa 7', 4, v_area_id, 'AVAILABLE'),
    (gen_random_uuid()::text, 8, 'Mesa 8', 4, v_area_id, 'AVAILABLE');
END $$;


-- ==================== CATEGORÍAS DEL MENÚ ====================
INSERT INTO categories (id, name, description, color) VALUES
  (gen_random_uuid()::text, 'Entradas', 'Aperitivos y entradas para comenzar', '#3b82f6'),
  (gen_random_uuid()::text, 'Sopas', 'Sopas tradicionales chinas y criollas', '#10b981'),
  (gen_random_uuid()::text, 'Arroces', 'Variedades de arroz frito y especial', '#f59e0b'),
  (gen_random_uuid()::text, 'Chow Mein', 'Tallarines salteados al wok', '#ef4444'),
  (gen_random_uuid()::text, 'Chop Suey', 'Vegetales salteados con proteína', '#8b5cf6'),
  (gen_random_uuid()::text, 'Especialidades', 'Platos exclusivos del chef', '#ec4899'),
  (gen_random_uuid()::text, 'Carnes', 'Platos con res y cerdo', '#dc2626'),
  (gen_random_uuid()::text, 'Pollo', 'Preparaciones con pollo', '#f97316'),
  (gen_random_uuid()::text, 'Mariscos', 'Camarones, pescado y frutos del mar', '#0ea5e9'),
  (gen_random_uuid()::text, 'Platos Colombianos', 'Platos típicos colombianos', '#84cc16'),
  (gen_random_uuid()::text, 'Bebidas', 'Refrescos, jugos y bebidas', '#06b6d4'),
  (gen_random_uuid()::text, 'Postres', 'Dulces y postres', '#d946ef');


-- ==================== PRODUCTOS DEL MENÚ ====================
DO $$
DECLARE
  v_entradas TEXT; v_sopas TEXT; v_arroces TEXT; v_chowmein TEXT;
  v_chopsuey TEXT; v_especialidades TEXT; v_carnes TEXT; v_pollo TEXT;
  v_mariscos TEXT; v_colombianos TEXT; v_bebidas TEXT; v_postres TEXT;
BEGIN
  SELECT id INTO v_entradas FROM categories WHERE name = 'Entradas' LIMIT 1;
  SELECT id INTO v_sopas FROM categories WHERE name = 'Sopas' LIMIT 1;
  SELECT id INTO v_arroces FROM categories WHERE name = 'Arroces' LIMIT 1;
  SELECT id INTO v_chowmein FROM categories WHERE name = 'Chow Mein' LIMIT 1;
  SELECT id INTO v_chopsuey FROM categories WHERE name = 'Chop Suey' LIMIT 1;
  SELECT id INTO v_especialidades FROM categories WHERE name = 'Especialidades' LIMIT 1;
  SELECT id INTO v_carnes FROM categories WHERE name = 'Carnes' LIMIT 1;
  SELECT id INTO v_pollo FROM categories WHERE name = 'Pollo' LIMIT 1;
  SELECT id INTO v_mariscos FROM categories WHERE name = 'Mariscos' LIMIT 1;
  SELECT id INTO v_colombianos FROM categories WHERE name = 'Platos Colombianos' LIMIT 1;
  SELECT id INTO v_bebidas FROM categories WHERE name = 'Bebidas' LIMIT 1;
  SELECT id INTO v_postres FROM categories WHERE name = 'Postres' LIMIT 1;

  -- ENTRADAS
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Rollitos Primavera (4 und)', 'Crujientes rollitos rellenos de vegetales', 12000, v_entradas, 8, true),
    (gen_random_uuid()::text, 'Wonton Frito (6 und)', 'Masa crujiente rellena de cerdo y camarón', 14000, v_entradas, 10, true),
    (gen_random_uuid()::text, 'Empanadas Chinas (4 und)', 'Gyozas al vapor o fritas', 13000, v_entradas, 12, true),
    (gen_random_uuid()::text, 'Costillitas BBQ', 'Costillas de cerdo en salsa barbecue china', 22000, v_entradas, 15, true),
    (gen_random_uuid()::text, 'Camarones Apanados (8 und)', 'Camarones empanizados con salsa agridulce', 24000, v_entradas, 12, true),
    (gen_random_uuid()::text, 'Picada China para 2', 'Surtido de entradas: rollitos, wontons, costillitas', 38000, v_entradas, 15, true);

  -- SOPAS
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Sopa Wonton', 'Caldo con wontons de cerdo y verduras', 15000, v_sopas, 10, true),
    (gen_random_uuid()::text, 'Sopa de Maíz con Pollo', 'Cremosa sopa de maíz estilo cantonés', 14000, v_sopas, 10, true),
    (gen_random_uuid()::text, 'Sopa Agripicante', 'Tradicional sopa hot and sour', 16000, v_sopas, 12, true),
    (gen_random_uuid()::text, 'Sopa de Mariscos', 'Sopa especial con camarones y pescado', 22000, v_sopas, 15, true),
    (gen_random_uuid()::text, 'Consomé de Pollo', 'Caldo tradicional colombiano', 10000, v_sopas, 8, true);

  -- ARROCES
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Arroz Frito con Pollo', 'Arroz salteado con pollo y vegetales', 18000, v_arroces, 12, true),
    (gen_random_uuid()::text, 'Arroz Frito con Cerdo', 'Arroz salteado con cerdo asado', 18000, v_arroces, 12, true),
    (gen_random_uuid()::text, 'Arroz Frito con Camarón', 'Arroz salteado con camarones frescos', 24000, v_arroces, 12, true),
    (gen_random_uuid()::text, 'Arroz Frito Especial', 'Arroz con pollo, cerdo, camarón y vegetales', 26000, v_arroces, 15, true),
    (gen_random_uuid()::text, 'Arroz Frito Tres Delicias', 'Arroz con jamón, pollo y huevo', 20000, v_arroces, 12, true),
    (gen_random_uuid()::text, 'Arroz Blanco', 'Porción de arroz blanco', 5000, v_arroces, 5, true);

  -- CHOW MEIN
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Chow Mein de Pollo', 'Tallarines salteados con pollo', 19000, v_chowmein, 12, true),
    (gen_random_uuid()::text, 'Chow Mein de Cerdo', 'Tallarines salteados con cerdo', 19000, v_chowmein, 12, true),
    (gen_random_uuid()::text, 'Chow Mein de Camarón', 'Tallarines salteados con camarones', 25000, v_chowmein, 12, true),
    (gen_random_uuid()::text, 'Chow Mein Especial', 'Tallarines con pollo, cerdo y camarón', 27000, v_chowmein, 15, true),
    (gen_random_uuid()::text, 'Chow Mein Vegetariano', 'Tallarines con tofu y vegetales', 17000, v_chowmein, 12, true);

  -- CHOP SUEY
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Chop Suey de Pollo', 'Vegetales salteados con pollo', 18000, v_chopsuey, 12, true),
    (gen_random_uuid()::text, 'Chop Suey de Cerdo', 'Vegetales salteados con cerdo', 18000, v_chopsuey, 12, true),
    (gen_random_uuid()::text, 'Chop Suey de Camarón', 'Vegetales salteados con camarones', 24000, v_chopsuey, 12, true),
    (gen_random_uuid()::text, 'Chop Suey Especial', 'Vegetales con pollo, cerdo y camarón', 26000, v_chopsuey, 15, true),
    (gen_random_uuid()::text, 'Chop Suey Vegetariano', 'Solo vegetales frescos', 15000, v_chopsuey, 10, true);

  -- ESPECIALIDADES
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Pollo General Tso', 'Pollo crujiente en salsa dulce picante', 26000, v_especialidades, 15, true),
    (gen_random_uuid()::text, 'Pollo Kung Pao', 'Pollo con maní en salsa especiada', 25000, v_especialidades, 15, true),
    (gen_random_uuid()::text, 'Res con Brócoli', 'Carne de res salteada con brócoli fresco', 28000, v_especialidades, 15, true),
    (gen_random_uuid()::text, 'Camarones con Salsa de Ajo', 'Camarones en deliciosa salsa de ajo', 32000, v_especialidades, 12, true),
    (gen_random_uuid()::text, 'Cerdo Agridulce', 'Cerdo en salsa agridulce con piña', 24000, v_especialidades, 15, true),
    (gen_random_uuid()::text, 'Combinado Dragón Dorado', 'Para 2: arroz, chow mein, res y pollo', 52000, v_especialidades, 20, true),
    (gen_random_uuid()::text, 'Bandeja Familiar (4 pers)', 'Arroz, chow mein, pollo, cerdo, camarón', 95000, v_especialidades, 25, true);

  -- CARNES
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Res con Pimentón', 'Carne de res con pimentones de colores', 26000, v_carnes, 15, true),
    (gen_random_uuid()::text, 'Res Mongoliana', 'Carne de res en salsa mongoliana', 28000, v_carnes, 15, true),
    (gen_random_uuid()::text, 'Res con Champiñones', 'Res salteada con champiñones frescos', 27000, v_carnes, 15, true),
    (gen_random_uuid()::text, 'Cerdo con Vegetales', 'Cerdo salteado con vegetales mixtos', 22000, v_carnes, 12, true),
    (gen_random_uuid()::text, 'Cerdo Szechuan', 'Cerdo en salsa picante estilo Szechuan', 24000, v_carnes, 15, true),
    (gen_random_uuid()::text, 'Costilla de Cerdo Frita', 'Costillas crujientes con salsa especial', 28000, v_carnes, 18, true);

  -- POLLO
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Pollo Agridulce', 'Pollo crujiente en salsa agridulce', 22000, v_pollo, 15, true),
    (gen_random_uuid()::text, 'Pollo con Piña', 'Pollo salteado con piña natural', 23000, v_pollo, 12, true),
    (gen_random_uuid()::text, 'Pollo con Vegetales', 'Pollo con vegetales frescos salteados', 20000, v_pollo, 12, true),
    (gen_random_uuid()::text, 'Pollo con Champiñones', 'Pollo salteado con champiñones', 22000, v_pollo, 12, true),
    (gen_random_uuid()::text, 'Pollo Teriyaki', 'Pollo en salsa teriyaki japonesa', 24000, v_pollo, 15, true),
    (gen_random_uuid()::text, 'Pollo con Curry', 'Pollo en cremosa salsa de curry', 23000, v_pollo, 15, true),
    (gen_random_uuid()::text, 'Alitas BBQ Chinas (12 und)', 'Alitas en salsa BBQ estilo chino', 22000, v_pollo, 18, true);

  -- MARISCOS
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Camarones con Vegetales', 'Camarones salteados con vegetales', 28000, v_mariscos, 12, true),
    (gen_random_uuid()::text, 'Camarones Agridulce', 'Camarones en salsa agridulce', 30000, v_mariscos, 15, true),
    (gen_random_uuid()::text, 'Camarones al Curry', 'Camarones en salsa de curry', 30000, v_mariscos, 15, true),
    (gen_random_uuid()::text, 'Pescado Frito Entero', 'Mojarra frita con salsa especial', 35000, v_mariscos, 20, true),
    (gen_random_uuid()::text, 'Camarones al Ajillo', 'Camarones salteados con ajo', 32000, v_mariscos, 12, true),
    (gen_random_uuid()::text, 'Cazuela de Mariscos', 'Surtido de mariscos en salsa especial', 45000, v_mariscos, 20, true);

  -- PLATOS COLOMBIANOS
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Bandeja Paisa', 'Fríjoles, arroz, carne, chicharrón, huevo, arepa', 32000, v_colombianos, 20, true),
    (gen_random_uuid()::text, 'Churrasco con Papas', 'Churrasco de res con papas fritas', 35000, v_colombianos, 20, true),
    (gen_random_uuid()::text, 'Pechuga a la Plancha', 'Pechuga de pollo con ensalada y arroz', 25000, v_colombianos, 15, true),
    (gen_random_uuid()::text, 'Mojarra Frita', 'Mojarra entera frita con patacones', 30000, v_colombianos, 20, true),
    (gen_random_uuid()::text, 'Cazuela de Fríjoles', 'Con chicharrón, carne y arroz', 22000, v_colombianos, 15, true),
    (gen_random_uuid()::text, 'Sobrebarriga en Salsa', 'Sobrebarriga criolla con papas', 28000, v_colombianos, 20, true);

  -- BEBIDAS
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Gaseosa Personal', 'Coca-Cola, Sprite, Fanta 350ml', 4000, v_bebidas, 1, true),
    (gen_random_uuid()::text, 'Gaseosa Litro', 'Coca-Cola, Sprite, Fanta 1.5L', 8000, v_bebidas, 1, true),
    (gen_random_uuid()::text, 'Jugo Natural', 'Limonada, naranja, maracuyá', 6000, v_bebidas, 5, true),
    (gen_random_uuid()::text, 'Limonada de Coco', 'Limonada cremosa con coco', 8000, v_bebidas, 5, true),
    (gen_random_uuid()::text, 'Té Helado', 'Té frío de limón o durazno', 5000, v_bebidas, 2, true),
    (gen_random_uuid()::text, 'Té Chino Caliente', 'Té verde o jazmín', 4000, v_bebidas, 3, true),
    (gen_random_uuid()::text, 'Agua Botella', 'Agua natural o con gas 600ml', 3000, v_bebidas, 1, true),
    (gen_random_uuid()::text, 'Cerveza Nacional', 'Poker, Águila, Club Colombia', 6000, v_bebidas, 1, true),
    (gen_random_uuid()::text, 'Cerveza Importada', 'Corona, Heineken, Budweiser', 10000, v_bebidas, 1, true);

  -- POSTRES
  INSERT INTO products (id, name, description, price, category_id, prep_time, is_available) VALUES
    (gen_random_uuid()::text, 'Helado Frito', 'Helado de vainilla empanizado crujiente', 12000, v_postres, 8, true),
    (gen_random_uuid()::text, 'Banana Split', 'Banano con helado, crema y salsas', 14000, v_postres, 5, true),
    (gen_random_uuid()::text, 'Flan de Caramelo', 'Suave flan casero con caramelo', 8000, v_postres, 2, true),
    (gen_random_uuid()::text, 'Arroz con Leche', 'Cremoso arroz con leche y canela', 7000, v_postres, 2, true),
    (gen_random_uuid()::text, 'Tres Leches', 'Porción de pastel tres leches', 10000, v_postres, 2, true),
    (gen_random_uuid()::text, 'Brownie con Helado', 'Brownie caliente con helado de vainilla', 14000, v_postres, 5, true);
END $$;


-- ==================== DESCUENTOS PRECONFIGURADOS ====================
INSERT INTO discounts (name, description, discount_type, value, is_active, requires_authorization) VALUES
  ('Descuento Empleado 10%', 'Descuento para empleados del restaurante', 'PERCENTAGE', 10, true, false),
  ('Descuento Empleado 20%', 'Descuento especial empleados', 'PERCENTAGE', 20, true, true),
  ('Promoción del Día', 'Descuento promocional diario', 'PERCENTAGE', 15, true, false),
  ('Cliente Frecuente', 'Descuento para clientes frecuentes', 'PERCENTAGE', 5, true, false),
  ('Compensación', 'Descuento por compensación de servicio', 'PERCENTAGE', 100, true, true),
  ('Descuento $5.000', 'Descuento fijo de $5.000', 'FIXED', 5000, true, false),
  ('Descuento $10.000', 'Descuento fijo de $10.000', 'FIXED', 10000, true, true),
  ('Cortesía', 'Cortesía de la casa', 'PERCENTAGE', 100, true, true);


-- ==================== INGREDIENTES DE EJEMPLO ====================
INSERT INTO ingredients (name, unit, current_stock, min_stock, cost_per_unit, supplier, category) VALUES
  ('Pollo', 'kg', 25, 10, 12000, 'Proveedor A', 'Carnes'),
  ('Arroz', 'kg', 50, 20, 3500, 'Proveedor B', 'Granos'),
  ('Cebolla', 'kg', 15, 5, 2500, 'Proveedor C', 'Verduras'),
  ('Tomate', 'kg', 10, 5, 3000, 'Proveedor C', 'Verduras'),
  ('Aceite de Cocina', 'l', 20, 10, 8000, 'Proveedor D', 'Condimentos'),
  ('Sal', 'kg', 5, 2, 1500, 'Proveedor D', 'Condimentos'),
  ('Ajo', 'kg', 3, 1, 15000, 'Proveedor C', 'Condimentos'),
  ('Leche', 'l', 30, 15, 3800, 'Proveedor E', 'Lácteos'),
  ('Huevos', 'unidad', 120, 60, 500, 'Proveedor E', 'Lácteos'),
  ('Carne de Res', 'kg', 15, 8, 25000, 'Proveedor A', 'Carnes'),
  ('Cerdo', 'kg', 12, 6, 18000, 'Proveedor A', 'Carnes'),
  ('Papa', 'kg', 30, 15, 2000, 'Proveedor C', 'Verduras'),
  ('Camarones', 'kg', 8, 4, 35000, 'Proveedor F', 'Mariscos'),
  ('Pasta/Tallarines', 'kg', 20, 10, 4000, 'Proveedor B', 'Granos'),
  ('Salsa de Soya', 'l', 10, 5, 12000, 'Proveedor G', 'Condimentos');


-- ==================== CONFIGURACIÓN INICIAL ====================
INSERT INTO settings (key, value) VALUES
  ('restaurant_name', 'Sistema de Comandas - DEMO'),
  ('tax_rate', '0.08'),
  ('currency', 'COP'),
  ('timezone', 'America/Bogota')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ############################################################
-- VERIFICACIÓN FINAL
-- ############################################################

SELECT '✅ Base de datos DEMO creada exitosamente' AS mensaje;
SELECT 'Usuarios: ' || COUNT(*) FROM users;
SELECT 'Categorías: ' || COUNT(*) FROM categories;
SELECT 'Productos: ' || COUNT(*) FROM products;
SELECT 'Mesas: ' || COUNT(*) FROM tables;
SELECT 'Áreas: ' || COUNT(*) FROM areas;
SELECT 'Descuentos: ' || COUNT(*) FROM discounts;
SELECT 'Ingredientes: ' || COUNT(*) FROM ingredients;

-- ============================================================
-- CREDENCIALES DE ACCESO DEMO:
-- ============================================================
-- ADMIN:    admin@demo.com    / admin123
-- CAJERO:   cajero@demo.com   / cajero123
-- MESERO:   mesero@demo.com   / mesero123
-- COCINA:   cocina@demo.com   / cocina123
-- ============================================================
