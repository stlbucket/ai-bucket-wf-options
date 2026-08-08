<script setup lang="ts">
// The home page's descriptive area, shown on the left of both the logged-out and logged-in
// views. Three tabs the visitor is meant to explore: what the platform is, how it's built
// (the agentic skill system), and how a developer would drive it.
//
// `withWorkspaces` folds the user's workspaces in as a leading, default-selected tab — used on
// mobile (logged-in) where the desktop right-hand workspace column collapses into the tab strip.
// The content comes through the `#workspaces` slot.
const props = defineProps<{ withWorkspaces?: boolean }>()

const baseTabs = [
  { label: 'What it is', slot: 'about', icon: 'i-lucide-box' },
  { label: "How it's built", slot: 'built', icon: 'i-lucide-wand-sparkles' },
  { label: 'For developers', slot: 'dev', icon: 'i-lucide-terminal' },
]

const tabs = computed(() =>
  props.withWorkspaces
    ? [{ label: 'Workspaces', slot: 'workspaces', icon: 'i-lucide-building-2' }, ...baseTabs]
    : baseTabs,
)

// Tab 1 — the product intro.
const intro = [
  'function-bucket is an extensible set of small tools, useful on their own, that can be'
  + ' included in more extensive applications in a building-block fashion — messaging, to-do'
  + ' lists, polls, support tickets, shared files, reference datasets, even a few games. Instead'
  + ' of stitching together a half-dozen separate apps and logins, you get one workspace where'
  + ' these tools live side by side, share the same people and permissions, and stay out of your'
  + ' way.',
  'Everything runs inside your own workspace. Your organization’s people, data, and'
  + ' conversations are walled off from everyone else’s, so what you see is scoped to the teams'
  + ' you belong to. Invite teammates, hand out access by role, and share individual items with a'
  + ' single link when someone outside the walls needs to weigh in.',
  'The tools are built to work together rather than in isolation — a to-do carries its own'
  + ' discussion, attachments, and assignees; a poll collects answers, notes, and a conversation'
  + ' in one place. New tools drop into the same framework and inherit its security and sharing,'
  + ' so the platform keeps growing without becoming a pile of disconnected apps.',
]
</script>

