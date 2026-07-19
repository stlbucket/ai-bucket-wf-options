import { eventHandler } from 'h3'
import { serv } from '../../graphserv/serv'

export default eventHandler(event => serv.handleEventStreamEvent(event))
