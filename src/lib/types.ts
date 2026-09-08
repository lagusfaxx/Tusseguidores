export type ProviderService = {
  service_id: number;
  name: string;
  clean_name: string;
  category: string;
  platform: string;
  service_type: string;
  rate_usd_per_1000: number;
  min_qty: number;
  max_qty: number;
  avg_minutes: number | null;
  refill: number;
  cancel: number;
  provider_description: string | null;
  refill_days: number;
  /** Minutos que promete el nombre para empezar. Null = no dice nada. */
  start_minutes: number | null;
  drop_score: number;
  speed_score: number;
  geo: string;
  variant: string;
  order_kind: string;
  provider_enabled: number;
  last_provider_update: string | null;
  synced_at: string;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  platform: string;
  service_type: string;
  provider_service_id: number;
  short_description: string;
  description_html: string;
  bullets_json: string;
  faq_json: string;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  og_image: string | null;
  noindex: number;
  image_url: string | null;
  badge: string | null;
  price_mode: "auto" | "manual";
  margin_override: number | null;
  /** Nivel de calidad dentro de la combinación: economico | estandar | premium. */
  level: string;
  /** 1 = lo mantiene al día el generador automático de niveles. */
  auto_managed: number;
  auto_select: number;
  max_cost_ratio: number;
  min_qty: number;
  max_qty: number;
  link_label: string;
  link_placeholder: string;
  link_help: string;
  delivery_label: string;
  quality_label: string;
  refill_days: number;
  guarantee_text: string | null;
  featured: number;
  published: number;
  sort_order: number;
  /** Calificación propia del producto. 0 = usa la calificación de la tienda. */
  rating_value: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
};

/** Una publicación (o el perfil) a la que va una parte del pedido. */
export type OrderTarget = {
  id: number;
  order_id: number;
  position: number;
  link: string;
  quantity: number;
  comments: string | null;
  provider_service_id: number | null;
  provider_order_id: number | null;
  provider_status: string | null;
  provider_error: string | null;
  start_count: number | null;
  remains: number | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

export type Tier = {
  id: number;
  product_id: number;
  quantity: number;
  price_clp: number | null;
  popular: number;
  sort_order: number;
};

export type PricedTier = {
  id: number;
  quantity: number;
  priceClp: number;
  unitClp: number;
  popular: boolean;
  manual: boolean;
};

export type Order = {
  id: number;
  code: string;
  product_id: number | null;
  product_name: string;
  provider_service_id: number;
  reference_service_id: number | null;
  quantity: number;
  link: string;
  comments: string | null;
  email: string;
  phone: string | null;
  amount_clp: number;
  discount_clp: number;
  coupon_code: string | null;
  cost_usd: number;
  status: OrderStatus;
  payment_status: "pending" | "paid" | "failed";
  payment_provider: "flow" | "transferencia" | string;
  transfer_notified_at: string | null;
  transfer_reference: string | null;
  payment_ref: string | null;
  payment_token: string | null;
  provider_order_id: number | null;
  /** Fecha en que lo marcaste como despachado a mano, fuera del panel. */
  manual_dispatch_at: string | null;
  /** Cliente del panel SMM que lo pidió con su saldo. Null = venta de la tienda. */
  reseller_user_id: number | null;
  provider_status: string | null;
  start_count: number | null;
  remains: number | null;
  provider_error: string | null;
  admin_note: string | null;
  ip: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

export type OrderStatus =
  | "pending"      // esperando pago
  | "paid"         // pagado, aún no enviado al proveedor
  | "processing"   // enviado al proveedor
  | "completed"
  | "partial"
  | "canceled"
  | "failed"
  | "refunded";

export type FaqItem = { q: string; a: string };

// ------------------------------------------------------------------ panel SMM

export type ResellerUser = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  balance_clp: number;
  discount_percent: number;
  status: "active" | "blocked" | string;
  admin_note: string | null;
  created_at: string;
  last_login_at: string | null;
};

export type WalletEntry = {
  id: number;
  user_id: number;
  kind: "recarga" | "pedido" | "reembolso" | "ajuste" | string;
  amount_clp: number;
  balance_after: number;
  order_id: number | null;
  topup_id: number | null;
  note: string;
  created_at: string;
};

export type Topup = {
  id: number;
  code: string;
  user_id: number;
  amount_clp: number;
  method: "flow" | "transferencia" | string;
  status: "pending" | "paid" | "rejected" | string;
  payment_token: string | null;
  payment_ref: string | null;
  transfer_reference: string | null;
  notified_at: string | null;
  created_at: string;
  paid_at: string | null;
};

export type Ticket = {
  id: number;
  code: string;
  /** Mayorista con cuenta, o null si lo abrió un cliente de la tienda. */
  user_id: number | null;
  /** Correo del cliente sin cuenta. */
  guest_email: string | null;
  order_id: number | null;
  subject: string;
  kind: "consulta" | "problema" | "reposicion" | string;
  status: "abierto" | "respondido" | "cerrado" | string;
  created_at: string;
  updated_at: string;
};

export type TicketMessage = {
  id: number;
  ticket_id: number;
  author: "cliente" | "admin" | string;
  body: string;
  created_at: string;
};
