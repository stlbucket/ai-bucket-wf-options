import { eventHandler } from 'h3'
import { serv } from '../graphserv/serv'

export default eventHandler({
  handler: (event) => serv.handleGraphQLEvent(event),
  websocket: serv.makeWsHandler(),
})
