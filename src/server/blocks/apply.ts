import type { ContextBlock } from '../llm/context-builder'
import type { BlockConfig, CustomBlockDefinition } from './schema'

/**
 * Evaluates a custom block definition into a ContextBlock.
 * Simple blocks use content as-is; script blocks execute the content as a function body.
 */
function evaluateCustomBlock(def: CustomBlockDefinition, scriptContext: object): ContextBlock | null {
  if (def.type === 'simple') {
    return {
      id: def.id,
      name: def.name,
      role: def.role,
      content: def.content,
      order: def.order,
      source: 'custom',
    }
  }

  // Script block: execute content as a function body with ctx parameter
  try {
    const fn = new Function('ctx', def.content)
    const result = fn(scriptContext)

    if (typeof result !== 'string' || result.trim() === '') return null

    return {
      id: def.id,
      name: def.name,
      role: def.role,
      content: result,
      order: def.order,
      source: 'custom',
    }
  } catch {
    // Script errors produce an error block so users can see what went wrong
    return {
      id: def.id,
      name: def.name,
      role: def.role,
      content: `[Script error in custom block "${def.name}"]`,
      order: def.order,
      source: 'custom',
    }
  }
}

/**
 * Applies block configuration to the default blocks:
 * 1. Evaluate + insert custom blocks
 * 2. Apply content overrides (override/prepend/append)
 * 3. Apply blockOrder ordering
 * 4. Apply individual order overrides
 * 5. Remove disabled blocks
 */
export function applyBlockConfig(
  blocks: ContextBlock[],
  config: BlockConfig,
  scriptContext: object,
): ContextBlock[] {
  let result = [...blocks]

  // 1. Evaluate and insert enabled custom blocks
  for (const def of config.customBlocks) {
    if (!def.enabled) continue
    // Check if override disables it
    const override = config.overrides[def.id]
    if (override?.enabled === false) continue

    const block = evaluateCustomBlock(def, scriptContext)
    if (block) {
      result.push(block)
    }
  }

  // 2. Apply content overrides to existing blocks
  result = result.map(block => {
    const override = config.overrides[block.id]
    if (!override?.contentMode || !override.customContent) return block

    let content: string
    switch (override.contentMode) {
      case 'override':
        content = override.customContent
        break
      case 'prepend':
        content = override.customContent + '\n' + block.content
        break
      case 'append':
        content = block.content + '\n' + override.customContent
        break
      default:
        return block
    }

    return { ...block, content }
  })

  // 3. Apply blockOrder ordering (position-based)
  if (config.blockOrder.length > 0) {
    const orderMap = new Map(config.blockOrder.map((id, i) => [id, i]))
    result = result.map(block => {
      const pos = orderMap.get(block.id)
      if (pos !== undefined) {
        return { ...block, order: pos }
      }
      return block
    })
  }

  // 4. Apply individual order overrides
  result = result.map(block => {
    const override = config.overrides[block.id]
    if (override?.order !== undefined) {
      return { ...block, order: override.order }
    }
    return block
  })

  // 5. Remove disabled blocks
  result = result.filter(block => {
    const override = config.overrides[block.id]
    if (override?.enabled === false) return false
    return true
  })

  return result
}
