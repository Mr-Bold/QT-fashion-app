import { preview } from 'vite'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PORT ?? 10000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`)
}

const server = await preview({
  configFile: fileURLToPath(new URL('../frontend/vite.config.ts', import.meta.url)),
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
})

server.printUrls()
