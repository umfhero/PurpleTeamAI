import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'

// Copy preload.cjs to dist-electron (pure CommonJS, no transpilation needed)
function copyPreload() {
  const src = path.resolve(__dirname, 'electron/preload.cjs')
  const destDir = path.resolve(__dirname, 'dist-electron')
  const dest = path.resolve(destDir, 'preload.cjs')
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true })
  }
  copyFileSync(src, dest)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process entry
        entry: 'electron/main.ts',
        onstart(args) {
          copyPreload() // Copy preload before starting
          args.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
