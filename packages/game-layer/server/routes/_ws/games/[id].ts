import { defineWebSocketHandler, createError } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { createConsola } from 'consola'
import { getWsUpgradeClaims } from '../../../utils/getWsUpgradeClaims'

const logger = createConsola({ tag: 'game-ws' })

// The one game-layer WS route (sockets-pattern; game-server spec §WebSocket layer).
// Session-validated upgrade; the socket carries only { event, id } pings from the
// game:{id}:state channel — data flows through GraphQL/RLS on refetch. No per-game seat
// check (locked decision: nothing to leak on this pipe).
export default defineWebSocketHandler({
  async upgrade(event) {
    const headers = (event as any).headers as Headers
    logger.debug('upgrade — cookie present:', !!headers?.get?.('cookie'))
    const { claims } = await getWsUpgradeClaims(headers)
    logger.info('upgrade — claims:', claims ? `${claims.email} / resident:${claims.residentId}` : 'NONE (401)')
    if (!claims) throw createError({ statusCode: 401, message: 'Unauthorized' })
    return { context: { claims } }
  },

  async open(peer) {
    const url = new URL(peer.request!.url, 'http://x')
    const gameId = url.pathname.split('/').at(-1)
    logger.info('open — gameId:', gameId, '| peer:', peer.id)
    if (!gameId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(gameId)) {
      peer.close(1008, 'Invalid game ID')
      return
    }
    peer.context.gameId = gameId
    await useNitroApp().pgBridge.subscribe(`game:${gameId}:state`, peer)
    logger.debug('subscribed to channel:', `game:${gameId}:state`)
  },

  async close(peer) {
    const gameId = peer.context.gameId as string | undefined
    logger.info('close — gameId:', gameId, '| peer:', peer.id)
    if (gameId) {
      await useNitroApp().pgBridge.unsubscribe(`game:${gameId}:state`, peer)
    }
  },

  error(peer, error) {
    logger.error('error — peer:', peer.id, error)
  },
})
