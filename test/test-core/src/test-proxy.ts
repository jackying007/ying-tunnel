import { join } from 'node:path'
import {
  TCPProxyClient,
  HTTPProxyServer,
  TunnelConfig
} from '@ying-tunnel/core'

const tcpProxyClient = new TCPProxyClient()

// tunnel-config.json 配置了转发到的本地服务为 127.0.0.1:6263, 也就是 test-server 项目服务启动的地址
const tunnelConfig = new TunnelConfig(join(process.cwd(), 'tunnel-config.json'))

const proxyServer = new HTTPProxyServer({ port: 80, tunnelConfig })

proxyServer.on('connect', (sign, connectInfo) => {
  console.debug({ sign, connectInfo })
  if (connectInfo) {
    const host = connectInfo.localHost.split(':')
    tcpProxyClient.createConnection(host[0], Number(host[1]), sign)
  }
})

proxyServer.on('data', (sign, _, chunk) => {
  console.log(chunk.length)
  tcpProxyClient.write(sign, chunk)
})

proxyServer.on('close', sign => {
  tcpProxyClient.destroy(sign)
})

tcpProxyClient.on('data', (sign, chunk) => {
  console.log(chunk.length)
  proxyServer.write(sign, chunk)
})

tcpProxyClient.on('close', sign => {
  proxyServer.destroy(sign)
})
