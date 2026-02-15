import { registerLibrarianAgents } from '../librarian/agents'

let registered = false

export function ensureCoreAgentsRegistered(): void {
  if (registered) return
  registerLibrarianAgents()
  registered = true
}
