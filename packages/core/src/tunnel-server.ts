import net from 'node:net'
import { EventEmitter } from 'node:events'
import { styleText } from 'node:util'
import { randomKey } from './random-key'
import { TunnelPackage, TunnelPackageType, UnpackData } from './tunnel-package'
import { TunnelConfig } from './tunnel-config'

type TunnelServerOptions = {
  port: number
  tunnelConfig: TunnelConfig
  closeTime?: number
}

type ConnectionPoolData = {
  socket: net.Socket
  overageBuffer?: Buffer // 保存上一次没处理完的 buffer
  destroyTimer?: NodeJS.Timeout // 主动断开连接的定时器
}

type PackData = ReturnType<typeof TunnelPackage.pack>

export class TunnelServer extends EventEmitter<{
  message: [UnpackData]
  socketClose: [net.Socket]
}> {
  port: number
  tunnelConfig: TunnelConfig
  closeTime: number

  private _connectionPool: Map<string, ConnectionPoolData>
  private _server?: net.Server

  constructor({ port, tunnelConfig, closeTime = 5000 }: TunnelServerOptions) {
    super()
    this.port = port
    this.tunnelConfig = tunnelConfig
    this.closeTime = closeTime
    this._connectionPool = new Map()
    this.setup()
  }

  setup() {
    this._server = net.createServer(socket => {
      console.log(
        styleText('green', 'TunnelServer'),
        'a client has connected.'
        // socket.remoteAddress,
        // socket.remoteFamily,
        // socket.remotePort
      )
      const connectionPoolData: ConnectionPoolData = {
        socket
      }
      const initialKey = randomKey()
      this._connectionPool.set(initialKey, connectionPoolData)

      // 一定时间内要带上正确 key，否则断开连接。
      connectionPoolData.destroyTimer = setTimeout(
        () => this.destroySocket(socket),
        this.closeTime
      )

      socket.on('data', chunk => {
        if (connectionPoolData.overageBuffer) {
          chunk = Buffer.concat([connectionPoolData.overageBuffer, chunk])
        }
        let unpackData = TunnelPackage.unpack(chunk)
        while (unpackData && unpackData.completed) {
          this.handleMessage(unpackData, socket)
          // 把剩下的数据切割出来并再次解包
          chunk = chunk.subarray(unpackData.fullLength)
          unpackData = TunnelPackage.unpack(chunk)
        }
        // 如果 unpackData 不完整，把剩下数据保存下次处理
        connectionPoolData.overageBuffer = chunk
      })

      socket.on('close', () => {
        console.log(
          styleText('green', 'TunnelServer'),
          'a client connection has been disconnected.'
        )
        this.destroySocket(socket)
        this.emit('socketClose', socket)
      })

      socket.on('error', err => {
        console.log(err)
        this.destroySocket(socket)
      })
    })

    this._server.listen(this.port, () => {
      console.log(
        styleText('green', 'TunnelServer'),
        styleText('yellow', 'has started at port:'),
        styleText('cyanBright', `${this.port}`)
      )
    })
  }

  destroySocket(socket: net.Socket) {
    socket.destroy()
    this._connectionPool.forEach(
      (connectionPoolData: ConnectionPoolData, key: string) => {
        if (socket === connectionPoolData.socket) {
          this._connectionPool.delete(key)
        }
      }
    )
  }

  handleMessage(unpackData: UnpackData, socket: net.Socket) {
    // console.debug("TunnelServer received message:", unpackData.header);
    if (unpackData.header.type === TunnelPackageType.ConfirmConnection) {
      const key = unpackData.header.key
      // 如果发现这个key已经有客户端连接，则断开当前连接
      if (this._connectionPool.get(key)) return this.destroySocket(socket)

      const tunnels = this.tunnelConfig.get(key)
      if (tunnels) {
        // 找出当前的socket，并替代掉最初的随机key
        this._connectionPool.forEach((connectionPoolData, initialKey) => {
          if (socket === connectionPoolData.socket) {
            this._connectionPool.delete(initialKey)
            clearTimeout(connectionPoolData?.destroyTimer)
            // 立即设置的话 forEach 会立马再触发，要延迟一下
            process.nextTick(() =>
              this._connectionPool.set(key, connectionPoolData)
            )
          }
        })
      }
    } else {
      this.emit('message', unpackData)
    }
  }

  sendMessage(key: string, pack: PackData) {
    const socket = this._connectionPool.get(key)?.socket
    if (!socket) return
    socket.write(pack)
    return socket
  }
}
