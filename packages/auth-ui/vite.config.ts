import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [vue(), dts({ entryRoot: 'src' })],
  build: {
    emptyOutDir: false,
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts') },
      formats: ['es'],
      fileName: (_, name) => `${name}.js`,
    },
    rollupOptions: {
      external: [
        'vue',
        'nuxt/app',
        '@vueuse/core',
        '@function-bucket/fnb-graphql-client-api',
      ],
    },
    minify: false,
  },
})
