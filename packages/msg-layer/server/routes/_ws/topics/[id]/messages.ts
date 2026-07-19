import { defineWebSocketHandler, createError } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { createConsola } from 'consola'
import { getWsUpgradeClaims } from '../../../../utils/getWsUpgradeClaims'

const logger = createConsola({ tag: 'ws' })

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
    const topicId = url.pathname.split('/').at(-2)
    logger.info('open — topicId:', topicId, '| peer:', peer.id)
    if (!topicId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(topicId)) {
      peer.close(1008, 'Invalid topic ID')
      return
    }
    peer.context.topicId = topicId
    await useNitroApp().pgBridge.subscribe(`topic:${topicId}:message`, peer)
    logger.debug('subscribed to channel:', `topic:${topicId}:message`)
  },

  async close(peer) {
    const topicId = peer.context.topicId as string | undefined
    logger.info('close — topicId:', topicId, '| peer:', peer.id)
    if (topicId) {
      await useNitroApp().pgBridge.unsubscribe(`topic:${topicId}:message`, peer)
    }
  },

  error(peer, error) {
    logger.error('error — peer:', peer.id, error)
  },
})
