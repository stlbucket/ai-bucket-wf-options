import { computed } from 'vue'
import type { Application } from '@function-bucket/fnb-types'
import { useAllApplicationsQuery } from '../generated/fnb-graphql-api'
import { toApplication } from '../mappers/application'

export function useSiteAdminApplications() {
  const { data, fetching, error } = useAllApplicationsQuery({ variables: {} })
  return {
    data: computed<Application[] | null>(() => {
      const apps = data.value?.applications
      if (!apps) return null
      return apps.map(toApplication)
    }),
    fetching,
    error,
  }
}
