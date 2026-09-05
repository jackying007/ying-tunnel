// sign 请求池标识符
// localHost 要连接的本地服务路径，如 127.0.0.1:6263

export enum TunnelPackageType {
  ConfirmConnection = 1, // 表示客户端要确认连接上转发服务 消息头：{ type: 1, key: "" } 消息体：空
  TCPRequestStart, // 表示服务端要求客户端发起本地请求 消息头：{ type: 2, sign: "", localHost: "" } 消息体：空
  TCPRequestStream, // 表示服务端向客户端传输数据块 消息头：{ type: 3, sign: "" } 消息体：数据块
  TCPRequestClose, // 表示服务端向客户端本地提示连接关闭 消息头：{ type: 4, sign: "" } 消息体：空
  TCPResponseStream, // 表示客户端向服务端传输数据块 消息头：{ type: 5, sign: "" } 消息体：数据块
  TCPResponseClose // 表示客户端向服务端提示连接关闭 消息头：{ type: 6, sign: "" } 消息体：空
}

type TunnelPackageHeader =
  | {
      type: TunnelPackageType.ConfirmConnection
      key: string
    }
  | {
      type: TunnelPackageType.TCPRequestStart
      sign: string
      localHost: string
    }
  | {
      type: TunnelPackageType.TCPRequestClose
      sign: string
    }
  | {
      type: TunnelPackageType.TCPRequestStream
      sign: string
    }
  | {
      type: TunnelPackageType.TCPResponseStream
      sign: string
    }
  | {
      type: TunnelPackageType.TCPResponseClose
      sign: string
    }

// 2 两个字节使用 writeUInt16BE 最多写入数字 65535
const HeaderLengthBufferSize = 2
const BodyLengthBufferSize = 2
const markerLength = HeaderLengthBufferSize + BodyLengthBufferSize

export type UnpackData = {
  fullLength: number
  headerLength: number
  header: TunnelPackageHeader
  bodyLength: number
  bodyBuffer: Buffer
  completed: boolean
}

export class TunnelPackage {
  // 此时传进来的 body 最大长度是 65536，所以存储时整体减 1
  static pack(header: TunnelPackageHeader, bodyBuffer?: Buffer) {
    const headerBuffer = Buffer.from(JSON.stringify(header))

    const markerBuffer = Buffer.alloc(markerLength)
    markerBuffer.writeUInt16BE(headerBuffer.length)
    markerBuffer.writeUInt16BE(
      bodyBuffer?.length ? bodyBuffer.byteLength - 1 : 0,
      HeaderLengthBufferSize
    )

    return Buffer.concat(
      bodyBuffer
        ? [markerBuffer, headerBuffer, bodyBuffer]
        : [markerBuffer, headerBuffer]
    )
  }

  static unpack(buffer: Buffer): undefined | UnpackData {
    if (buffer.length < markerLength) return

    const markerBuffer = buffer.subarray(0, markerLength)
    const dataBuffer = buffer.subarray(markerLength)

    const headerLength = markerBuffer.readUInt16BE()
    const recordBodyLength = markerBuffer.readUInt16BE(HeaderLengthBufferSize)
    const bodyLength = recordBodyLength ? recordBodyLength + 1 : 0

    const headerBuffer = dataBuffer.subarray(0, headerLength)
    const bodyBuffer = dataBuffer.subarray(
      headerLength,
      headerLength + bodyLength
    )

    return {
      fullLength: markerLength + headerLength + bodyLength,
      headerLength,
      header: JSON.parse(headerBuffer.toString()),
      bodyLength,
      bodyBuffer,
      completed: bodyLength === bodyBuffer.length
    }
  }
}
