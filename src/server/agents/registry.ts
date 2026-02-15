import type { AgentDefinition } from './types'

class AgentRegistry {
  private readonly definitions = new Map<string, AgentDefinition>()

  register(definition: AgentDefinition): void {
    this.definitions.set(definition.name, definition)
  }

  get(name: string): AgentDefinition | undefined {
    return this.definitions.get(name)
  }

  has(name: string): boolean {
    return this.definitions.has(name)
  }

  list(): AgentDefinition[] {
    return [...this.definitions.values()]
  }

  clear(): void {
    this.definitions.clear()
  }
}

export const agentRegistry = new AgentRegistry()
