import cac from 'cac'
import {
  ProxyClient,
  TunnelClient,
  TunnelPackage,
  TunnelPackageType
} from '@ying-tunnel/lib'

const cli = cac()
cli.command('<host> <port> <token>', 'link to tcp socket.').action(init)
cli.help()
cli.parse()

function init(host: string, port: string, token: string) {
  const proxyClient = new ProxyClient()
  const tunnelClient = new TunnelClient({ host, port: Number(port), token })

  tunnelClient.on('message', unpackData => {
    switch (unpackData.header.type) {
      case TunnelPackageType.TCPRequestStart:
        const host = unpackData.header.localHost.split(':')
        proxyClient.start(host[0], Number(host[1]), unpackData.header.sign)
        break
      case TunnelPackageType.TCPRequestStream:
        proxyClient.stream(unpackData.header.sign, unpackData.bodyBuffer)
        break
      case TunnelPackageType.TCPRequestClose:
        proxyClient.destroy(unpackData.header.sign)
        break
    }
  })

  proxyClient.on('data', (sign, chunk) => {
    console.log(`proxyClient: 请求${sign}数据`, chunk.length)
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

  proxyClient.on('close', sign => {
    console.log(`proxyClient: 请求${sign}关闭`)
    tunnelClient.sendMessage(
      TunnelPackage.pack({
        type: TunnelPackageType.TCPResponseClose,
        sign
      })
    )
  })
}
