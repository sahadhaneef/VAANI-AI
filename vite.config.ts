import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { ttsPlugin } from './server/ttsPlugin.ts'
import { sttPlugin } from './server/sttPlugin.ts'
import { aiPlugin } from './server/aiPlugin.ts'
import { dbPlugin } from './server/dbPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ttsPlugin(), sttPlugin(), dbPlugin(), aiPlugin()],
})
