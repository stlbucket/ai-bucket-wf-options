import { defineNitroPlugin } from 'nitropack/runtime'
import pg from 'pg'
import { createConsola } from 'consola'
import { requiredEnv } from '../lib/required-env'

const logger = createConsola({ tag: 'bridge' })

declare module 'nitropack' {
  interface NitroApp {
    pgBridge: {
      subscribe(channel: string, peer: any): Promise<void>
      unsubscribe(channel: string, peer: any): Promise<void>
    }
  }
}

export default defineNitroPlugin(async (nitro) => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })

  let connected = false
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await client.connect()
      connected = true
      break
    } catch {
      if (attempt === 10) break
      logger.warn(`pg-notify-bridge: DB not ready (attempt ${attempt}/10), retrying in 3s…`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }

  if (!connected) {
    logger.error('pg-notify-bridge: could not connect after 10 attempts — real-time bridge disabled')
    nitro.pgBridge = { async subscribe() {}, async unsubscribe() {} }
    return
  }

  const refCounts = new Map<string, number>()
  const channelPeers = new Map<string, Set<any>>()

  client.on('notification', (msg) => {
    logger.info('pg notification — channel:', msg.channel, '| payload:', msg.payload)
    if (!msg.channel || !msg.payload) return
    const peers = channelPeers.get(msg.channel)
    logger.debug('peers on channel:', peers ? peers.size : 0)
    if (!peers) return
    for (const peer of peers) {
      logger.debug('sending to peer:', peer.id)
      try {
        peer.send(msg.payload)
      } catch {
        peers.delete(peer)
      }
    }
  })

  nitro.pgBridge = {
    async subscribe(channel, peer) {
      const count = refCounts.get(channel) ?? 0
      logger.info('subscribe — channel:', channel, '| was listening:', count > 0)
      if (count === 0) await client.query(`LISTEN "${channel}"`)
      refCounts.set(channel, count + 1)
      if (!channelPeers.has(channel)) channelPeers.set(channel, new Set())
      const peerSet = channelPeers.get(channel)!
      for (const p of peerSet) {
        if (p.id === peer.id) { peerSet.delete(p); break }
      }
      peerSet.add(peer)
    },
    async unsubscribe(channel, peer) {
      const count = (refCounts.get(channel) ?? 1) - 1
      channelPeers.get(channel)?.delete(peer)
      if (channelPeers.get(channel)?.size === 0) channelPeers.delete(channel)
      if (count <= 0) {
        refCounts.delete(channel)
        await client.query(`UNLISTEN "${channel}"`)
      } else {
        refCounts.set(channel, count)
      }
    },
  }

  nitro.hooks.hookOnce('close', () => client.end())

  // Bug: h3's createResolver finds the auth middleware (registered at /msg, non-lazy,
  // no __resolve__) before the router, so websocket hooks are never reached.
  // Override resolve to walk the stack looking for a handler with __resolve__ (the router).
  const h3App = (nitro as any).h3App
  const baseURL = requiredEnv('NUXT_APP_BASE_URL')
  if (h3App?.websocket) {
    h3App.websocket.resolve = async (info: any) => {
      const rawUrl = (info as any).request?.url || (info as any).url || '/'
      const pathname = new URL(String(rawUrl), 'http://x').pathname
      const path = baseURL && pathname.startsWith(baseURL)
        ? pathname.slice(baseURL.length) || '/'
        : pathname
      for (const layer of (h3App as any).stack || []) {
        if (typeof layer.handler?.__resolve__ === 'function') {
          const resolved = await layer.handler.__resolve__(path)
          if (resolved?.handler?.__websocket__) return resolved.handler.__websocket__
        }
      }
      return {}
    }
  }
})