<template>
  <UTabs
    :items="tabs"
    variant="link"
    class="w-full"
    :ui="{ list: 'overflow-x-auto', trigger: 'shrink-0' }"
  >
    <!-- Optional leading tab (mobile, logged-in): the user's workspaces -->
    <template #workspaces>
      <div class="mt-5">
        <slot name="workspaces" />
      </div>
    </template>

    <!-- Tab 1: what function-bucket is -->
    <template #about>
      <div class="narrative mt-5 space-y-4 leading-relaxed text-muted">
        <p
          v-for="(para, i) in intro"
          :key="i"
        >
          {{ para }}
        </p>
      </div>
    </template>

    <!-- Tab 2: the agentic skill system that builds it -->
    <template #built>
      <div class="narrative mt-5 space-y-4 leading-relaxed text-muted">
        <p>
          function-bucket isn’t assembled by hand, one file at a time — it’s built by a system of
          <strong class="text-highlighted">skills</strong>: packaged, repeatable procedures an AI
          agent follows to add or change a tool. Each skill captures how a particular job is done
          here — the conventions, the order of operations, the mistakes to avoid — so every new
          feature lands the same disciplined way rather than being reinvented each time. A handful
          of these are the ones you actually drive; the rest are specialists they call on as
          needed.
        </p>
        <p>
          The two at the center are <code>fnb-stack-spec</code> and
          <code>fnb-stack-implementor</code>, and they enforce a simple rule: spec before build.
          <code>fnb-stack-spec</code> authors the contract for a feature — what it is, the data
          behind it, who’s allowed to see it, and how each page looks and behaves — and writes it
          down as the single source of truth. <code>fnb-stack-implementor</code> then takes that
          contract and builds it straight down the stack: database, API, data layer, and user
          interface. It works from checklists and knows the failure signatures, so the same
          feature is wired end to end from a spec anyone can read.
        </p>
        <p>
          A third driver, <code>fnb-acquire-dataset</code>, handles a common case: turning an
          outside data source into a working tool. It does its own reconnaissance on the source,
          produces a dataset-specific expert that captures that source’s quirks, and then drives
          <code>fnb-stack-spec</code> and <code>fnb-stack-implementor</code> automatically — recon
          to spec to shipped tool, without you stitching the steps together.
        </p>
        <p>
          Underneath the drivers sits a bench of narrow <strong class="text-highlighted">
            specialists</strong> — <code>fnb-db-designer</code> and <code>sqitch-expert</code> for
          the database and its migrations, <code>postgraphile-5-expert</code> for the GraphQL
          layer, <code>n8n-cli</code> for the workflow engine, <code>zitadel-expert</code> for
          authentication, <code>new-db-package</code> and <code>fnb-create-app</code> for
          scaffolding, and more. You never call these directly; the drivers pull in whichever ones
          a given step needs. You describe the tool you want, and the skill system routes the work
          to the right expertise at each layer — which is how the bucket keeps filling with new
          tools without turning into a pile of one-off code.
        </p>
      </div>
    </template>

    <!-- Tab 3: how a developer would use it -->
    <template #dev>
      <div class="narrative mt-5 space-y-4 leading-relaxed text-muted">
        <p>
          The same skills are yours to drive. Clone the repo, run one <code>pnpm env-build</code>,
          and the whole stack — auth, multi-tenancy, storage, the workflow engine — is running
          locally in Docker. From there you point the skills at whatever you’re building.
        </p>

        <p class="font-medium text-highlighted">
          Stand up a data explorer
        </p>
        <p>
          Say you want to explore a couple of public datasets. Grab a CSV export from
          <strong class="text-highlighted">Kaggle</strong> and a live feed from a public API — the
          <strong class="text-highlighted">USGS earthquake feed</strong>, for instance. Point
          <code>fnb-acquire-dataset</code> at each one: it does its own reconnaissance, writes a
          dataset-specific expert that captures the source’s quirks, then drives
          <code>fnb-stack-spec</code> and <code>fnb-stack-implementor</code> to land each as a
          first-class Datasets tool — table, filters, detail pages, all tenant-scoped. Ask
          <code>fnb-stack-spec</code> for a dashboard page that charts the numbers, hand it to
          <code>fnb-stack-implementor</code>, and you have a visualization over data that wasn’t in
          the repo an hour ago.
        </p>

        <p class="font-medium text-highlighted">
          Build a custom vertical
        </p>
        <p>
          Or build something bespoke — say a product where each tenant runs a lawn-care business
          and manages appointments for their clients. Describe it to <code>fnb-stack-spec</code>
          and it authors the contract: a clients table, a scheduled-appointments table, who can see
          what. <code>new-db-package</code> scaffolds the database module and
          <code>fnb-db-designer</code> designs the schema and the row-level rules, so one company
          can never see another’s book. <code>fnb-stack-implementor</code> builds it down the
          stack — migrations via <code>sqitch-expert</code>, the GraphQL API via
          <code>postgraphile-5-expert</code>, and the booking UI — and if you want a text reminder
          the night before an appointment, an <code>n8n-cli</code> workflow sends it over Twilio.
          Multi-tenant isolation, auth, and sharing come for free, because every new module
          inherits them.
        </p>

        <p class="font-medium text-highlighted">
          Then ship it anywhere
        </p>
        <p>
          When it’s ready, deployment is already solved. The repo ships Terraform that stands the
          whole stack up on a single <strong class="text-highlighted">DigitalOcean</strong> droplet
          — Caddy handling automatic TLS out front, DO Managed Postgres and Spaces behind it — or
          the identical Compose stack on <strong class="text-highlighted">AWS</strong> (EC2 + RDS +
          S3), one command either way. And because it’s ultimately just Docker Compose behind
          Caddy, nothing ties you to those two: anywhere you can run containers, you can run
          function-bucket.
        </p>
      </div>
    </template>
  </UTabs>
</template>

<style scoped>
.narrative code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.85em;
  font-weight: 500;
  color: var(--ui-text-highlighted);
  background-color: var(--ui-bg-elevated);
  padding: 0.05rem 0.3rem;
  border-radius: 0.25rem;
  white-space: nowrap;
}
</style>
