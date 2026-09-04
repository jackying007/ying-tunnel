import net from 'node:net'
import { join } from 'node:path'
import {
  TunnelConfig,
  TunnelServer,
  TunnelPackageType,
  TunnelPackage,
  ProxyServer
} from '@ying-tunnel/lib'
import { adminApiBoostrap } from './admin-api'

const tunnelConfig = new TunnelConfig(join(process.cwd(), 'tunnel-config.json'))

const tunnelServerHost = process.env.TUNNEL_SERVER_HOST || ''
const tunnelServerPort = Number(process.env.TUNNEL_SERVER_PORT || 4948)
const tunnelServer = new TunnelServer({
  host: tunnelServerHost,
  port: tunnelServerPort,
  tunnelConfig
})

const proxyServerPort = Number(process.env.PROXY_SERVER_PORT || 3435)
const proxyServer = new ProxyServer({ port: proxyServerPort, tunnelConfig })

const tunnelSocketAndTcpSignsMap = new Map<net.Socket, string[]>()

proxyServer.on('connect', (sign, connectInfo, socket) => {
  if (connectInfo) {
    const tunnelSocket = tunnelServer.sendMessage(
      connectInfo.key,
      TunnelPackage.pack({
        type: TunnelPackageType.TCPRequestStart,
        sign,
        localHost: connectInfo.localHost
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

proxyServer.on('data', (sign, connectInfo, chunk) => {
  if (connectInfo) {
    tunnelServer.sendMessage(
      connectInfo.key,
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

proxyServer.on('close', (sign, connectInfo) => {
  if (connectInfo) {
    tunnelServer.sendMessage(
      connectInfo.key,
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
      proxyServer.stream(unpackData.header.sign, unpackData.bodyBuffer)
      break
    case TunnelPackageType.TCPResponseClose:
      proxyServer.destroy(unpackData.header.sign)
      break
  }
})

tunnelServer.on('socketClose', tunnelSocket => {
  const signs = tunnelSocketAndTcpSignsMap.get(tunnelSocket)
  if (signs) {
    signs.forEach(sign => {
      proxyServer.destroy(sign)
    })
  }
})

adminApiBoostrap(tunnelConfig, tunnelServerHost, tunnelServerPort)
