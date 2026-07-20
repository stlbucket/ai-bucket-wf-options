<script setup lang="ts">
import type { BattleshipPlayerView } from '@function-bucket/fnb-types'
import { formatUrn } from '@function-bucket/fnb-types'
import BattleshipBoard from '~/components/games/BattleshipBoard.vue'

// battleship-[id].ui.md / battleship-[id].data.md
const route = useRoute()
const router = useRouter()
const gameId = computed(() => String(route.params.id))
const { user } = useAuth()
const { residents } = useMsgResidents()
const toast = useToast()

const myUrn = computed(() => {
  const claims = user.value
  if (!claims?.tenantId || !claims?.residentId) return null
  return formatUrn({ tenantId: claims.tenantId, module: 'app', resourceType: 'resident', id: claims.residentId })
})

const {
  game,
  view,
  mySeat,
  isExpectingMe,
  myOutcome,
  fetching,
  error,
  submitting,
  submitEvent,
  resign,
  replayEvent,
  isReplaying,
  stepBack,
  stepForward,
  goLive,
  lastEvents,
} = useGame(gameId, myUrn)

watch(lastEvents, (events) => {
  for (const e of events) {
    toast.add({ title: e.message, color: e.kind === 'miss' ? 'neutral' : e.kind === 'sunk' ? 'success' : 'error' })
  }
})

const opponent = computed(() => game.value?.players.find((p) => p.seat !== mySeat.value))
const opponentLabel = computed(() => {
  const opp = opponent.value
  if (!opp) return 'Machine'
  if (opp.playerKind === 'HUMAN') {
    const r = residents.value.find((res) => res.urn === opp.residentUrn)
    return r?.displayName || 'Opponent'
  }
  return opp.playerKind === 'MACHINE_ALGORITHM' ? 'Machine — algorithm' : 'Machine — agent'
})

const statusColor: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  LOBBY: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETE: 'success',
  ABANDONED: 'warning',
}

const battleView = computed(() => view.value as BattleshipPlayerView | null)
const scrubberPosition = computed(() => replayEvent.value ?? game.value?.eventCount ?? 0)

const resignModalOpen = ref(false)
async function confirmResign() {
  resignModalOpen.value = false
  try {
    await resign()
  } catch (e) {
    toast.add({ title: 'Failed to resign', description: (e as Error).message, color: 'error' })
  }
}

async function onFire(cell: { row: number; col: number }) {
  try {
    await submitEvent(cell)
  } catch (e) {
    toast.add({ title: 'Move rejected', description: (e as Error).message, color: 'error' })
  }
}
</script>

<template>
  <UCard class="max-w-3xl mx-auto">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-arrow-left" variant="ghost" @click="router.push('/games/battleship')" />
          <h1 class="text-lg font-semibold">Battleship vs {{ opponentLabel }}</h1>
          <UBadge v-if="game" :color="statusColor[game.status]">{{ game.status }}</UBadge>
        </div>
        <UButton
          v-if="game?.status === 'IN_PROGRESS'"
          color="error"
          variant="outline"
          @click="resignModalOpen = true"
        >
          Resign
        </UButton>
      </div>
    </template>

    <UAlert v-if="error" color="error" title="Failed to load game" class="mb-4" />

    <template v-if="game">
      <div v-if="game.status === 'LOBBY'" class="mb-4 text-sm text-muted">Placing fleets…</div>
      <div v-else-if="game.status === 'IN_PROGRESS'" class="mb-4 flex items-center gap-2 text-sm">
        <template v-if="isReplaying">
          <span class="text-muted">Replaying — event {{ replayEvent }}</span>
        </template>
        <template v-else-if="isExpectingMe">
          <span class="text-primary font-medium">Your turn — fire at the enemy grid</span>
        </template>
        <template v-else>
          <span class="text-muted animate-pulse">Waiting for {{ opponentLabel }}…</span>
        </template>
      </div>

      <UAlert
        v-if="game.status === 'COMPLETE'"
        :color="myOutcome === 'WON' ? 'success' : 'error'"
        :title="myOutcome === 'WON' ? 'Victory — you sank their fleet' : 'Defeat — your fleet was sunk'"
        class="mb-4"
      />
      <UAlert v-else-if="game.status === 'ABANDONED'" color="warning" title="Game abandoned" class="mb-4" />

      <div v-if="game.eventCount > 0" class="mb-4 flex items-center gap-2">
        <UButton icon="i-lucide-chevron-left" variant="ghost" size="sm" @click="stepBack" />
        <span class="text-xs text-muted">event {{ scrubberPosition }} / {{ game.eventCount }}</span>
        <UButton icon="i-lucide-chevron-right" variant="ghost" size="sm" @click="stepForward" />
        <UButton icon="i-lucide-radio" size="sm" :color="isReplaying ? 'primary' : 'neutral'" :disabled="!isReplaying" @click="goLive">
          Live
        </UButton>
      </div>

      <div v-if="battleView" class="flex flex-wrap gap-6">
        <div>
          <h2 class="mb-2 text-sm font-medium">Enemy waters</h2>
          <BattleshipBoard
            :board="battleView.opponent.board"
            mode="target"
            :interactive="game.status === 'IN_PROGRESS' && isExpectingMe && !isReplaying"
            :board-size="battleView.boardSize"
            @fire="onFire"
          />
          <ul v-if="battleView.opponent.sunkShips.length" class="mt-2 text-xs text-muted">
            <li v-for="ship in battleView.opponent.sunkShips" :key="ship.name">Sunk: {{ ship.name }}</li>
          </ul>
        </div>
        <div>
          <h2 class="mb-2 text-sm font-medium">Your fleet</h2>
          <BattleshipBoard :board="battleView.you.board" mode="own" :interactive="false" :board-size="battleView.boardSize" />
          <ul class="mt-2 text-xs">
            <li
              v-for="fleet in battleView.you.fleet"
              :key="fleet.name"
              :class="{ 'line-through text-muted': fleet.sunk }"
            >
              {{ fleet.name }} ({{ fleet.hitCount }}/{{ fleet.size }})
            </li>
          </ul>
        </div>
      </div>
    </template>

    <UModal v-model:open="resignModalOpen" title="Resign this game?">
      <template #body>
        <p>Your opponent wins.</p>
      </template>
      <template #footer>
        <UButton variant="ghost" @click="resignModalOpen = false">Cancel</UButton>
        <UButton color="error" @click="confirmResign">Resign</UButton>
      </template>
    </UModal>
  </UCard>
</template>
