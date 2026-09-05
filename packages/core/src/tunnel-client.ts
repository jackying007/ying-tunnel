import net from 'node:net'
import { EventEmitter } from 'node:events'
import { styleText } from 'node:util'
import { TunnelPackage, TunnelPackageType, UnpackData } from './tunnel-package'

type TunnelClientOptions = {
  host: string
  port: number
  key: string
}

type PackData = ReturnType<typeof TunnelPackage.pack>

export class TunnelClient extends EventEmitter<{
  message: [UnpackData]
}> {
  options: TunnelClientOptions

  private _socket?: net.Socket
  private _overageBuffer?: Buffer // 保存上一次没处理完的 buffer
  private _retryCount = 0

  constructor(options: TunnelClientOptions) {
    super()
    this.options = options
    this.setup()
  }

  setup() {
    this._socket = net.createConnection({
      host: this.options.host,
      port: this.options.port
    })

    this._socket.on('connect', () => {
      if (!this._socket) return
      console.log(
        styleText('green', 'TunnelClient'),
        'Successfully connected to the server.'
      )
      this._socket.write(
        TunnelPackage.pack({
          type: TunnelPackageType.ConfirmConnection,
          key: this.options.key
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
      console.log(
        styleText('green', 'TunnelClient'),
        'server connection has been disconnected.'
      )
    })

    this._socket.on('error', err => {
      console.error(err)
      if (this._retryCount <= 3) {
        this._retryCount += 1
        console.log(
          styleText('green', 'TunnelClient'),
          styleText('red', 'Retry in 2 seconds ...')
        )
        setTimeout(() => this.setup(), 2000)
      }
    })
  }

  handleMessage(unpackData: UnpackData) {
    // console.debug('TunnelClient received message:', unpackData.header)
    this.emit('message', unpackData)
  }

  sendMessage(pack: PackData) {
    if (this._socket) this._socket.write(pack)
  }
}
