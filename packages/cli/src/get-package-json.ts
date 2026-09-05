import { readFileSync } from 'node:fs'
import { join } from 'node:path'

interface Package {
  name: string
  version: string
}

export function getPackageJson(): Package {
  const data = readFileSync(join(__dirname, '../package.json'))
  return JSON.parse(data.toString())
}
