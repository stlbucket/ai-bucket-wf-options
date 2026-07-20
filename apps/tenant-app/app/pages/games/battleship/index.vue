<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { GameSummary, NewGamePlayer, PlayerKind } from '@function-bucket/fnb-types'
import { formatUrn } from '@function-bucket/fnb-types'

// battleship-index.ui.md / battleship-index.data.md
const { games, fetching, error, refresh, createGame } = useGames('battleship')
const { gameTypes } = useGameTypes()
const { residents } = useMsgResidents()
const { user } = useAuth()
const toast = useToast()
const router = useRouter()

const myUrn = computed(() => {
  const claims = user.value
  if (!claims?.tenantId || !claims?.residentId) return null
  return formatUrn({ tenantId: claims.tenantId, module: 'app', resourceType: 'resident', id: claims.residentId })
})

const battleshipType = computed(() => gameTypes.value.find((g) => g.id === 'battleship'))
const supportsAlgorithm = computed(() => battleshipType.value?.supportedPlayerKinds.includes('MACHINE_ALGORITHM') ?? false)
const supportsAgent = computed(() => battleshipType.value?.supportedPlayerKinds.includes('MACHINE_AGENT') ?? false)

const opponentOptions = computed(() =>
  residents.value.filter((r) => r.urn !== myUrn.value).map((r) => ({ label: r.displayName || r.urn, value: r.urn })),
)

function opponentPlayer(game: GameSummary) {
  return game.players.find((p) => p.residentUrn !== myUrn.value) ?? game.players.find((p) => p.seat !== 1)
}

function opponentLabel(game: GameSummary): string {
  const opp = opponentPlayer(game)
  if (!opp) return '—'
  if (opp.playerKind === 'HUMAN') {
    const r = residents.value.find((res) => res.urn === opp.residentUrn)
    return r?.displayName || opp.residentUrn || 'Unknown player'
  }
  return opp.playerKind === 'MACHINE_ALGORITHM' ? 'Machine — algorithm' : 'Machine — agent'
}

function mySeat(game: GameSummary): number | null {
  return game.players.find((p) => p.residentUrn === myUrn.value)?.seat ?? null
}

const statusColor: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  LOBBY: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETE: 'success',
  ABANDONED: 'warning',
}

function relativeTime(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, size] of table) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

const columns: TableColumn<GameSummary>[] = [
  { id: 'opponent', header: 'Opponent' },
  { id: 'status', header: 'Status' },
  { id: 'turn', header: 'Turn' },
  { id: 'result', header: 'Result' },
  { accessorKey: 'eventCount', header: 'Events' },
  { id: 'started', header: 'Started' },
  { id: 'actions' },
]

// ---- New Game modal ----
const modalOpen = ref(false)
const opponentKind = ref<'human' | 'algorithm' | 'agent'>('human')
const selectedOpponent = ref<string | undefined>(undefined)
const starting = ref(false)

function openModal() {
  opponentKind.value = 'human'
  selectedOpponent.value = undefined
  modalOpen.value = true
}

async function startGame() {
  const kind: PlayerKind = opponentKind.value === 'human' ? 'HUMAN' : opponentKind.value === 'algorithm' ? 'MACHINE_ALGORITHM' : 'MACHINE_AGENT'
  if (kind === 'HUMAN' && !selectedOpponent.value) {
    toast.add({ title: 'Choose an opponent', color: 'error' })
    return
  }
  const player: NewGamePlayer = kind === 'HUMAN' ? { kind, residentUrn: selectedOpponent.value! } : { kind }
  starting.value = true
  try {
    const gameId = await createGame({ gameTypeId: 'battleship', players: [player] })
    toast.add({ title: 'Game started', color: 'success' })
    modalOpen.value = false
    router.push(`/games/battleship/${gameId}`)
  } catch (e) {
    toast.add({ title: 'Failed to start game', description: (e as Error).message, color: 'error' })
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <UCard class="max-w-5xl mx-auto">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-ship" class="size-5" />
          <h1 class="text-lg font-semibold">Battleship</h1>
        </div>
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-refresh-cw" variant="ghost" :loading="fetching" @click="refresh" />
          <UButton icon="i-lucide-plus" color="primary" @click="openModal">New Game</UButton>
        </div>
      </div>
    </template>

    <UAlert v-if="error" color="error" title="Failed to load games" class="mb-4" />

    <UEmpty
      v-if="!fetching && games.length === 0"
      icon="i-lucide-ship"
      title="No games yet"
      description="Start your first battleship game."
    >
      <UButton icon="i-lucide-plus" color="primary" @click="openModal">New Game</UButton>
    </UEmpty>

    <div v-else class="overflow-x-auto">
      <UTable :data="games" :columns="columns">
        <template #opponent-cell="{ row }">{{ opponentLabel(row.original) }}</template>
        <template #status-cell="{ row }">
          <UBadge :color="statusColor[row.original.status]">{{ row.original.status }}</UBadge>
        </template>
        <template #turn-cell="{ row }">
          <UBadge
            v-if="row.original.status === 'IN_PROGRESS'"
            :color="row.original.expectingSeats.includes(mySeat(row.original) ?? -1) ? 'primary' : 'neutral'"
          >
            {{ row.original.expectingSeats.includes(mySeat(row.original) ?? -1) ? 'Your turn' : 'Their turn' }}
          </UBadge>
          <span v-else>—</span>
        </template>
        <template #result-cell="{ row }">
          <UBadge v-if="row.original.status === 'COMPLETE'" :color="row.original.players.find((p) => p.seat === mySeat(row.original))?.outcome === 'WON' ? 'success' : 'error'">
            {{ row.original.players.find((p) => p.seat === mySeat(row.original))?.outcome === 'WON' ? 'Won' : 'Lost' }}
          </UBadge>
          <UBadge v-else-if="row.original.status === 'ABANDONED'" color="neutral">Abandoned</UBadge>
          <span v-else>—</span>
        </template>
        <template #started-cell="{ row }">{{ relativeTime(row.original.createdAt) }}</template>
        <template #actions-cell="{ row }">
          <UButton
            :to="`/games/battleship/${row.original.id}`"
            icon="i-lucide-arrow-right"
            color="primary"
            variant="ghost"
            size="sm"
            aria-label="Open game"
          >
            Open
          </UButton>
        </template>
      </UTable>
    </div>

    <UModal v-model:open="modalOpen" title="New Battleship Game">
      <template #body>
        <div class="flex flex-col gap-4">
          <URadioGroup
            v-model="opponentKind"
            :items="[
              { label: 'Another player', value: 'human' },
              ...(supportsAlgorithm ? [{ label: 'Machine — algorithm', value: 'algorithm' }] : []),
              ...(supportsAgent ? [{ label: 'Machine — agent', value: 'agent' }] : []),
            ]"
          />
          <USelectMenu
            v-if="opponentKind === 'human'"
            v-model="selectedOpponent"
            :items="opponentOptions"
            value-key="value"
            placeholder="Choose a player"
          />
        </div>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="modalOpen = false">Cancel</UButton>
        <UButton color="primary" :loading="starting" @click="startGame">Start Game</UButton>
      </template>
    </UModal>
  </UCard>
</template>
