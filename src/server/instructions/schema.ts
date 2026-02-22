import { z } from 'zod/v4'

export const InstructionSetSchema = z.object({
  name: z.string().min(1),
  modelMatch: z.string().min(1),
  priority: z.int().default(100),
  instructions: z.record(z.string(), z.string()),
})

export type InstructionSet = z.infer<typeof InstructionSetSchema>
