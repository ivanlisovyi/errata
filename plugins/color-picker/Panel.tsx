import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import type { PluginPanelProps } from '@/lib/plugin-panels'

const COLOR_TAG_RE = /^color=#[0-9a-f]{6}$/

/**
 * Sidebar panel — lightweight companion to the toolbar button injected by
 * the runtime. Its main job is to bridge the runtime's custom events into
 * TanStack Query cache invalidation so the editor's TagsSection stays in
 * sync when the runtime adds/removes color tags.
 */
export function ColorPickerPanel({ storyId }: PluginPanelProps) {
  const queryClient = useQueryClient()
  const [fragmentId, setFragmentId] = useState<string | null>(null)

  // Listen for fragment changes from the runtime via panel hooks
  useEffect(() => {
    const handler = (e: Event) => {
      const { fragmentId: fid } = (e as CustomEvent).detail
      setFragmentId(fid ?? null)
    }
    window.addEventListener('errata:color-picker:fragment', handler)
    return () => window.removeEventListener('errata:color-picker:fragment', handler)
  }, [])

  // Listen for color changes from the runtime and invalidate query caches
  useEffect(() => {
    const handler = (e: Event) => {
      const { storyId: sid, fragmentId: fid } = (e as CustomEvent).detail
      queryClient.invalidateQueries({ queryKey: ['tags', sid, fid] })
      queryClient.invalidateQueries({ queryKey: ['fragment', sid, fid] })
    }
    window.addEventListener('errata:color-picker:changed', handler)
    return () => window.removeEventListener('errata:color-picker:changed', handler)
  }, [queryClient])

  // Fetch tags for the active fragment
  const { data: tagData } = useQuery({
    queryKey: ['tags', storyId, fragmentId],
    queryFn: async () => {
      const r = await fetch(`/api/stories/${storyId}/fragments/${fragmentId}/tags`)
      if (!r.ok) return { tags: [] as string[] }
      return r.json() as Promise<{ tags: string[] }>
    },
    enabled: !!fragmentId,
  })

  const tags: string[] = tagData?.tags ?? []
  const colorTag = tags.find((t) => COLOR_TAG_RE.test(t))
  const currentColor = colorTag ? colorTag.slice('color='.length) : null

  if (!fragmentId) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        <p>Open a fragment to see its color.</p>
        <p className="mt-1.5 text-[11px]">
          Use the <span className="font-medium text-foreground/70">Color</span> button in the
          fragment editor toolbar to pick a color.
        </p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2">
        {currentColor && (
          <div
            className="size-4 rounded-sm border border-border/50 shrink-0"
            style={{ background: currentColor }}
          />
        )}
        <span className="font-mono text-muted-foreground truncate">{fragmentId}</span>
        {currentColor && (
          <Badge variant="secondary" className="text-[10px] h-4 font-mono shrink-0">
            {currentColor}
          </Badge>
        )}
      </div>
      {!currentColor && (
        <p className="text-muted-foreground">No color assigned.</p>
      )}
    </div>
  )
}
