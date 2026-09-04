import fs from 'node:fs'

export type ProxyMap = {
  serverHost: string
  localHost: string
}

export class TunnelConfig {
  path: string
  private _tunnelConfigs: {
    [key in string]: ProxyMap[]
  }
  constructor(path: string) {
    this.path = path

    const fileExists = fs.existsSync(this.path)
    if (!fileExists) {
      fs.writeFileSync(this.path, '{}')
    }
    const data = fs.readFileSync(this.path)
    this._tunnelConfigs = JSON.parse(data.toString())
  }

  saveFile() {
    const ws = fs.createWriteStream(this.path, { flags: 'w+' })
    ws.end(JSON.stringify(this._tunnelConfigs))
  }

  get(key: string) {
    return this._tunnelConfigs[key]
  }

  set(key: string, value: ProxyMap[]) {
    this._tunnelConfigs[key] = value

    this.saveFile()
  }

  del(key: string) {
    delete this._tunnelConfigs[key]

    this.saveFile()
  }

  getTunnelList() {
    const keys = Object.keys(this._tunnelConfigs)
    const arr = []
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      arr.push({
        token: key,
        proxyList: this._tunnelConfigs[key]
      })
    }

    return arr
  }

  findByServerHost(serverHost: string) {
    const keys = Object.keys(this._tunnelConfigs)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const tunnelArray = this._tunnelConfigs[key]

      for (let j = 0; j < tunnelArray.length; j++) {
        const tunnel = tunnelArray[j]
        if (tunnel.serverHost === serverHost) {
          return {
            key,
            serverHost: tunnel.serverHost,
            localHost: tunnel.localHost
          }
        }
      }
    }

    return
  }
}
