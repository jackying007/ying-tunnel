import net from 'node:net'
import { join } from 'node:path'
import {
  TunnelConfig,
  TunnelServer,
  TunnelPackageType,
  TunnelPackage,
  HTTPProxyServer
} from '@ying-tunnel/core'
import { adminApiBoostrap } from './admin-api'

const tunnelConfig = new TunnelConfig(join(process.cwd(), 'tunnel-config.json'))

const tunnelServerHost = process.env.TUNNEL_SERVER_HOST ?? '127.0.0.1'
const tunnelServerPort = Number(process.env.TUNNEL_SERVER_PORT ?? 4948)

const tunnelServer = new TunnelServer({
  port: tunnelServerPort,
  tunnelConfig
})

const httpProxyServer = new HTTPProxyServer(
  Number(process.env.PROXY_SERVER_PORT ?? 80)
)

// 隧道 socket 和代理请求标识符的映射
const tunnelSocketMapTcpSigns = new Map<net.Socket, string[]>()

httpProxyServer.on('connect', (sign, host) => {
  const config = tunnelConfig.findProxyHostConfig(host)
  if (!config) {
    // 找不到映射直接断开连接
    httpProxyServer.destroy(sign)
    return
  }
  // 给隧道的客户端标记上传递给它的 http 请求的标识，关闭时统一关闭
  const tunnelSocket = tunnelServer.sendMessage(
    config.key,
    TunnelPackage.pack({
      type: TunnelPackageType.TCPRequestStart,
      sign,
      targetHost: config.targetHost
    })
  )
  if (!tunnelSocket) {
    httpProxyServer.destroy(sign)
    return
  }
  const signs = tunnelSocketMapTcpSigns.get(tunnelSocket)
  if (signs) {
    signs.push(sign)
  } else {
    tunnelSocketMapTcpSigns.set(tunnelSocket, [sign])
  }
})

httpProxyServer.on('data', (sign, host, chunk) => {
  if (!host) return
  const config = tunnelConfig.findProxyHostConfig(host)
  if (!config) return

  tunnelServer.sendMessage(
    config.key,
    TunnelPackage.pack(
      {
        type: TunnelPackageType.TCPRequestStream,
        sign
      },
      chunk
    )
  )
})

httpProxyServer.on('close', (sign, host) => {
  if (!host) return
  const config = tunnelConfig.findProxyHostConfig(host)
  if (!config) return

  tunnelServer.sendMessage(
    config.key,
    TunnelPackage.pack({
      type: TunnelPackageType.TCPRequestClose,
      sign
    })
  )
})

tunnelServer.on('message', unpackData => {
  switch (unpackData.header.type) {
    case TunnelPackageType.TCPResponseStream:
      httpProxyServer.write(unpackData.header.sign, unpackData.bodyBuffer)
      break
    case TunnelPackageType.TCPResponseClose:
      httpProxyServer.destroy(unpackData.header.sign)
      break
  }
})

tunnelServer.on('socketClose', tunnelSocket => {
  const signs = tunnelSocketMapTcpSigns.get(tunnelSocket)
  if (signs) {
    signs.forEach(sign => {
      httpProxyServer.destroy(sign)
    })
  }
})

adminApiBoostrap(tunnelConfig, tunnelServerHost, tunnelServerPort)
