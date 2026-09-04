import net from 'node:net'
import { EventEmitter } from 'node:events'

export class ProxyClient extends EventEmitter<{
  data: [string, Buffer]
  close: [string]
}> {
  private _reqConnectionPool: Map<string, net.Socket>

  constructor() {
    super()
    this._reqConnectionPool = new Map()
  }

  start(host: string, port: number, sign: string) {
    const socket = net.createConnection({ host, port })

    this._reqConnectionPool.set(sign, socket)

    socket.on('data', chunk => {
      this.emit('data', sign, chunk)
    })

    socket.on('close', () => {
      this._reqConnectionPool.delete(sign)
      this.emit('close', sign)
    })

    socket.on('error', err => {
      console.log(sign, err)
    })
  }

  stream(sign: string, buffer: Uint8Array | string) {
    const socket = this._reqConnectionPool.get(sign)
    if (!socket) return

    socket.write(buffer)
  }

  destroy(sign: string) {
    const socket = this._reqConnectionPool.get(sign)
    if (!socket) return

    socket.destroy()
  }
}
