/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ffsjeffe/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ffsjeffe',
        short_name: 'ffsjeffe',
        description: 'Weekmenu en boodschappen',
        lang: 'nl',
        display: 'standalone',
        start_url: '/ffsjeffe/',
        scope: '/ffsjeffe/',
        background_color: '#f6f4ef',
        theme_color: '#2f6b4f',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
  test: { environment: 'jsdom' },
})
