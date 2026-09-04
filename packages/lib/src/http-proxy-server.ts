import net from 'node:net'
import { EventEmitter } from 'node:events'
import { styleText } from 'node:util'
import { nanoid } from 'nanoid'
import { TunnelConfig } from './tunnel-config'

type HTTPProxyServerOptions = {
  port: number
  tunnelConfig: TunnelConfig
}

type ProxyMapWithKey = ReturnType<TunnelConfig['findByServerHost']>

type TCPConnectionPoolData = {
  socket: net.Socket
  proxyMapWithKey: ProxyMapWithKey
}

// 启动唯一的 tcp 端口，去代理所有域名的 http 流量，这样方便在 docker 中运行
export class HTTPProxyServer extends EventEmitter<{
  connect: [string, ProxyMapWithKey, net.Socket]
  data: [string, ProxyMapWithKey, Buffer]
  close: [string, ProxyMapWithKey]
}> {
  port: number
  tunnelConfig: TunnelConfig

  private _tcpConnectionPool: Map<string, TCPConnectionPoolData>

  constructor({ port, tunnelConfig }: HTTPProxyServerOptions) {
    super()
    this.port = port
    this.tunnelConfig = tunnelConfig
    this._tcpConnectionPool = new Map()

    this.start()
  }

  start() {
    const server = net.createServer(socket => {
      const sign = nanoid(10)
      const poolData: TCPConnectionPoolData = {
        socket,
        proxyMapWithKey: undefined
      }
      this._tcpConnectionPool.set(sign, poolData)

      socket.on('data', chunk => {
        // 没有说明是刚开始连接，还没分配好代理映射
        if (!poolData.proxyMapWithKey) {
          const chunkStr = chunk.toString()
          const chunkArr = chunkStr.split('\r\n')
          const httpMethod = chunkArr[0]
          const headers = chunkArr.slice(1)
          for (let i = 0; i < headers.length; i++) {
            const header = headers[i]
            // 根据 http 头找出域名
            if (header.startsWith('Host: ')) {
              const host = header.substring(6)
              console.log(
                styleText('green', 'HTTPProxyServer:'),
                styleText('cyanBright', host),
                styleText('yellow', httpMethod)
              )
              const proxyMapWithKey = this.tunnelConfig.findByServerHost(host)
              if (proxyMapWithKey) {
                poolData.proxyMapWithKey = proxyMapWithKey
                this.emit('connect', sign, proxyMapWithKey, socket)
                break
              } else {
                // 找不到映射直接断开连接
                this.destroy(sign)
              }
            }
          }
        }

        this.emit('data', sign, poolData.proxyMapWithKey, chunk)
      })
      socket.on('close', () => {
        this._tcpConnectionPool.delete(sign)
        this.emit('close', sign, poolData.proxyMapWithKey)
      })
      socket.on('error', err => {
        console.log(sign, err)
      })
    })

    server.listen(this.port, () => {
      console.log(
        styleText('green', 'HTTPProxyServer'),
        styleText('yellow', 'has started at port:'),
        styleText('cyanBright', `${this.port}`)
      )
    })
  }

  stream(sign: string, buffer: Uint8Array | string) {
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
