import net from 'node:net'
import { EventEmitter } from 'node:events'
import { nanoid } from 'nanoid'
import { TunnelConfig } from './tunnel-config'

type ProxyServerOptions = {
  port: number
  tunnelConfig: TunnelConfig
}

type ReqConnectionPoolData = {
  connectInfo: ReturnType<TunnelConfig['findByServerHost']>
  socket: net.Socket
}

export class ProxyServer extends EventEmitter<{
  connect: [string, ReqConnectionPoolData['connectInfo'], net.Socket]
  data: [string, ReqConnectionPoolData['connectInfo'], Buffer]
  close: [string, ReqConnectionPoolData['connectInfo']]
}> {
  port: number
  tunnelConfig: TunnelConfig

  private _reqConnectionPool: Map<string, ReqConnectionPoolData>

  constructor({ port, tunnelConfig }: ProxyServerOptions) {
    super()
    this.port = port
    this.tunnelConfig = tunnelConfig
    this._reqConnectionPool = new Map()

    this.start()
  }

  start() {
    const server = net.createServer(socket => {
      const sign = nanoid(10)
      const poolData: ReqConnectionPoolData = {
        connectInfo: undefined,
        socket
      }
      this._reqConnectionPool.set(sign, poolData)

      socket.on('data', chunk => {
        if (!poolData.connectInfo) {
          const chunkStr = chunk.toString()

          const headers = chunkStr.split('\r\n').slice(1)

          for (let i = 0; i < headers.length; i++) {
            const header = headers[i]
            if (header.startsWith('Host: ')) {
              const host = header.substring(6)
              console.log('ProxyServer enter host', host)
              const connectInfo = this.tunnelConfig.findByServerHost(host)

              if (connectInfo) {
                poolData.connectInfo = connectInfo
                this.emit('connect', sign, connectInfo, socket)
                break
              } else {
                this.destroy(sign)
              }
            }
          }
        }

        this.emit('data', sign, poolData.connectInfo, chunk)
      })
      socket.on('close', () => {
        this._reqConnectionPool.delete(sign)
        this.emit('close', sign, poolData.connectInfo)
      })
      socket.on('error', err => {
        console.log(sign, err)
      })
    })

    server.listen(this.port, () => {
      console.log('ProxyServer 已启动在:', `http://127.0.0.1:${this.port}`)
    })
  }

  stream(sign: string, buffer: Uint8Array | string) {
    const socket = this._reqConnectionPool.get(sign)?.socket
    if (!socket) return

    socket.write(buffer)
  }

  destroy(sign: string) {
    const socket = this._reqConnectionPool.get(sign)?.socket
    if (!socket) return

    socket.destroy()
  }
}
