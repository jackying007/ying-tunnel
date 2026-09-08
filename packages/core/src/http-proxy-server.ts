import net from 'node:net'
import { EventEmitter } from 'node:events'
import { styleText } from 'node:util'
import { randomKey } from './random-key'

type TCPConnectionPoolData = {
  socket: net.Socket
  host?: string
}

// 启动唯一的 tcp 端口，去代理所有域名的 http 流量，这样方便在 docker 中运行
export class HTTPProxyServer extends EventEmitter<{
  connect: [string, string]
  data: [string, string | undefined, Buffer]
  close: [string, string | undefined]
}> {
  private _tcpConnectionPool: Map<string, TCPConnectionPoolData> = new Map()

  constructor(port: number) {
    super()
    this.setup(port)
  }

  setup(port: number) {
    const server = net.createServer(socket => {
      const sign = randomKey(10)
      const poolData: TCPConnectionPoolData = {
        socket
      }
      this._tcpConnectionPool.set(sign, poolData)

      socket.on('data', chunk => {
        // 没有说明是刚开始连接，还没确定好 host
        if (!poolData.host) {
          const chunkStr = chunk.toString()
          const chunkArr = chunkStr.split('\r\n')
          const httpMethod = chunkArr[0]
          const headers = chunkArr.slice(1)
          for (let i = 0; i < headers.length; i++) {
            const header = headers[i]
            // 根据 http 头找出域名
            if (!header.startsWith('Host: ')) continue
            const host = header.substring(6)
            console.log(
              styleText('green', 'HTTPProxyServer:'),
              styleText('cyanBright', host),
              styleText('yellow', httpMethod)
            )
            poolData.host = host
            this.emit('connect', sign, host)
            break
          }
        }
        this.emit('data', sign, poolData.host, chunk)
      })
      socket.on('close', () => {
        this._tcpConnectionPool.delete(sign)
        this.emit('close', sign, poolData.host)
      })
      socket.on('error', err => {
        console.log(sign, err)
      })
    })

    server.listen(port, () => {
      console.log(
        styleText('green', 'HTTPProxyServer'),
        styleText('yellow', 'has started at:'),
        styleText('cyanBright', `tcp://localhost:${port}`)
      )
    })
  }

  write(sign: string, buffer: Uint8Array | string) {
    const socket = this._tcpConnectionPool.get(sign)?.socket
    if (!socket) return

    socket.write(buffer)
  }

  destroy(sign: string) {
    const socket = this._tcpConnectionPool.get(sign)?.socket
    if (!socket) return

    socket.destroy()
  }
}
