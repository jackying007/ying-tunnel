import path from 'node:path'
import { styleText } from 'node:util'
import fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { randomKey, TunnelConfig, ProxyMap } from '@ying-tunnel/core'

const AdminServerPort = Number(process.env.ADMIN_API_PORT || 5859)
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
  const app = fastify()

  app.register(fastifyStatic, {
    prefix: '/',
    root: path.join(process.cwd(), 'static')
  })

  const protectRoutes = ['/api/tunnel-info', '/api/tunnel']
  app.addHook('onRequest', (request, reply, done) => {
    const session = request.headers['session'] as string | undefined

    if (protectRoutes.some(url => request.url.startsWith(url))) {
      if (!session || !checkSession(session)) {
        reply.code(401).send({ message: '无授权' })
        return
      }
    }
    done()
  })

  app.post<{
    Body: {
      password: string
    }
  }>(
    '/api/login',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            password: { type: 'string' }
          },
          required: ['password']
        }
      }
    },
    function (request, reply) {
      const { password } = request.body

      if (password === AdminPassword) {
        const session = randomKey()
        adminSessionMap.set(session, new Date())
        return { session }
      }

      reply.code(500).send({ message: '密码错误' })
    }
  )

  app.get('/api/tunnel-info', function () {
    return {
      tunnelServerHost,
      tunnelServerPort,
      tunnelList: tunnelConfig.getTunnelList()
    }
  })

  // 新增
  app.post<{
    Body: ProxyMap[]
  }>(
    '/api/tunnel',
    {
      schema: {
        body: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serverHost: { type: 'string' },
              localHost: { type: 'string' }
            },
            required: ['serverHost', 'localHost']
          },
          minItems: 1
        }
      }
    },
    function (request, reply) {
      tunnelConfig.set(randomKey(), request.body)

      return {
        message: '操作成功'
      }
    }
  )

  // 保存
  app.post<{
    Body: ProxyMap[]
    Params: {
      key: string
    }
  }>(
    '/api/tunnel/:key',
    {
      schema: {
        body: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serverHost: { type: 'string' },
              localHost: { type: 'string' }
            },
            required: ['serverHost', 'localHost']
          },
          minItems: 1
        }
      }
    },
    function (request, reply) {
      tunnelConfig.set(request.params.key, request.body)

      return {
        message: '操作成功'
      }
    }
  )

  // 删除
  app.delete<{
    Params: {
      key: string
    }
  }>('/api/tunnel/:key', function (request, reply) {
    tunnelConfig.del(request.params.key)

    return {
      message: '删除成功'
    }
  })

  app.listen({ port: AdminServerPort }, err => {
    if (err) throw err
    console.log(
      styleText('green', 'AdminServerAPI'),
      styleText('yellow', 'has started at'),
      styleText('cyanBright', `http://localhost:${AdminServerPort}`)
    )
  })
}
