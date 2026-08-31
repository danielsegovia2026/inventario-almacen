# Control de almacen

App de inventario (productos, categorias, entradas/salidas, escaneo de codigo de barras con la camara) lista para desplegar en Netlify con Supabase como base de datos.

## 1. Crear la base de datos en Supabase

1. Entra a https://supabase.com y crea una cuenta / proyecto nuevo (el plan gratis alcanza para esto).
2. En el panel del proyecto ve a **SQL Editor > New query**.
3. Copia y pega todo el contenido de `supabase-schema.sql` y dale **Run**. Esto crea las tablas `categories`, `products` y `movements`.
4. Ve a **Project Settings > API**. Copia:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public key**

## 2. Probar localmente (opcional)

```bash
npm install
cp .env.example .env
# pega tu URL y anon key en el archivo .env
npm run dev
```

Abre la direccion que te muestre la terminal (normalmente `http://localhost:5173`).

## 3. Desplegar en Netlify

**Opcion A: subiendo el codigo a GitHub (recomendado)**

1. Sube esta carpeta a un repositorio de GitHub.
2. En Netlify: **Add new site > Import an existing project** y conecta el repositorio.
3. Netlify detecta `netlify.toml` automaticamente (build command `npm run build`, carpeta `dist`).
4. Antes de darle deploy, ve a **Site configuration > Environment variables** y agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Dale **Deploy site**.

**Opcion B: arrastrar y soltar (mas rapido, sin GitHub)**

1. En tu computadora corre: `npm install` y luego `npm run build`. Esto genera una carpeta `dist`.
2. Ve a https://app.netlify.com/drop y arrastra la carpeta `dist`.
3. Nota: con este metodo las variables de entorno deben quedar puestas en el `.env` ANTES de correr `npm run build`, porque Netlify Drop no permite configurarlas despues (si luego cambias de proveedor de base de datos, vuelve a compilar).

## 4. Usar la app desde el celular (para escanear codigos de barras)

Una vez desplegada, abre la URL de Netlify desde Chrome en tu celular. Al tocar "Escanear" te va a pedir permiso de camara — acepta, y apunta al codigo de barras del producto.

## Seguridad (importante para cuando crezca el negocio)

Las tablas se crean con una politica de acceso abierta (cualquiera con la URL puede leer y escribir) para que puedas empezar rapido. Si vas a compartir la URL con empleados o vas a hacerla publica, lo recomendable es agregar autenticacion de Supabase (email/contrasena) y ajustar las politicas de Row Level Security para que solo usuarios logueados puedan usar la app. Puedo ayudarte con eso cuando lo necesites.
