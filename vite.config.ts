import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Casae Ops',
        short_name: 'Casae',
        description: 'Casae Living internal operations',
        theme_color: '#2C3E4A',
        background_color: '#F5F3EE',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only — Supabase data/storage stays network-only so the
        // ops numbers are never stale.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // /.netlify covers the Xero OAuth redirect through xero-auth — the
        // service worker must not serve index.html for function navigations.
        navigateFallbackDenylist: [/^\/api/, /^\/\.netlify/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
