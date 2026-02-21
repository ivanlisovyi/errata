import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Textarea } from '@/components/ui/textarea'
import {
  ChevronDown,
  ChevronRight,
  Check,
  BookOpen,
  Copy,
  Loader2,
} from 'lucide-react'
import { componentId } from '@/lib/dom-ids'

export function ScriptBlockEditor({
  storyId,
  blockId,
  value,
  onSave,
}: {
  storyId: string
  blockId: string
  value: string
  onSave: (value: string) => void
}) {
  const [local, setLocal] = useState(value)
  const savedRef = useRef(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [evalResult, setEvalResult] = useState<{ result: string | null; error: string | null } | null>(null)
  const [evalLoading, setEvalLoading] = useState(false)
  const requestIdRef = useRef(0)

  useEffect(() => {
    setLocal(value)
    savedRef.current = value
  }, [value])

  // Debounced eval
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!local.trim()) {
      setEvalResult(null)
      setEvalLoading(false)
      return
    }
    setEvalLoading(true)
    const id = ++requestIdRef.current
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.blocks.evalScript(storyId, local)
        if (id === requestIdRef.current) {
          setEvalResult(res)
          setEvalLoading(false)
        }
      } catch {
        if (id === requestIdRef.current) {
          setEvalResult({ result: null, error: 'Failed to evaluate script' })
          setEvalLoading(false)
        }
      }
    }, 600)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [local, storyId])

  return (
    <div className="space-y-2">
      <Textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== savedRef.current) {
            onSave(local)
          }
        }}
        className="text-xs min-h-[80px] resize-y border-border/30 focus:border-border/60 font-mono bg-muted/20"
        rows={4}
        placeholder="return `...`"
        data-component-id={componentId('block', blockId, 'content')}
      />

      {/* Live output preview */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9px] text-muted-foreground uppercase tracking-[0.15em] font-medium">Output</span>
          {evalLoading && <Loader2 className="size-2.5 text-muted-foreground animate-spin" />}
        </div>
        {evalResult?.error ? (
          <pre className="whitespace-pre-wrap text-[11px] text-red-400 bg-red-500/5 rounded-md p-2.5 border border-red-500/10 leading-relaxed">
            {evalResult.error}
          </pre>
        ) : evalResult?.result ? (
          <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground bg-muted/15 rounded-md p-2.5 max-h-[120px] overflow-y-auto border border-border/15 leading-relaxed">
            {evalResult.result}
          </pre>
        ) : !evalLoading && local.trim() ? (
          <p className="text-[10px] text-muted-foreground/50 italic px-1">(no output)</p>
        ) : null}
      </div>
    </div>
  )
}

export function FragmentReference({ storyId }: { storyId: string }) {
  const [open, setOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const { data: fragments } = useQuery({
    queryKey: ['fragments', storyId],
    queryFn: () => api.fragments.list(storyId),
    enabled: open,
  })

  const grouped = useMemo(() => {
    if (!fragments) return new Map<string, Array<{ id: string; name: string }>>()
    const map = new Map<string, Array<{ id: string; name: string }>>()
    for (const f of fragments) {
      const list = map.get(f.type) ?? []
      list.push({ id: f.id, name: f.name })
      map.set(f.type, list)
    }
    return map
  }, [fragments])

  const handleCopy = useCallback((id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1200)
  }, [])

  return (
    <div>
      <button
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground/70 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <BookOpen className="size-3" />
        <span className="font-medium">Fragment Reference</span>
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border/20 bg-muted/10 p-2 max-h-[200px] overflow-y-auto space-y-2">
          {!fragments ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="size-3 text-muted-foreground animate-spin" />
            </div>
          ) : grouped.size === 0 ? (
            <p className="text-[10px] text-muted-foreground/50 italic text-center py-2">No fragments</p>
          ) : (
            Array.from(grouped.entries()).map(([type, items]) => (
              <div key={type}>
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] font-medium mb-1">{type}</p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group/ref px-1 py-0.5 rounded hover:bg-muted/30">
                      <button
                        className="flex items-center gap-1 shrink-0"
                        onClick={() => handleCopy(item.id)}
                        title="Copy ID"
                      >
                        <code className="text-[10px] font-mono text-primary/70">{item.id}</code>
                        {copiedId === item.id ? (
                          <Check className="size-2.5 text-emerald-500" />
                        ) : (
                          <Copy className="size-2.5 text-muted-foreground/40 opacity-0 group-hover/ref:opacity-100 transition-opacity" />
                        )}
                      </button>
                      <span className="text-[10px] text-muted-foreground truncate">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
