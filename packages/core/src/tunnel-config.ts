import {
  existsSync,
  writeFileSync,
  readFileSync,
  createWriteStream
} from 'node:fs'

export class TunnelConfig {
  path: string
  private _config: Record<string, Record<string, string>>
  private _proxyHostMap: Map<string, { key: string; targetHost: string }> =
    new Map()

  constructor(path: string) {
    this.path = path
    const fileExists = existsSync(this.path)
    if (!fileExists) {
      writeFileSync(this.path, '{}')
    }
    const data = readFileSync(this.path)
    this._config = JSON.parse(data.toString())
    this.setup()
  }

  setup() {
    const keys = Object.keys(this._config)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const proxyMap = this._config[key]
      const mapKeys = Object.keys(proxyMap)
      for (let j = 0; j < mapKeys.length; j++) {
        const mKey = mapKeys[j]
        this._proxyHostMap.set(mKey, { key, targetHost: proxyMap[mKey] })
      }
    }
  }

  saveFile() {
    const ws = createWriteStream(this.path, { flags: 'w+' })
    ws.end(JSON.stringify(this._config))
  }

  get(key: string) {
    return this._config[key]
  }

  set(key: string, value: Record<string, string>) {
    this._config[key] = value
    this.setup()
    this.saveFile()
  }

  del(key: string) {
    delete this._config[key]
    this.setup()
    this.saveFile()
  }

  getConfig() {
    return this._config
  }

  findProxyHostConfig(proxyHost: string) {
    return this._proxyHostMap.get(proxyHost)
  }
}
