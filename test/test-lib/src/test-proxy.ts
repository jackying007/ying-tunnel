import { join } from 'node:path'
import { ProxyClient, ProxyServer, TunnelConfig } from '@ying-tunnel/lib'

const proxyClient = new ProxyClient()

// tunnel-config.json 配置了转发到的本地服务为  127.0.0.1:6263, 也就是 test-server 项目服务启动的地址
const tunnelConfig = new TunnelConfig(join(process.cwd(), 'tunnel-config.json'))

const proxyServer = new ProxyServer({ port: 3435, tunnelConfig })

proxyServer.on('connect', (sign, connectInfo) => {
  console.debug({ sign, connectInfo })
  if (connectInfo) {
    const host = connectInfo.localHost.split(':')
    proxyClient.start(host[0], Number(host[1]), sign)
  }
})

proxyServer.on('data', (sign, _, chunk) => {
  console.log(chunk.length)
  proxyClient.stream(sign, chunk)
})

proxyServer.on('close', sign => {
  proxyClient.destroy(sign)
})

proxyClient.on('data', (sign, chunk) => {
  console.log(chunk.length)
  proxyServer.stream(sign, chunk)
})

proxyClient.on('close', sign => {
  proxyServer.destroy(sign)
})
