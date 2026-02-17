import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai'

export function createLibrarianChatAgent(args: {
  model: LanguageModel
  instructions: string
  tools: Record<string, unknown>
  maxSteps: number
}) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: args.instructions,
    tools: args.tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(args.maxSteps),
  })
}

export function createLibrarianRefineAgent(args: {
  model: LanguageModel
  instructions: string
  tools: Record<string, unknown>
  maxSteps: number
}) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: args.instructions,
    tools: args.tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(args.maxSteps),
  })
}

export function createLibrarianAnalyzeToolAgent(args: {
  model: LanguageModel
  instructions: string
  tools: Record<string, unknown>
  maxSteps?: number
}) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: args.instructions,
    tools: args.tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(args.maxSteps ?? 3),
  })
}
