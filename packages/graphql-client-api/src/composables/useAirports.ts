import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type {
  AirportType as FnbAirportType,
  Continent as FnbContinent,
} from '@function-bucket/fnb-types'
import { useAirportSyncStatusQuery, useSearchAirportsQuery } from '../generated/fnb-graphql-api'
import type { AirportType, Continent } from '../generated/fnb-graphql-api'
import { toAirport, toAirportSyncStatus } from '../mappers/airport'
import { useTriggerWorkflow } from './useTriggerWorkflow'

// composable view type (R4): the reactive search/filter/paging state the page binds to
export interface SearchAirportsOptions {
  searchText: string | null
  airportType: FnbAirportType | null
  continent: FnbContinent | null
  isoCountry: string | null
  isoRegion: string | null
  scheduledService: boolean | null // true = scheduled service only; null = all
  itemLimit: number
  pageOffset: number
}

const SYNC_POLL_MS = 10_000

export function useAirports() {
  const options: Ref<SearchAirportsOptions> = ref({
    searchText: null,
    airportType: null,
    continent: null,
    isoCountry: null,
    isoRegion: null,
    scheduledService: null,
    itemLimit: 25,
    pageOffset: 0,
  })

  const variables = computed(() => ({
    options: {
      searchText: options.value.searchText || null,
      airportType: (options.value.airportType as unknown as AirportType) ?? null,
      continent: (options.value.continent as unknown as Continent) ?? null,
      isoCountry: options.value.isoCountry || null,
      isoRegion: options.value.isoRegion || null,
      scheduledService: options.value.scheduledService,
      pagingOptions: {
        itemOffset: null,
        pageOffset: options.value.pageOffset,
        itemLimit: options.value.itemLimit,
      },
    },
  }))

  const { data, fetching, error, executeQuery } = useSearchAirportsQuery({ variables })
  const {
    data: statusData,
    error: statusError,
    executeQuery: executeStatusQuery,
  } = useAirportSyncStatusQuery()
  const { triggerWorkflow } = useTriggerWorkflow()

  const airports = computed(() =>
    (data.value?.searchAirportsList ?? [])
      .filter((a): a is NonNullable<typeof a> => a != null)
      .map(toAirport),
  )

  const syncStatus = computed(() => {
    const s = statusData.value?.airportSyncStatus
    return s ? toAirportSyncStatus(s) : null
  })

  function refreshSyncStatus() {
    executeStatusQuery({ requestPolicy: 'network-only' })
  }

  // throws on mutation error (page shows the error toast); on success re-polls status
  async function queueSync() {
    await triggerWorkflow('sync-airports', {})
    refreshSyncStatus()
  }

  // Poll status while a sync instance runs, then refresh the list once it finishes.
  // Lives here so the page stays transport-free (R1). Client-only — no SSR timers.
  if (typeof window !== 'undefined') {
    let timer: ReturnType<typeof setInterval> | null = null
    watch(
      () => syncStatus.value?.inProgress ?? false,
      (inProgress) => {
        if (inProgress && !timer) {
          timer = setInterval(refreshSyncStatus, SYNC_POLL_MS)
        } else if (!inProgress && timer) {
          clearInterval(timer)
          timer = null
          executeQuery({ requestPolicy: 'network-only' })
          refreshSyncStatus()
        }
      },
      { immediate: true },
    )
    onScopeDispose(() => {
      if (timer) clearInterval(timer)
    })
  }

  return {
    airports,
    fetching,
    error,
    statusError,
    options,
    syncStatus,
    queueSync,
    refreshSyncStatus,
  }
}
