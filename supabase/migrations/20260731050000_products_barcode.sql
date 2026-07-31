alter table public.products add column if not exists barcode text;
create index if not exists idx_products_barcode on public.products(tenant_id, barcode);
