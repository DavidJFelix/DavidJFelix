import vue from '@vitejs/plugin-vue'
import {defineConfig} from 'vite'

const config = defineConfig({
  resolve: {tsconfigPaths: true},
  plugins: [vue()],
})

export default config
