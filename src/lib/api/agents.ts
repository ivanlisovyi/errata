import { apiFetch } from './client'

export interface ActiveAgent {
  id: string
  storyId: string
  agentName: string
  startedAt: string
}

export const agents = {
  listActive: (storyId: string) =>
    apiFetch<ActiveAgent[]>(`/stories/${storyId}/active-agents`),
}
