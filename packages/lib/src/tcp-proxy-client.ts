import net from 'node:net'
import { EventEmitter } from 'node:events'

export class TCPProxyClient extends EventEmitter<{
  data: [string, Buffer]
  close: [string]
}> {
  private _tcpConnectionPool: Map<string, net.Socket>

  constructor() {
    super()
    this._tcpConnectionPool = new Map()
  }

  createConnection(host: string, port: number, sign: string) {
    const socket = net.createConnection({ host, port })

    this._tcpConnectionPool.set(sign, socket)

    socket.on('data', chunk => {
      this.emit('data', sign, chunk)
    })

    socket.on('close', () => {
      this._tcpConnectionPool.delete(sign)
      this.emit('close', sign)
    })

    socket.on('error', err => {
      console.log(sign, err)
    })
  }

  write(sign: string, buffer: Uint8Array | string) {
    const socket = this._tcpConnectionPool.get(sign)
    if (!socket) return

    socket.write(buffer)
  }

  destroy(sign: string) {
    const socket = this._tcpConnectionPool.get(sign)
    if (!socket) return

    socket.destroy()
  }
}
