import net from 'node:net'
import { join } from 'node:path'
import {
  TunnelConfig,
  TunnelServer,
  TunnelPackageType,
  TunnelPackage,
  HTTPProxyServer
} from '@ying-tunnel/lib'
import { adminApiBoostrap } from './admin-api'

const tunnelConfig = new TunnelConfig(join(process.cwd(), 'tunnel-config.json'))

const tunnelServerHost = process.env.TUNNEL_SERVER_HOST ?? '127.0.0.1'
const tunnelServerPort = Number(process.env.TUNNEL_SERVER_PORT ?? 4948)
const tunnelServer = new TunnelServer({
  port: tunnelServerPort,
  tunnelConfig
})

const httpProxyServer = new HTTPProxyServer({
  port: Number(process.env.PROXY_SERVER_PORT ?? 80),
  tunnelConfig
})

const tunnelSocketAndTcpSignsMap = new Map<net.Socket, string[]>()

httpProxyServer.on('connect', (sign, proxyMapWithKey, socket) => {
  if (proxyMapWithKey) {
    const tunnelSocket = tunnelServer.sendMessage(
      proxyMapWithKey.key,
      TunnelPackage.pack({
        type: TunnelPackageType.TCPRequestStart,
        sign,
        localHost: proxyMapWithKey.localHost
      })
    )
    if (tunnelSocket) {
      const signs = tunnelSocketAndTcpSignsMap.get(tunnelSocket)
      if (signs) {
        signs.push(sign)
      } else {
        tunnelSocketAndTcpSignsMap.set(tunnelSocket, [sign])
      }
    } else {
      socket.destroy()
    }
  }
})

httpProxyServer.on('data', (sign, proxyMapWithKey, chunk) => {
  if (proxyMapWithKey) {
    tunnelServer.sendMessage(
      proxyMapWithKey.key,
      TunnelPackage.pack(
        {
          type: TunnelPackageType.TCPRequestStream,
          sign
        },
        chunk
      )
    )
  }
})

httpProxyServer.on('close', (sign, proxyMapWithKey) => {
  if (proxyMapWithKey) {
    tunnelServer.sendMessage(
      proxyMapWithKey.key,
      TunnelPackage.pack({
        type: TunnelPackageType.TCPRequestClose,
        sign
      })
    )
  }
})

tunnelServer.on('message', unpackData => {
  switch (unpackData.header.type) {
    case TunnelPackageType.TCPResponseStream:
      httpProxyServer.stream(unpackData.header.sign, unpackData.bodyBuffer)
      break
    case TunnelPackageType.TCPResponseClose:
      httpProxyServer.destroy(unpackData.header.sign)
      break
  }
})

tunnelServer.on('socketClose', tunnelSocket => {
  const signs = tunnelSocketAndTcpSignsMap.get(tunnelSocket)
  if (signs) {
    signs.forEach(sign => {
      httpProxyServer.destroy(sign)
    })
  }
})

adminApiBoostrap(tunnelConfig, tunnelServerHost, tunnelServerPort)
