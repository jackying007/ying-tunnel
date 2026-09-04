import cac from 'cac'
import {
  TunnelClient,
  TunnelPackage,
  TunnelPackageType,
  TCPProxyClient
} from '@ying-tunnel/lib'

const cli = cac()
cli.command('<host> <port> <key>', 'link to tcp socket.').action(init)
cli.help()
cli.parse()

function init(host: string, port: string, key: string) {
  const tunnelClient = new TunnelClient({ host, port: Number(port), key })
  const tcpProxyClient = new TCPProxyClient()

  tunnelClient.on('message', unpackData => {
    switch (unpackData.header.type) {
      case TunnelPackageType.TCPRequestStart:
        const host = unpackData.header.localHost.split(':')
        tcpProxyClient.start(host[0], Number(host[1]), unpackData.header.sign)
        break
      case TunnelPackageType.TCPRequestStream:
        tcpProxyClient.stream(unpackData.header.sign, unpackData.bodyBuffer)
        break
      case TunnelPackageType.TCPRequestClose:
        tcpProxyClient.destroy(unpackData.header.sign)
        break
    }
  })

  tcpProxyClient.on('data', (sign, chunk) => {
    tunnelClient.sendMessage(
      TunnelPackage.pack(
        {
          type: TunnelPackageType.TCPResponseStream,
          sign
        },
        chunk
      )
    )
  })

  tcpProxyClient.on('close', sign => {
    tunnelClient.sendMessage(
      TunnelPackage.pack({
        type: TunnelPackageType.TCPResponseClose,
        sign
      })
    )
  })
}
