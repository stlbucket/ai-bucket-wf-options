// defineAppConfig is a Nuxt auto-import — importing it from 'nuxt/app' pulls a
// Vue app alias into the server runtime and breaks the build.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue', // active states, links, primary actions
      secondary: 'green', // brand mark, "+ New" CTAs
      success: 'green',
      neutral: 'slate' // paper / ink / line surface family
      // warning / error inherit Nuxt UI defaults (yellow / red) for now
    },
    // Cascadia table treatment: uppercase 11px header band on the muted surface.
    // Merges with Nuxt UI defaults, so only the overrides are listed.
    table: {
      slots: {
        root: 'my-0',
        th: 'text-[11px] font-bold uppercase tracking-wider text-dimmed bg-muted',
        td: 'text-default'
      }
    }
  }
})
