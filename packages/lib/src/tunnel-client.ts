import net from 'node:net'
import { EventEmitter } from 'node:events'
import { TunnelPackage, TunnelPackageType, UnpackData } from './tunnel-package'

type TunnelClientOptions = {
  host: string
  port: number
  token: string
}

type PackData = ReturnType<typeof TunnelPackage.pack>

export class TunnelClient extends EventEmitter<{
  message: [UnpackData]
}> {
  host: string
  port: number
  token: string

  private _socket?: net.Socket
  private _overageBuffer?: Buffer // 保存上一次没处理完的 buffer

  constructor({ host, port, token }: TunnelClientOptions) {
    super()
    this.host = host
    this.port = port
    this.token = token
    this.setup()
  }

  setup() {
    this._socket = net.createConnection({ host: this.host, port: this.port })

    this._socket.on('connect', () => {
      if (!this._socket) return
      console.debug(
        'TunnelClient ',
        '连接上了流量转发服务了：\n',
        `本地：${this._socket.localAddress}:${this._socket.localPort}\n`,
        `远程：${this._socket.remoteAddress}:${this._socket.remotePort}`
      )

      this._socket.write(
        TunnelPackage.pack({
          type: TunnelPackageType.ConfirmConnection,
          token: this.token
        })
      )
    })

    this._socket.on('data', chunk => {
      if (this._overageBuffer) {
        chunk = Buffer.concat([this._overageBuffer, chunk])
      }

      let unpackData = TunnelPackage.unpack(chunk)
      while (unpackData && unpackData.completed) {
        this.handleMessage(unpackData)

        // 把剩下的数据切割出来并再次解包
        chunk = chunk.subarray(unpackData.fullLength)
        unpackData = TunnelPackage.unpack(chunk)
      }
      // 如果 unpackData 不完整，把剩下数据保存下次处理
      this._overageBuffer = chunk
    })

    this._socket.on('close', () => {
      console.log('TunnelClient 连接断开了')
    })

    this._socket.on('error', err => {
      console.error(err)
    })
  }

  handleMessage(unpackData: UnpackData) {
    // console.debug("TunnelClient 收到隧道消息:", unpackData.header);
    this.emit('message', unpackData)
  }

  sendMessage(pack: PackData) {
    if (this._socket) this._socket.write(pack)
  }
}
