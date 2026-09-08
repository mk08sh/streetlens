import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// BASE_PATH is only needed when hosting under a sub-path; Vercel and local dev serve from /.
export default defineConfig({ plugins: [react()], base: process.env.BASE_PATH ?? '/' })
