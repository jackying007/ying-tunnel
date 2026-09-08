import path from 'node:path'
import { Hono } from 'hono'
import { serve, upgradeWebSocket } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { WebSocketServer } from 'ws'

const app = new Hono()

app.use(
  '/*',
  serveStatic({
    root: path.join(process.cwd(), 'public')
  })
)

app.get(
  '/ws',
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      console.log('WebSocket connected')
    },

    onMessage(event, ws) {
      console.log(event.data.toString())

      ws.send('hi from server')
    },

    onClose() {
      console.log('WebSocket disconnected')
    },

    onError(error) {
      console.error('WebSocket error:', error)
    }
  }))
)

app.get('/api/test', c => {
  return c.text('哇咔咔')
})

app.post('/api/test', async ({ req, json }) => {
  const body = await req.json()
  console.log(body)
  return json(body)
})

const wss = new WebSocketServer({
  noServer: true
})

serve(
  {
    fetch: app.fetch,
    hostname: '0.0.0.0',
    port: 6263,
    websocket: {
      server: wss
    }
  },
  info => {
    console.log('测试服务已启动:', `http://127.0.0.1:${info.port}`)
  }
)
