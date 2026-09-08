import path from 'node:path'
import { styleText } from 'node:util'
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { randomKey, TunnelConfig } from '@ying-tunnel/core'

const AdminPassword = process.env.ADMIN_PASSWORD

const adminSessionMap = new Map<string, Date>()

const expireTime = 24 * 60 * 60 * 1000

function checkSessionMap() {
  for (const [session, time] of adminSessionMap) {
    if (Date.now() - time.getTime() > expireTime) {
      adminSessionMap.delete(session)
    }
  }
}

setInterval(checkSessionMap, 60 * 1000)

function checkSession(session: string) {
  const time = adminSessionMap.get(session)
  if (time && Date.now() - time.getTime() < expireTime) {
    return true
  }

  return false
}

export function adminApiBoostrap(
  tunnelConfig: TunnelConfig,
  tunnelServerHost: string,
  tunnelServerPort: number
) {
  const app = new Hono()

  const protectRoutes = ['/api/tunnel-info', '/api/tunnel']
  app.use('*', async ({ req, json }, next) => {
    const path = req.path
    if (protectRoutes.some(url => path.startsWith(url))) {
      const session = req.header('session')
      if (!session || !checkSession(session)) {
        return json(
          {
            message: '无授权'
          },
          401
        )
      }
    }
    await next()
  })

  app.post(
    '/api/login',
    zValidator('json', z.object({ password: z.string() })),
    ({ req, json }) => {
      const { password } = req.valid('json')

      if (password === AdminPassword) {
        const session = randomKey()
        adminSessionMap.set(session, new Date())
        return json({ session })
      }

      return json({ message: '密码错误' }, 500)
    }
  )

  app.get('/api/tunnel-info', ({ json }) => {
    return json({
      tunnelServerHost,
      tunnelServerPort,
      tunnelList: tunnelConfig.getTunnelList()
    })
  })

  const proxyMapSchema = z.object({
    serverHost: z.string(),
    localHost: z.string()
  })

  const tunnelSchema = z.array(proxyMapSchema).min(1)

  // 新增
  app.post('/api/tunnel', zValidator('json', tunnelSchema), ({ req, json }) => {
    const body = req.valid('json')
    tunnelConfig.set(randomKey(), body)
    return json({
      message: '操作成功'
    })
  })

  const patchSchema = z.object({ key: z.string() })

  // 修改
  app.post(
    '/api/tunnel/:key',
    zValidator('param', patchSchema),
    zValidator('json', tunnelSchema),
    ({ req, json }) => {
      const { key } = req.valid('param')
      const body = req.valid('json')

      tunnelConfig.set(key, body)

      return json({
        message: '操作成功'
      })
    }
  )

  // 删除
  app.delete(
    '/api/tunnel/:key',
    zValidator('param', patchSchema),
    ({ req, json }) => {
      const { key } = req.valid('param')
      tunnelConfig.del(key)
      return json({
        message: '删除成功'
      })
    }
  )

  app.use(
    '/*',
    serveStatic({
      root: path.join(process.cwd(), 'static')
    })
  )

  serve(
    {
      fetch: app.fetch,
      port: Number(process.env.ADMIN_API_PORT || 5859)
    },
    info => {
      console.log(
        styleText('green', 'AdminServerAPI'),
        styleText('yellow', 'has started at'),
        styleText('cyanBright', `http://localhost:${info.port}`)
      )
    }
  )
}
