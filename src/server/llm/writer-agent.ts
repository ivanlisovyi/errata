import { ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai'

export function createWriterAgent(args: {
  model: LanguageModel
  tools: Record<string, unknown>
  maxSteps: number
}) {
  return new ToolLoopAgent({
    model: args.model,
    tools: args.tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(args.maxSteps),
  })
}
