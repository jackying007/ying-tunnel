#!/usr/bin/env node
import { program } from 'commander'
import { getPackageJson } from './get-package-json'
import { connectTunnel } from './connect-tunnel'
import { createLocalHTTPProxy } from './create-local-http-proxy'

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

program
  .command('local-http-proxy')
  .alias('lhp')
  .argument('[configFileName]')
  .action(createLocalHTTPProxy)

program.parse(process.argv)
