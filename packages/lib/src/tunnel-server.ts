import net from 'node:net'
import { EventEmitter } from 'node:events'
import { nanoid } from 'nanoid'
import { TunnelPackage, TunnelPackageType, UnpackData } from './tunnel-package'
import { TunnelConfig } from './tunnel-config'

type TunnelServerOptions = {
  host: string
  port: number
  tunnelConfig: TunnelConfig
  closeTime?: number
}

type SocketPoolData = {
  socket: net.Socket
  overageBuffer?: Buffer // 保存上一次没处理完的 buffer
  destroyTimer?: NodeJS.Timeout // 主动断开连接的定时器
}

type PackData = ReturnType<typeof TunnelPackage.pack>

export class TunnelServer extends EventEmitter<{
  message: [UnpackData]
  socketClose: [net.Socket]
}> {
  host: string
  port: number
  tunnelConfig: TunnelConfig
  closeTime: number

  private _connectionPool: Map<string, SocketPoolData>
  private _server?: net.Server

  constructor({
    host,
    port,
    tunnelConfig,
    closeTime = 5000
  }: TunnelServerOptions) {
    super()
    this.host = host
    this.port = port
    this.tunnelConfig = tunnelConfig
    this.closeTime = closeTime
    this._connectionPool = new Map()
    this.setup()
  }

  setup() {
    this._server = net.createServer(socket => {
      console.log(
        'TunnelServer',
        '有人连接流量转发服务了：\n',
        `本地：${socket.localAddress}:${socket.localPort}\n`,
        `远程：${socket.remoteAddress}:${socket.remotePort}`
      )

      const socketPoolData: SocketPoolData = {
        socket
      }
      const randomToken = nanoid()
      this._connectionPool.set(randomToken, socketPoolData)

      // 一定时间内需带上正确 token，否则断开连接。
      socketPoolData.destroyTimer = setTimeout(
        () => this.destroySocket(socket),
        this.closeTime
      )

      socket.on('data', chunk => {
        if (socketPoolData.overageBuffer) {
          chunk = Buffer.concat([socketPoolData.overageBuffer, chunk])
        }
        let unpackData = TunnelPackage.unpack(chunk)
        while (unpackData && unpackData.completed) {
          this.handleMessage(unpackData, socket)
          // 把剩下的数据切割出来并再次解包
          chunk = chunk.subarray(unpackData.fullLength)
          unpackData = TunnelPackage.unpack(chunk)
        }
        // 如果 unpackData 不完整，把剩下数据保存下次处理
        socketPoolData.overageBuffer = chunk
      })

      socket.on('close', () => {
        console.log('TunnelServer 有客户端连接断开了')
        this.destroySocket(socket)
        this.emit('socketClose', socket)
      })

      socket.on('error', err => {
        console.log(err)
        this.destroySocket(socket)
      })
    })

    this._server.listen(this.port, () => {
      console.log('TunnelServer 已启动在:', `${this.host}:${this.port}`)
    })
  }

  destroySocket(socket: net.Socket) {
    socket.destroy()
    this._connectionPool.forEach(
      (socketPoolData: SocketPoolData, key: string) => {
        if (socket === socketPoolData.socket) {
          this._connectionPool.delete(key)
        }
      }
    )
  }

  handleMessage(unpackData: UnpackData, socket: net.Socket) {
    // console.debug("TunnelServer 收到隧道消息:", unpackData.header);

    if (unpackData.header.type === TunnelPackageType.ConfirmConnection) {
      const token = unpackData.header.token
      if (this._connectionPool.get(token)) return this.destroySocket(socket)

      const tunnels = this.tunnelConfig.get(token)
      if (tunnels) {
        // 找出当前的socket，并替代掉最初的随机key
        this._connectionPool.forEach((socketPoolData, key) => {
          if (socket === socketPoolData.socket) {
            this._connectionPool.delete(key)
            clearTimeout(socketPoolData?.destroyTimer)

            // 立即设置的话 forEach 会立马再触发，要延迟一下
            process.nextTick(() =>
              this._connectionPool.set(token, socketPoolData)
            )
          }
        })
      }
    } else {
      this.emit('message', unpackData)
    }
  }

  sendMessage(token: string, pack: PackData) {
    const socketPoolData = this._connectionPool.get(token)
    if (!socketPoolData) return

    socketPoolData.socket.write(pack)
    return socketPoolData.socket
  }
}
