import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load .env from project root
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')

  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, '..'),
    define: {
      // Map root Auth0 variables to Vite-exposed keys
      'import.meta.env.VITE_AUTH0_DOMAIN': JSON.stringify(env.AUTH0_DOMAIN || ''),
      'import.meta.env.VITE_AUTH0_CLIENT_ID': JSON.stringify(env.AUTH0_CLIENT_ID || ''),
      'import.meta.env.VITE_AUTH0_AUDIENCE': JSON.stringify(env.AUTH0_AUDIENCE || ''),
    },
  }
})
