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
  quantity: number;
  link: string;
  email: string;
  phone: string | null;
  amount_clp: number;
  discount_clp: number;
  coupon_code: string | null;
  cost_usd: number;
  status: OrderStatus;
  payment_status: "pending" | "paid" | "failed";
  payment_provider: string;
  payment_ref: string | null;
  payment_token: string | null;
  provider_order_id: number | null;
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
