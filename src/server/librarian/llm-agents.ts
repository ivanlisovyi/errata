import { Output, ToolLoopAgent, stepCountIs, type LanguageModel } from 'ai'
import { z } from 'zod/v4'

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

export function createLibrarianAnalyzeStructuredAgent(args: {
  model: LanguageModel
  instructions: string
  schema: z.ZodTypeAny
}) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: args.instructions,
    output: Output.object({ schema: args.schema }),
    stopWhen: stepCountIs(1),
  })
}

export function createLibrarianAnalyzeJsonAgent(args: {
  model: LanguageModel
  instructions: string
}) {
  return new ToolLoopAgent({
    model: args.model,
    instructions: args.instructions,
    stopWhen: stepCountIs(1),
  })
}
