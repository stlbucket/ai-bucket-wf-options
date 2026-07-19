import { useAuth } from "@function-bucket/fnb-auth-ui"
import { defineNuxtRouteMiddleware, navigateTo } from "nuxt/app"

export default defineNuxtRouteMiddleware(() => {
  const { isLoggedIn, goHome } = useAuth()
  if (!isLoggedIn.value) {
    // return goHome()
  }
})
