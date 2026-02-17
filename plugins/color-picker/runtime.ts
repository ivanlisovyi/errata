import type { PanelEvent, PluginRuntimeContext } from '@/lib/plugin-panels'

const COLOR_TAG_RE = /^color=#[0-9a-f]{6}$/

const PRESETS = [
  '#ef4444', '#dc2626', '#f97316', '#ea580c',
  '#eab308', '#ca8a04', '#22c55e', '#16a34a',
  '#06b6d4', '#0891b2', '#3b82f6', '#2563eb',
  '#8b5cf6', '#7c3aed', '#ec4899', '#db2777',
  '#f5f5f4', '#a8a29e', '#78716c', '#292524',
]

const MARKER = 'data-color-picker-btn'
const POLL_MS = 400

let interval: ReturnType<typeof setInterval> | null = null
let btnEl: HTMLButtonElement | null = null
let popoverEl: HTMLDivElement | null = null
let outsideHandler: ((e: MouseEvent) => void) | null = null
let escHandler: ((e: KeyboardEvent) => void) | null = null
let trackedFragmentId: string | null = null
let cachedTags: string[] = []
let hookFragmentId: string | null = null
let hookStoryId: string | null = null

// ── Helpers ──────────────────────────────────────────────

function storyId(): string | null {
  return window.location.pathname.match(/^\/story\/([^/]+)/)?.[1] ?? null
}

function fragmentId(): string | null {
  if (hookFragmentId) return hookFragmentId
  const el = document.querySelector('[data-component-id$="-sticky-toggle"]')
  if (!el) return null
  const cid = el.getAttribute('data-component-id') ?? ''
  return cid.replace(/-sticky-toggle$/, '') || null
}

function colorFromTags(tags: string[]): string | null {
  const t = tags.find((s) => COLOR_TAG_RE.test(s))
  return t ? t.slice('color='.length) : null
}

// ── API ──────────────────────────────────────────────────

async function fetchTags(sid: string, fid: string): Promise<string[]> {
  try {
    const r = await fetch(`/api/stories/${sid}/fragments/${fid}/tags`)
    if (!r.ok) return []
    const d = await r.json()
    return d.tags ?? []
  } catch {
    return []
  }
}

