import { defineConfig, ConfigEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { execSync } from 'child_process'

// https://vite.dev/config/
export default ({ mode }: ConfigEnv) => {
  if (process.env.VERCEL_GIT_COMMIT_REF) {
    process.env.VITE_GIT_BRANCH_NAME = process.env.VERCEL_GIT_COMMIT_REF
  } else {
    try {
      process.env.VITE_GIT_BRANCH_NAME = execSync('git rev-parse --abbrev-ref HEAD').toString().trimEnd()
    } catch (error) {
      //ignore error
    }
  }

  return defineConfig({
    plugins: [react(), tailwindcss()],
    define: {
      'process.env': process.env,
      global: 'globalThis',
    },
    resolve: {
      alias: {
        buffer: 'buffer',
        process: 'process/browser',
        util: 'util',
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
          },
        },
      },
    },
    optimizeDeps: {
      include: ['buffer', 'process'],
    },
  })
}
