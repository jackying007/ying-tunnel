#!/usr/bin/env node
import { program } from 'commander'
import { connectTunnel } from './connect-tunnel'
import { getPackageJson } from './get-package-json'

const pkg = getPackageJson()

program
  .name('ying-tunnel')
  .version(`${pkg.version}`, '-v --version')
  .description('CLI program for connecting to tunnel server.')
  .helpOption(true)

program
  .command('connect', { isDefault: true })
  .argument('<host>', 'The server IP or domain name to connect to')
  .argument('<port>', 'The server port to connect to')
  .argument('<key>', 'corresponding key')
  .action(connectTunnel)

program.parse(process.argv)
