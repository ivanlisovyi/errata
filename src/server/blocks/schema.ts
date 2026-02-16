import { z } from 'zod/v4'

export const BlockOverrideSchema = z.object({
  enabled: z.boolean().optional(),
  order: z.number().optional(),
  contentMode: z.enum(['override', 'prepend', 'append']).nullable().optional(),
  customContent: z.string().optional(),
})

export type BlockOverride = z.infer<typeof BlockOverrideSchema>

export const CustomBlockDefinitionSchema = z.object({
  id: z.string().regex(/^cb-[a-z0-9]{4,12}$/),
  name: z.string().min(1).max(100),
  role: z.enum(['system', 'user']),
  order: z.number().default(0),
  enabled: z.boolean().default(true),
  type: z.enum(['simple', 'script']),
  content: z.string(),
})

export type CustomBlockDefinition = z.infer<typeof CustomBlockDefinitionSchema>

export const BlockConfigSchema = z.object({
  customBlocks: z.array(CustomBlockDefinitionSchema).default([]),
  overrides: z.record(z.string(), BlockOverrideSchema).default({}),
  blockOrder: z.array(z.string()).default([]),
})

export type BlockConfig = z.infer<typeof BlockConfigSchema>
