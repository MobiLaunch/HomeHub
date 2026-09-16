import type { AddressInfo, Server } from 'node:net'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createKasaLight } from './kasa.js'

function xorEncrypt(data: Buffer): Buffer {
  let key = 171
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    const encrypted = data[i]! ^ key
    key = encrypted
    out[i] = encrypted
  }
  return out
}

function xorDecrypt(data: Buffer): Buffer {
  let key = 171
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    const decrypted = data[i]! ^ key
    key = data[i]!
    out[i] = decrypted
  }
  return out
}

/** A minimal fake Kasa device speaking the real framed-XOR-JSON protocol. */
function startFakeKasaDevice(respond: (command: Record<string, unknown>) => Record<string, unknown>): Promise<{ server: Server, port: number }> {
  return new Promise((resolve) => {
    const server = createServer((socket) => {
      const chunks: Buffer[] = []
      socket.on('data', (chunk) => {
        chunks.push(chunk)
        const full = Buffer.concat(chunks)
        if (full.length < 4)
          return
        const length = full.readUInt32BE(0)
        if (full.length < 4 + length)
          return
        const command = JSON.parse(xorDecrypt(full.subarray(4, 4 + length)).toString('utf8'))
        const responseBody = xorEncrypt(Buffer.from(JSON.stringify(respond(command))))
        const responseLength = Buffer.alloc(4)
        responseLength.writeUInt32BE(responseBody.length, 0)
        socket.end(Buffer.concat([responseLength, responseBody]))
      })
    })
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port })
    })
  })
}

describe('createKasaLight', () => {
  let server: Server
  let host: string
  let port: number
  let relayState = 0

  beforeEach(async () => {
    relayState = 0
    const fake = await startFakeKasaDevice((command) => {
      if (command.system && 'set_relay_state' in (command.system as object)) {
        relayState = (command.system as { set_relay_state: { state: number } }).set_relay_state.state
        return { system: { set_relay_state: { err_code: 0 } } }
      }
      return { system: { get_sysinfo: { alias: 'Fake Plug', relay_state: relayState } } }
    })
    server = fake.server
    host = '127.0.0.1'
    port = fake.port
  })

  afterEach(() => {
    server.close()
  })

  it('reads plug on/off state via get_sysinfo', async () => {
    const light = createKasaLight('kasa-1', 'Fake Plug', host, port)
    await expect(light.getStatus()).resolves.toEqual({ on: false, brightness: 0 })
  })

  it('turns a plug on via set_relay_state and reflects it in status', async () => {
    const light = createKasaLight('kasa-1', 'Fake Plug', host, port)
    await light.setOn(true)
    await expect(light.getStatus()).resolves.toEqual({ on: true, brightness: 100 })
  })
})
