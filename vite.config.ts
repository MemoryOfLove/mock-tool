import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync, mkdirSync, existsSync, cpSync } from 'fs'

const __dirname = import.meta.dirname

function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    writeBundle() {
      const distDir = resolve(__dirname, 'dist')
      copyFileSync(resolve(__dirname, 'manifest.dist.json'), resolve(distDir, 'manifest.json'))
      const iconsDir = resolve(distDir, 'icons')
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })
      cpSync(resolve(__dirname, 'public/icons'), iconsDir, { recursive: true })
    },
  }
}

function makeScriptConfig(entry: string, name: string, fileName: string): UserConfig {
  return {
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, entry),
        name,
        formats: ['iife'],
        fileName: () => fileName,
      },
      rollupOptions: { output: { extend: true } },
    },
  }
}

const target = process.env.BUILD_TARGET

const configs: Record<string, UserConfig> = {
  'service-worker': makeScriptConfig('src/background/service-worker.ts', 'ServiceWorker', 'service-worker.js'),
  'content-script': makeScriptConfig('src/content/content-script.ts', 'ContentScript', 'content-script.js'),
  injected: makeScriptConfig('src/injected/index.ts', 'MockToolInjected', 'injected.js'),
}

const config: UserConfig = target && configs[target]
  ? configs[target]
  : {
      base: './',
      plugins: [react(), tailwindcss(), copyAssetsPlugin()],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
          input: {
            popup: resolve(__dirname, 'src/popup/index.html'),
            options: resolve(__dirname, 'src/options/index.html'),
          },
        },
      },
    }

export default defineConfig(config)
