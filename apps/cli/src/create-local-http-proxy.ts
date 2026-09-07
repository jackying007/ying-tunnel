import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { HTTPProxyServer, TCPProxyClient } from '@ying-tunnel/core'

class ProxyMapConfig {
  private _proxyMap: Record<string, string>

  constructor(path: string) {
    const fileExists = existsSync(path)
    if (!fileExists) throw new Error('config file is not exists.')
    const data = readFileSync(path)
    this._proxyMap = JSON.parse(data.toString())
  }

  get(key: string) {
    return this._proxyMap[key]
  }
}

export function createLocalHTTPProxy(configFileName?: string) {
  const proxyMapConfig = new ProxyMapConfig(
    join(process.cwd(), configFileName ?? 'ying-local-proxy.json')
  )
  const httpProxyServer = new HTTPProxyServer(80)
  const tcpProxyClient = new TCPProxyClient()

  httpProxyServer.on('connect', (sign, proxyHost) => {
    const targetHost = proxyMapConfig.get(proxyHost)
    if (targetHost) {
      const host = targetHost.split(':')
      tcpProxyClient.createConnection(host[0], Number(host[1]), sign)
    }
  })

  httpProxyServer.on('data', (sign, _, chunk) => {
    tcpProxyClient.write(sign, chunk)
  })

  httpProxyServer.on('close', sign => {
    tcpProxyClient.destroy(sign)
  })

  tcpProxyClient.on('data', (sign, chunk) => {
    httpProxyServer.write(sign, chunk)
  })

  tcpProxyClient.on('close', sign => {
    httpProxyServer.destroy(sign)
  })
}
