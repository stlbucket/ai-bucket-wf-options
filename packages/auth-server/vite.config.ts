import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ entryRoot: 'src' })],
  build: {
    emptyOutDir: false,
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts') },
      formats: ['es'],
      fileName: (_, name) => `${name}.js`,
    },
    rollupOptions: {
      external: ['pg'],
    },
    minify: false,
  },
})
