PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Ajustes globales de la tienda (margen, tipo de cambio, textos SEO, claves...)
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Espejo del catálogo del proveedor (honestsmm). Se refresca con "Sincronizar".
CREATE TABLE IF NOT EXISTS provider_services (
  service_id           INTEGER PRIMARY KEY,
  name                 TEXT    NOT NULL,
  clean_name           TEXT    NOT NULL,
  category             TEXT    NOT NULL,
  platform             TEXT    NOT NULL,
  service_type         TEXT    NOT NULL,
  rate_usd_per_1000    REAL    NOT NULL,
  min_qty              INTEGER NOT NULL DEFAULT 1,
  max_qty              INTEGER NOT NULL DEFAULT 10000,
  avg_minutes          INTEGER,
  refill               INTEGER NOT NULL DEFAULT 0,
  cancel               INTEGER NOT NULL DEFAULT 0,
  provider_description TEXT,
  provider_enabled     INTEGER NOT NULL DEFAULT 1,
  last_provider_update TEXT,
  synced_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ps_platform ON provider_services(platform, service_type);
CREATE INDEX IF NOT EXISTS idx_ps_enabled  ON provider_services(provider_enabled);
CREATE INDEX IF NOT EXISTS idx_ps_rate     ON provider_services(rate_usd_per_1000);

-- Productos publicados en la tienda. Uno apunta a un servicio del proveedor.
CREATE TABLE IF NOT EXISTS products (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                TEXT    NOT NULL UNIQUE,
  name                TEXT    NOT NULL,
  platform            TEXT    NOT NULL,
  service_type        TEXT    NOT NULL,
  provider_service_id INTEGER NOT NULL REFERENCES provider_services(service_id),

  short_description   TEXT    NOT NULL DEFAULT '',
  description_html    TEXT    NOT NULL DEFAULT '',
  bullets_json        TEXT    NOT NULL DEFAULT '[]',
  faq_json            TEXT    NOT NULL DEFAULT '[]',

  -- SEO por producto
  seo_title           TEXT,
  seo_description     TEXT,
  seo_keywords        TEXT,
  og_image            TEXT,
  noindex             INTEGER NOT NULL DEFAULT 0,

  image_url           TEXT,
  badge               TEXT,

  price_mode          TEXT    NOT NULL DEFAULT 'auto',   -- auto | manual
  margin_override     REAL,                              -- % que reemplaza al margen global

  min_qty             INTEGER NOT NULL DEFAULT 100,
  max_qty             INTEGER NOT NULL DEFAULT 10000,

  link_label          TEXT    NOT NULL DEFAULT 'Enlace o usuario',
  link_placeholder    TEXT    NOT NULL DEFAULT 'https://...',
  link_help           TEXT    NOT NULL DEFAULT 'Tu perfil debe ser público al momento de la entrega.',

  delivery_label      TEXT    NOT NULL DEFAULT 'Inicio inmediato',
  quality_label       TEXT    NOT NULL DEFAULT 'Alta calidad',
  refill_days         INTEGER NOT NULL DEFAULT 0,
  guarantee_text      TEXT,

  featured            INTEGER NOT NULL DEFAULT 0,
  published           INTEGER NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 100,

  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_pub  ON products(published, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_plat ON products(platform, published);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(platform, service_type, published);

-- Packs de cantidad que ve el cliente (100, 250, 500, 1000...).
CREATE TABLE IF NOT EXISTS product_tiers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER NOT NULL,
  price_clp   INTEGER,          -- NULL = precio calculado automáticamente
  popular     INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tiers_product ON product_tiers(product_id, sort_order);

-- Pedidos de la tienda.
CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  code                TEXT    NOT NULL UNIQUE,
  product_id          INTEGER REFERENCES products(id),
  product_name        TEXT    NOT NULL,
  provider_service_id INTEGER NOT NULL,
  quantity            INTEGER NOT NULL,
  link                TEXT    NOT NULL,
  email               TEXT    NOT NULL,
  phone               TEXT,

  amount_clp          INTEGER NOT NULL,
  discount_clp        INTEGER NOT NULL DEFAULT 0,
  coupon_code         TEXT,
  cost_usd            REAL    NOT NULL DEFAULT 0,

  status              TEXT    NOT NULL DEFAULT 'pending',
  payment_status      TEXT    NOT NULL DEFAULT 'pending',
  payment_provider    TEXT    NOT NULL DEFAULT 'flow',
  payment_ref         TEXT,
  payment_token       TEXT,

  provider_order_id   INTEGER,
  provider_status     TEXT,
  start_count         INTEGER,
  remains             INTEGER,
  provider_error      TEXT,

  admin_note          TEXT,
  ip                  TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  paid_at             TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_token   ON orders(payment_token);
CREATE INDEX IF NOT EXISTS idx_orders_email   ON orders(email);

CREATE TABLE IF NOT EXISTS order_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id, id DESC);

CREATE TABLE IF NOT EXISTS coupons (
  code        TEXT PRIMARY KEY,
  kind        TEXT    NOT NULL DEFAULT 'percent',  -- percent | fixed
  value       REAL    NOT NULL,
  min_clp     INTEGER NOT NULL DEFAULT 0,
  max_uses    INTEGER NOT NULL DEFAULT 0,          -- 0 = ilimitado
  used        INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  expires_at  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  filename   TEXT NOT NULL UNIQUE,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON admin_sessions(expires_at);
