import { createClient } from '@supabase/supabase-js';

// 🔒 Carrega variáveis do .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY!;

// ✅ Mantém apenas UMA exportação
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true, // mantém login entre recarregamentos (opcional)
    detectSessionInUrl: true,
  },
});
