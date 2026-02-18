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
      // Map environment variables to Vite-exposed keys
      // Auth0 removed - using invite-only architecture with Cosmos DB
    },
  }
})
