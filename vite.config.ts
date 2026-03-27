import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config(); // ✅ garante leitura do .env mesmo fora da raiz

// Config global do Vite (único export)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // 🔹 Supabase vars
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_KEY': JSON.stringify(process.env.VITE_SUPABASE_KEY || env.VITE_SUPABASE_KEY),
      // 🔹 Gemini vars
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist'],
      esbuildOptions: {
        supported: {
          'top-level-await': true,
        },
      },
    },
    build: {
      target: 'esnext',
    },
  };
});
