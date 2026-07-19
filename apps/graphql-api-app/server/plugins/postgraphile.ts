import { serv } from '../graphserv/serv'

export default defineNitroPlugin(async (nitroApp) => {
  await serv.addTo(nitroApp.h3App)
})
