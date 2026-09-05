import { randomBytes } from 'node:crypto'

const urlAlphabet =
  'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

export function randomKey(size = 21) {
  let id = ''
  const bytes = randomBytes(size)
  for (let i = 0; i < size; i++) {
    id += urlAlphabet[bytes[i] & 63]
  }
  return id
}
