import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BlockOverride, CustomBlockDefinition, BuiltinBlockMeta } from '@/lib/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Eye,
  Plus,
  Trash2,
} from 'lucide-react'
import { BlockCreateDialog } from './BlockCreateDialog'
import { BlockPreviewDialog } from './BlockPreviewDialog'

interface BlockEditorPanelProps {
  storyId: string
}

type MergedBlock = {
  id: string
  name: string
  role: 'system' | 'user'
  order: number
  source: 'builtin' | 'custom'
  enabled: boolean
  contentPreview: string
  // For custom blocks
  customDef?: CustomBlockDefinition
  // For builtin blocks
  override?: BlockOverride
}

function generateCustomBlockId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'cb-'
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

function BlurSaveTextarea({
  value,
  onSave,
  ...props
}: { value: string; onSave: (value: string) => void } & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'onBlur'>) {
  const [local, setLocal] = useState(value)
  const savedRef = useRef(value)

  useEffect(() => {
    setLocal(value)
    savedRef.current = value
  }, [value])

  return (
    <Textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== savedRef.current) {
          onSave(local)
        }
      }}
      {...props}
    />
  )
}

export function BlockEditorPanel({ storyId }: BlockEditorPanelProps) {
  const queryClient = useQueryClient()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['blocks', storyId],
    queryFn: () => api.blocks.get(storyId),
  })

  const configMutation = useMutation({
    mutationFn: (params: { overrides?: Record<string, BlockOverride>; blockOrder?: string[] }) =>
      api.blocks.updateConfig(storyId, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', storyId] })
    },
  })

  const createMutation = useMutation({
    mutationFn: (block: CustomBlockDefinition) =>
      api.blocks.createCustom(storyId, block),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', storyId] })
    },
  })

  const updateCustomMutation = useMutation({
    mutationFn: ({ blockId, updates }: { blockId: string; updates: Partial<Omit<CustomBlockDefinition, 'id'>> }) =>
      api.blocks.updateCustom(storyId, blockId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', storyId] })
    },
  })

  const deleteCustomMutation = useMutation({
    mutationFn: (blockId: string) =>
      api.blocks.deleteCustom(storyId, blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks', storyId] })
    },
  })

  // Merge builtin blocks and custom blocks into a unified sorted list
  const mergedBlocks = useMemo((): MergedBlock[] => {
    if (!data) return []

    const { config, builtinBlocks } = data
    const blockOrder = config.blockOrder
    const orderMap = new Map(blockOrder.map((id, i) => [id, i]))

    const blocks: MergedBlock[] = []

    // Add builtin blocks
    for (const b of builtinBlocks) {
      const override = config.overrides[b.id]
      blocks.push({
        id: b.id,
        name: b.id,
        role: b.role,
        order: orderMap.get(b.id) ?? b.order,
        source: 'builtin',
        enabled: override?.enabled !== false,
        contentPreview: b.contentPreview,
        override,
      })
    }

    // Add custom blocks
    for (const cb of config.customBlocks) {
      const override = config.overrides[cb.id]
      blocks.push({
        id: cb.id,
        name: cb.name,
        role: cb.role,
        order: orderMap.get(cb.id) ?? cb.order,
        source: 'custom',
        enabled: (override?.enabled !== false) && cb.enabled,
        contentPreview: cb.content.slice(0, 200),
        customDef: cb,
        override,
      })
    }

    // Sort: system blocks first sorted by order, then user blocks sorted by order
    blocks.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'system' ? -1 : 1
      return a.order - b.order
    })

    return blocks
  }, [data])

  const handleToggleEnabled = useCallback((blockId: string, currentEnabled: boolean) => {
    configMutation.mutate({
      overrides: { [blockId]: { enabled: !currentEnabled } },
    })
  }, [configMutation])

  const handleContentModeChange = useCallback((blockId: string, mode: 'override' | 'prepend' | 'append' | null) => {
    configMutation.mutate({
      overrides: { [blockId]: { contentMode: mode } },
    })
  }, [configMutation])

  const handleCustomContentChange = useCallback((blockId: string, content: string) => {
    configMutation.mutate({
      overrides: { [blockId]: { customContent: content } },
    })
  }, [configMutation])

  const handleCreateBlock = useCallback((blockData: {
    name: string
    role: 'system' | 'user'
    type: 'simple' | 'script'
    content: string
  }) => {
    const maxOrder = mergedBlocks.reduce((max, b) => Math.max(max, b.order), 0)
    createMutation.mutate({
      id: generateCustomBlockId(),
      name: blockData.name,
      role: blockData.role,
      order: maxOrder + 100,
      enabled: true,
      type: blockData.type,
      content: blockData.content,
    })
  }, [createMutation, mergedBlocks])

  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index
    setDragIndex(index)
  }, [])

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index
  }, [])

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      setDragIndex(null)
      return
    }

    const reordered = [...mergedBlocks]
    const [removed] = reordered.splice(dragItem.current, 1)
    reordered.splice(dragOverItem.current, 0, removed)

    const newOrder = reordered.map(b => b.id)
    configMutation.mutate({ blockOrder: newOrder })

    dragItem.current = null
    dragOverItem.current = null
    setDragIndex(null)
  }, [mergedBlocks, configMutation])

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading blocks...</div>
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Failed to load blocks</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground/60 leading-snug flex-1">
          Control the LLM context structure. Disable, reorder, or override blocks.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={() => setShowPreview(true)}
        >
          <Eye className="size-3" />
          Preview
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {mergedBlocks.map((block, index) => {
            const isExpanded = expandedId === block.id
            const isCustom = block.source === 'custom'

            return (
              <div key={block.id} className="rounded-md border border-border/30">
                {/* Block row */}
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`group flex items-center gap-1.5 px-2 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/30 ${
                    dragIndex === index ? 'opacity-50' : ''
                  } ${!block.enabled ? 'opacity-40' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : block.id)}
                >
                  <div className="shrink-0 cursor-grab opacity-40 group-hover:opacity-70" onClick={(e) => e.stopPropagation()}>
                    <GripVertical className="size-3.5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate leading-tight">{block.name}</p>
                  </div>

                  <Badge
                    variant="outline"
                    className={`text-[9px] h-3.5 px-1 shrink-0 ${
                      block.role === 'system'
                        ? 'bg-violet-500/10 text-violet-500 border-violet-500/20'
                        : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    }`}
                  >
                    {block.role}
                  </Badge>

                  {isCustom && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1 shrink-0">
                      custom
                    </Badge>
                  )}

                  <button
                    className={`shrink-0 size-5 rounded flex items-center justify-center text-xs transition-colors ${
                      block.enabled
                        ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleEnabled(block.id, block.enabled)
                    }}
                    title={block.enabled ? 'Enabled (click to disable)' : 'Disabled (click to enable)'}
                  >
                    {block.enabled ? '\u2713' : '\u2715'}
                  </button>

                  {isExpanded ? (
                    <ChevronDown className="size-3.5 text-muted-foreground/40 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/20 space-y-2">
                    {isCustom && block.customDef ? (
                      // Custom block editor
                      <>
                        <div className="flex gap-2 items-center">
                          <label className="text-[10px] text-muted-foreground/60 w-10">Type:</label>
                          <Badge variant="outline" className="text-[10px]">{block.customDef.type}</Badge>
                        </div>
                        <BlurSaveTextarea
                          value={block.customDef.content}
                          onSave={(val) => {
                            updateCustomMutation.mutate({
                              blockId: block.id,
                              updates: { content: val },
                            })
                          }}
                          className="font-mono text-xs min-h-[80px]"
                          rows={4}
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs gap-1"
                          onClick={() => deleteCustomMutation.mutate(block.id)}
                        >
                          <Trash2 className="size-3" />
                          Delete Block
                        </Button>
                      </>
                    ) : (
                      // Builtin block editor (override/prepend/append)
                      <>
                        <div className="text-[10px] text-muted-foreground/60 leading-snug">
                          <pre className="whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-[120px] overflow-y-auto border border-border/20">
                            {block.contentPreview}{block.contentPreview.length >= 200 ? '...' : ''}
                          </pre>
                        </div>

                        <div>
                          <label className="text-[10px] text-muted-foreground/60 mb-1 block">Content Mode</label>
                          <div className="flex gap-1">
                            {([null, 'prepend', 'append', 'override'] as const).map((mode) => (
                              <Button
                                key={mode ?? 'none'}
                                size="sm"
                                variant={(block.override?.contentMode ?? null) === mode ? 'default' : 'outline'}
                                className="h-6 text-[10px] px-2"
                                onClick={() => handleContentModeChange(block.id, mode)}
                              >
                                {mode ?? 'None'}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {block.override?.contentMode && (
                          <BlurSaveTextarea
                            value={block.override?.customContent ?? ''}
                            onSave={(val) => handleCustomContentChange(block.id, val)}
                            placeholder={`Content to ${block.override.contentMode}...`}
                            className="font-mono text-xs min-h-[60px]"
                            rows={3}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="p-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full h-8 text-xs gap-1"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="size-3" />
            Add Custom Block
          </Button>
        </div>
      </ScrollArea>

      <BlockCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateBlock}
      />

      <BlockPreviewDialog
        storyId={storyId}
        open={showPreview}
        onOpenChange={setShowPreview}
      />
    </div>
  )
}
