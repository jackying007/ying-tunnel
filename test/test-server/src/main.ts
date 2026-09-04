import path from 'node:path'
import fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'

const app = fastify()

// 测试 websocket 的转发
app.register(websocket)
app.register(async function (fastify) {
  fastify.get(
    '/ws',
    { websocket: true },
    (socket /* WebSocket */, req /* FastifyRequest */) => {
      socket.on('message', message => {
        // message.toString() === 'hi from client'
        console.log(message.toString())
        socket.send('hi from server')
      })
    }
  )
})

// 测试文件的转发
app.register(fastifyStatic, {
  prefix: '/',
  root: path.join(process.cwd(), 'public')
})

// 测试正常api的转发
app.get('/api/test', function (request, reply) {
  reply.send('哇咔咔')
})

app.post('/api/test', function (request, reply) {
  console.log(JSON.parse(request.body as string))
  reply.send(request.body)
})

app.listen({ port: 6263 }, err => {
  if (err) throw err
  console.log('测试服务已启动:', `http://127.0.0.1:6263`)
})
