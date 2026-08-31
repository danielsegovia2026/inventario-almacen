import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn(
    "Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env o la configuracion de Netlify."
  );
}

// Si faltan las variables, usamos valores de relleno para que createClient no truene
// al cargar la app. Las llamadas a la base de datos fallaran despues de forma controlada
// y la app muestra una pantalla explicando que falta configurar Supabase, en vez de
// quedarse en pantalla negra.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);
