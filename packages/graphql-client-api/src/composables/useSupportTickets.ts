import { computed } from 'vue'
import {
  useAllSupportTicketsQuery,
  useSupportTicketByIdQuery,
  useSubmitSupportTicketMutation,
  useCloseSupportTicketMutation,
  useReopenSupportTicketMutation,
  useDeleteSupportTicketMutation,
  useParkSupportTicketMutation,
  useMarkDuplicateSupportTicketMutation,
  useSubmitSupportTicketCommentMutation,
} from '../generated/fnb-graphql-api'
import { toSupportTicket, toSupportTicketComment } from '../mappers/support-ticket'

export function useSupportTickets() {
  const { data, fetching, error, executeQuery } = useAllSupportTicketsQuery()
  const { executeMutation: execSubmit } = useSubmitSupportTicketMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const tickets = computed(() =>
    (data.value?.tickets ?? [])
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map(toSupportTicket),
  )

  async function submitTicket(title: string, description: string): Promise<string> {
    const result = await execSubmit({ title, description })
    if (result.error) throw result.error
    const id = result.data?.submitSupportTicket?.uuid
    if (!id) throw new Error('No ticket id returned')
    return String(id)
  }

  return { tickets, fetching, error, refresh, submitTicket }
}

export function useSupportTicket(id: string) {
  const { data, fetching, error, executeQuery } = useSupportTicketByIdQuery({ variables: { id } })
  const { executeMutation: execClose } = useCloseSupportTicketMutation()
  const { executeMutation: execReopen } = useReopenSupportTicketMutation()
  const { executeMutation: execDelete } = useDeleteSupportTicketMutation()
  const { executeMutation: execPark } = useParkSupportTicketMutation()
  const { executeMutation: execMarkDuplicate } = useMarkDuplicateSupportTicketMutation()
  const { executeMutation: execComment } = useSubmitSupportTicketCommentMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const ticket = computed(() => {
    const t = data.value?.supportTicket
    return t ? toSupportTicket(t) : null
  })

  const comments = computed(() =>
    (data.value?.supportTicket?.supportTicketCommentsList ?? [])
      .filter((c): c is NonNullable<typeof c> => c != null)
      .map(toSupportTicketComment),
  )

  async function closeTicket() {
    const result = await execClose({ ticketId: id })
    if (result.error) throw result.error
    refresh()
  }

  async function reopenTicket() {
    const result = await execReopen({ ticketId: id })
    if (result.error) throw result.error
    refresh()
  }

  async function deleteTicket() {
    const result = await execDelete({ ticketId: id })
    if (result.error) throw result.error
    refresh()
  }

  async function parkTicket() {
    const result = await execPark({ ticketId: id })
    if (result.error) throw result.error
    refresh()
  }

  async function markDuplicateTicket() {
    const result = await execMarkDuplicate({ ticketId: id })
    if (result.error) throw result.error
    refresh()
  }

  async function addComment(body: string) {
    const result = await execComment({ ticketId: id, body })
    if (result.error) throw result.error
    refresh()
  }

  return {
    ticket,
    comments,
    fetching,
    error,
    refresh,
    closeTicket,
    reopenTicket,
    deleteTicket,
    parkTicket,
    markDuplicateTicket,
    addComment,
  }
}
