import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.ADMIN_SERVER_URL
      }
    }
  }
})
