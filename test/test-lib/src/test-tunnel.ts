import { join } from 'node:path'
import {
  TunnelConfig,
  TunnelServer,
  TunnelClient,
  TunnelPackage,
  TunnelPackageType
} from '@ying-tunnel/lib'

const port = 4948

const tunnelConfig = new TunnelConfig(join(process.cwd(), 'tunnel-config.json'))

const tunnelServer = new TunnelServer({ port, tunnelConfig })
const tunnelClient = new TunnelClient({
  host: '127.0.0.1',
  port,
  key: 'OxFhMdko9XkAJM37l8RC2'
})

// 连续多发几个看看粘包情况

setTimeout(() => {
  tunnelClient.sendMessage(
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPResponseStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelServer!1')
    )
  )
  tunnelClient.sendMessage(
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPResponseStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelServer!2')
    )
  )
  tunnelClient.sendMessage(
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPResponseStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelServer!3')
    )
  )
}, 1000)

setTimeout(() => {
  tunnelServer.sendMessage(
    'OxFhMdko9XkAJM37l8RC2',
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPRequestStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelClient!1')
    )
  )
  tunnelServer.sendMessage(
    'OxFhMdko9XkAJM37l8RC2',
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPRequestStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelClient!2')
    )
  )
  tunnelServer.sendMessage(
    'OxFhMdko9XkAJM37l8RC2',
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPRequestStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelClient!3')
    )
  )
}, 2000)

// 6 秒后看看是否断开连接

setTimeout(() => {
  tunnelClient.sendMessage(
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPResponseStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelServer!4')
    )
  )

  tunnelServer.sendMessage(
    'OxFhMdko9XkAJM37l8RC2',
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPRequestStream,
        sign: 'aaaa'
      },
      Buffer.from('Hello tunnelClient!4')
    )
  )
}, 6000)
