-- Ejecuta este script en Supabase: panel del proyecto > SQL Editor > New query > pega y ejecuta.

create extension if not exists "pgcrypto";

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  qty integer not null default 0,
  min integer not null default 0,
  price numeric not null default 0,
  supplier text,
  barcode text,
  created_at timestamptz default now()
);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  type text not null check (type in ('in','out')),
  qty integer not null,
  note text,
  created_at timestamptz default now()
);

-- Row Level Security: habilitado, con una politica abierta para empezar.
-- Esto es aceptable para una app interna de un solo negocio con la URL privada,
-- pero si mas adelante agregas usuarios/login, cambia estas politicas para
-- que solo el usuario autenticado pueda leer y escribir sus propios datos.
alter table categories enable row level security;
alter table products enable row level security;
alter table movements enable row level security;

create policy "allow all categories" on categories for all using (true) with check (true);
create policy "allow all products" on products for all using (true) with check (true);
create policy "allow all movements" on movements for all using (true) with check (true);
