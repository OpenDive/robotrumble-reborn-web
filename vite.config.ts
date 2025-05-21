import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import glsl from 'vite-plugin-glsl'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    glsl({
      include: [
        '**/*.vert',
        '**/*.frag',
        '**/*.glsl',
      ],
      exclude: 'node_modules/**',
      warnDuplicatedImports: true,
      defaultExtension: 'glsl',
    })
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss,
        autoprefixer,
      ],
    },
  },
  assetsInclude: ['**/*.vert', '**/*.frag', '**/*.glsl'],
})