async function apiAddTag(sid: string, fid: string, tag: string) {
  await fetch(`/api/stories/${sid}/fragments/${fid}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  })
}

async function apiRemoveTag(sid: string, fid: string, tag: string) {
  await fetch(`/api/stories/${sid}/fragments/${fid}/tags`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  })
}

function notifyChanged(sid: string, fid: string) {
  window.dispatchEvent(
    new CustomEvent('errata:plugin:invalidate', {
      detail: { queryKeys: [['tags', sid, fid], ['fragment', sid, fid]] },
    }),
  )
  window.dispatchEvent(
    new CustomEvent('errata:color-picker:changed', { detail: { storyId: sid, fragmentId: fid } }),
  )
}

// ── Color operations ─────────────────────────────────────

async function applyColor(color: string) {
  const sid = storyId()
  const fid = trackedFragmentId
  if (!sid || !fid) return

  const existing = cachedTags.find((t) => COLOR_TAG_RE.test(t))
  if (existing) await apiRemoveTag(sid, fid, existing)
  const newTag = `color=${color.toLowerCase()}`
  await apiAddTag(sid, fid, newTag)

  cachedTags = cachedTags.filter((t) => !COLOR_TAG_RE.test(t))
  cachedTags.push(newTag)
  updateSwatch(color.toLowerCase())
  notifyChanged(sid, fid)
}

async function removeColor() {
  const sid = storyId()
  const fid = trackedFragmentId
  if (!sid || !fid) return

  const existing = cachedTags.find((t) => COLOR_TAG_RE.test(t))
  if (existing) await apiRemoveTag(sid, fid, existing)

  cachedTags = cachedTags.filter((t) => !COLOR_TAG_RE.test(t))
  updateSwatch(null)
  hidePopover()
  notifyChanged(sid, fid)
}

// ── Swatch on the toolbar button ─────────────────────────

function updateSwatch(color: string | null) {
  if (!btnEl) return
  const swatch = btnEl.querySelector<HTMLSpanElement>('[data-swatch]')
  if (swatch) {
    swatch.style.background = color ?? 'transparent'
    swatch.style.borderStyle = color ? 'solid' : 'dashed'
  }
}

// ── Popover ──────────────────────────────────────────────

function hidePopover() {
  if (popoverEl) {
    popoverEl.remove()
    popoverEl = null
  }
  if (outsideHandler) {
    document.removeEventListener('mousedown', outsideHandler)
    outsideHandler = null
  }
  if (escHandler) {
    document.removeEventListener('keydown', escHandler)
    escHandler = null
  }
}

function showPopover() {
  if (popoverEl || !btnEl) return

  const rect = btnEl.getBoundingClientRect()
  const pop = document.createElement('div')
  popoverEl = pop

  Object.assign(pop.style, {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    zIndex: '50',
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '10px',
    boxShadow: '0 8px 30px rgba(0,0,0,.18)',
    minWidth: '196px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as CSSStyleDeclaration)

  // ─ Preset swatches ─
  const grid = document.createElement('div')
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: '4px',
  })

  const currentColor = colorFromTags(cachedTags)

  for (const c of PRESETS) {
    const sw = document.createElement('button')
    sw.type = 'button'
    sw.title = c
    Object.assign(sw.style, {
      width: '16px',
      height: '16px',
      borderRadius: '3px',
      border: currentColor === c ? '2px solid var(--primary)' : '1px solid var(--border)',
      background: c,
      cursor: 'pointer',
      padding: '0',
      transition: 'transform 120ms',
    })
    sw.addEventListener('mouseenter', () => { sw.style.transform = 'scale(1.2)' })
    sw.addEventListener('mouseleave', () => { sw.style.transform = 'scale(1)' })
    sw.addEventListener('click', () => {
      void applyColor(c)
      hidePopover()
    })
    grid.appendChild(sw)
  }
  pop.appendChild(grid)

  // ─ Separator ─
  const sep = document.createElement('div')
  Object.assign(sep.style, { height: '1px', background: 'var(--border)' })
  pop.appendChild(sep)

  // ─ Custom color row ─
  const customRow = document.createElement('div')
  Object.assign(customRow.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  })

  const colorInput = document.createElement('input')
  colorInput.type = 'color'
  colorInput.value = currentColor ?? '#6b7280'
  Object.assign(colorInput.style, {
    width: '28px',
    height: '28px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    padding: '2px',
    background: 'transparent',
    flexShrink: '0',
  })

  const hexInput = document.createElement('input')
  hexInput.type = 'text'
  hexInput.value = currentColor ?? '#6b7280'
  hexInput.placeholder = '#aabbcc'
  Object.assign(hexInput.style, {
    flex: '1',
    height: '28px',
    padding: '0 6px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    minWidth: '0',
  })

  const setBtn = document.createElement('button')
  setBtn.type = 'button'
  setBtn.textContent = 'Set'
  Object.assign(setBtn.style, {
    height: '28px',
    padding: '0 10px',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    background: 'transparent',
    color: 'inherit',
    fontSize: '11px',
    cursor: 'pointer',
    flexShrink: '0',
  })
  setBtn.addEventListener('mouseenter', () => { setBtn.style.background = 'var(--accent)' })
  setBtn.addEventListener('mouseleave', () => { setBtn.style.background = 'transparent' })

  // Sync native picker → hex input
  colorInput.addEventListener('input', () => {
    hexInput.value = colorInput.value
  })
  // Apply on native picker close (change event)
  colorInput.addEventListener('change', () => {
    void applyColor(colorInput.value)
    hidePopover()
  })

  // Apply on Set click or Enter in hex input
  const commitHex = () => {
    const v = hexInput.value.trim().toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(v)) {
      void applyColor(v)
      hidePopover()
    }
  }
  setBtn.addEventListener('click', commitHex)
  hexInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitHex() }
    if (e.key === 'Escape') { e.preventDefault(); hidePopover() }
  })

  customRow.appendChild(colorInput)
  customRow.appendChild(hexInput)
  customRow.appendChild(setBtn)
  pop.appendChild(customRow)

  // ─ Remove button (only if a color is set) ─
  if (currentColor) {
    const removeBtn = document.createElement('button')
    removeBtn.type = 'button'
    removeBtn.textContent = 'Remove color'
    Object.assign(removeBtn.style, {
      border: 'none',
      background: 'transparent',
      color: 'var(--muted-foreground)',
      fontSize: '11px',
      cursor: 'pointer',
      padding: '2px 0',
      textAlign: 'left',
    })
    removeBtn.addEventListener('mouseenter', () => { removeBtn.style.color = 'var(--destructive)' })
    removeBtn.addEventListener('mouseleave', () => { removeBtn.style.color = 'var(--muted-foreground)' })
    removeBtn.addEventListener('click', () => void removeColor())
    pop.appendChild(removeBtn)
  }

  document.body.appendChild(pop)

  // ─ Close handlers ─
  outsideHandler = (e: MouseEvent) => {
    if (!popoverEl?.contains(e.target as Node) && !btnEl?.contains(e.target as Node)) {
      hidePopover()
    }
  }
  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hidePopover()
  }
  // Small delay so the click that opened the popover doesn't immediately close it
  requestAnimationFrame(() => {
    document.addEventListener('mousedown', outsideHandler!)
    document.addEventListener('keydown', escHandler!)
  })
}

// ── Button creation ──────────────────────────────────────

function createButton(): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = 'Set fragment color'
  btn.setAttribute(MARKER, 'true')
  Object.assign(btn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    height: '28px',
    padding: '0 8px',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    transition: 'background 120ms',
    flexShrink: '0',
  })

  const swatch = document.createElement('span')
  swatch.setAttribute('data-swatch', 'true')
  Object.assign(swatch.style, {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
    border: '1.5px dashed var(--border)',
    background: 'transparent',
    flexShrink: '0',
    transition: 'background 120ms, border 120ms',
  })

  const label = document.createElement('span')
  label.textContent = 'Color'

  btn.appendChild(swatch)
  btn.appendChild(label)

  btn.addEventListener('mouseenter', () => { btn.style.background = 'var(--accent)' })
  btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent' })
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (popoverEl) hidePopover()
    else showPopover()
  })

  return btn
}

// ── Injection ────────────────────────────────────────────

function inject(sid: string, fid: string) {
  const closeBtn = document.querySelector<HTMLElement>('[data-component-id="fragment-editor-close"]')
  if (!closeBtn?.parentElement) return

  trackedFragmentId = fid
  btnEl = createButton()
  closeBtn.parentElement.insertBefore(btnEl, closeBtn)

  // Fetch tags and set initial swatch color
  void fetchTags(sid, fid).then((tags) => {
    cachedTags = tags
    updateSwatch(colorFromTags(tags))
  })
}

function cleanup() {
  hidePopover()
  if (btnEl) {
    btnEl.remove()
    btnEl = null
  }
  trackedFragmentId = null
  cachedTags = []
}

// ── Poll loop ────────────────────────────────────────────

function tick() {
  const editorRoot = document.querySelector('[data-component-id="fragment-editor-root"]')
  const fid = fragmentId()
  const sid = storyId()

  if (!editorRoot || !fid || !sid) {
    if (btnEl) cleanup()
    return
  }

  // Already injected for this fragment and button is still in DOM
  if (btnEl && trackedFragmentId === fid && btnEl.isConnected) return

  // Fragment changed or button was removed — re-inject
  cleanup()
  inject(sid, fid)
}

// ── Panel hooks ───────────────────────────────────────────

export function onPanelOpen(event: PanelEvent, context: PluginRuntimeContext) {
  if (event.panel !== 'fragment-editor') return
  hookStoryId = context.storyId
  hookFragmentId = event.fragment?.id ?? null
  window.dispatchEvent(
    new CustomEvent('errata:color-picker:fragment', {
      detail: { fragmentId: hookFragmentId, storyId: hookStoryId },
    }),
  )
  // Pre-fetch tags so the button has the swatch color immediately
  if (hookStoryId && hookFragmentId) {
    void fetchTags(hookStoryId, hookFragmentId).then((tags) => {
      if (trackedFragmentId === hookFragmentId) {
        cachedTags = tags
        updateSwatch(colorFromTags(tags))
      }
    })
  }
}

export function onPanelClose(event: PanelEvent, _context: PluginRuntimeContext) {
  if (event.panel !== 'fragment-editor') return
  hookFragmentId = null
  hookStoryId = null
  cleanup()
  window.dispatchEvent(
    new CustomEvent('errata:color-picker:fragment', {
      detail: { fragmentId: null, storyId: null },
    }),
  )
}

// ── Public start/stop ────────────────────────────────────

export function startColorPickerRuntime() {
  if (interval || typeof window === 'undefined') return
  interval = setInterval(tick, POLL_MS)
}

export function stopColorPickerRuntime() {
  if (typeof window === 'undefined') return
  if (interval) {
    clearInterval(interval)
    interval = null
  }
  cleanup()
}
