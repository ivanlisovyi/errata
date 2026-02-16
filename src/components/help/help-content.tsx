import type { ReactNode } from 'react'

export interface HelpSubsection {
  id: string
  title: string
  content: ReactNode
}

export interface HelpSection {
  id: string
  title: string
  description: string
  subsections: HelpSubsection[]
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-border/40 bg-muted/40 text-[10px] font-mono font-medium text-foreground/60 leading-none">
      {children}
    </kbd>
  )
}

function ToolCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-md border border-border/25 bg-accent/15 px-3 py-2.5 mb-2 last:mb-0">
      <code className="text-[11.5px] font-mono font-medium text-primary/80">{name}</code>
      <p className="text-[11.5px] text-muted-foreground/60 mt-0.5 leading-snug">{description}</p>
    </div>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-primary/25 pl-3 py-1.5 my-2.5">
      <p className="text-[11.5px] text-foreground/55 leading-relaxed italic">{children}</p>
    </div>
  )
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[12.5px] text-foreground/65 leading-relaxed mb-2.5 last:mb-0">{children}</p>
}

function Mono({ children }: { children: ReactNode }) {
  return <code className="text-[11px] font-mono text-primary/70 bg-primary/5 px-1 py-0.5 rounded">{children}</code>
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'generation',
    title: 'Generation',
    description: 'How Errata generates prose continuations using your fragments and LLM tools.',
    subsections: [
      {
        id: 'overview',
        title: 'How it works',
        content: (
          <>
            <P>
              When you generate, Errata assembles your story context — prose history, sticky fragments,
              and shortlists — into a prompt, then streams a continuation from the LLM.
            </P>
            <P>
              The pipeline follows this sequence: your author input is combined with the story context,
              plugin hooks run (if any), the LLM generates text using available tools, and the output
              is streamed back to you in real time.
            </P>
            <Tip>
              The LLM sees your sticky fragments in full and non-sticky fragments as one-line shortlists.
              Use the <Mono>sticky</Mono> toggle on fragments to control what the model always sees.
            </Tip>
          </>
        ),
      },
      {
        id: 'context-building',
        title: 'Context building',
        content: (
          <>
            <P>
              When you hit Generate, Errata assembles a prompt from your story's fragments and sends
              it to the LLM. This happens in a specific sequence — understanding it helps you control
              what the model sees and how it writes.
            </P>

            <div className="mt-3 mb-3">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">The pipeline</p>
              <div className="space-y-1.5">
                {[
                  ['1', 'Load fragments', 'All fragments are loaded and sorted by type — prose, guidelines, characters, knowledge.'],
                  ['2', 'Apply context limit', 'Recent prose is selected from the chain based on your Context Limit setting (fragment count, token budget, or character budget).'],
                  ['3', 'Split sticky / non-sticky', 'Sticky fragments go in full. Non-sticky become one-line shortlist entries (ID, name, description).'],
                  ['4', 'Plugin beforeContext hooks', 'Enabled plugins can modify the context state — adding, removing, or reordering fragments before they\'re rendered.'],
                  ['5', 'Assemble messages', 'Everything is rendered into a system message and a user message.'],
                  ['6', 'Plugin beforeGeneration hooks', 'Plugins get a final chance to modify the assembled messages before they\'re sent.'],
                  ['7', 'Stream to LLM', 'The prompt is sent. The model can call tools (if enabled) to look up fragments, then writes prose.'],
                  ['8', 'Save & analyze', 'Output is saved as a new prose fragment, plugin afterGeneration/afterSave hooks run, and the librarian is triggered.'],
                ].map(([num, label, desc]) => (
                  <div key={num} className="flex gap-2.5 items-start">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-foreground/8 text-[9px] font-mono font-bold text-foreground/40 flex items-center justify-center mt-0.5">{num}</span>
                    <div className="min-w-0">
                      <span className="text-[12px] font-medium text-foreground/70">{label}</span>
                      <p className="text-[11px] text-muted-foreground/50 leading-snug">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 mb-1">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">What the model sees</p>
            </div>
            <P>
              The final prompt is two messages. The <strong className="text-foreground/75">system message</strong> contains
              writing instructions, the list of available tools, and any sticky fragments placed
              in <Mono>system</Mono> position. The <strong className="text-foreground/75">user message</strong> contains,
              in order:
            </P>
            <div className="rounded-md border border-border/25 bg-accent/10 px-3 py-2.5 mb-2.5 space-y-0.5">
              {[
                'Story name and description',
                'Rolling summary (maintained by the librarian)',
                'Sticky fragments (user-placed) — full content',
                'Non-sticky shortlists — one-line per fragment',
                'Recent prose from the chain (context-limited)',
                'Your author input',
              ].map((item, i) => (
                <p key={i} className="text-[11.5px] text-foreground/55 leading-snug">
                  <span className="text-muted-foreground/30 mr-1.5">{i + 1}.</span>{item}
                </p>
              ))}
            </div>

            <Tip>
              Use the Debug panel to see exactly what was sent for any generation — the Prompt tab
              shows both messages in full.
            </Tip>
          </>
        ),
      },
      {
        id: 'built-in-tools',
        title: 'Built-in tools',
        content: (
          <>
            <P>
              The LLM can call tools during generation to look up fragment details before writing prose.
              Enable or disable individual tools in <strong className="text-foreground/75">Settings</strong>.
            </P>

            <div className="mt-3 mb-1">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">Read tools</p>
              <ToolCard
                name="getFragment(id)"
                description="Retrieve full content of any fragment by its ID. Works across all types."
              />
              <ToolCard
                name="listFragments(type?)"
                description="List fragments with their ID, type, name, and description. Optionally filter by type."
              />
              <ToolCard
                name="searchFragments(query, type?)"
                description="Full-text search across all fragment content. Returns matching IDs and excerpts."
              />
              <ToolCard
                name="listFragmentTypes()"
                description="List all registered fragment types with their prefix and defaults."
              />
            </div>

            <div className="mt-4 mb-1">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">Type-specific aliases</p>
              <P>
                For each registered fragment type, the model also gets dedicated aliases:
              </P>
              <div className="rounded-md border border-border/25 bg-accent/15 px-3 py-2.5 mb-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-mono text-foreground/55">
                    <span className="text-primary/70">getCharacter</span>(id), <span className="text-primary/70">listCharacters</span>()
                  </p>
                  <p className="text-[11px] font-mono text-foreground/55">
                    <span className="text-primary/70">getGuideline</span>(id), <span className="text-primary/70">listGuidelines</span>()
                  </p>
                  <p className="text-[11px] font-mono text-foreground/55">
                    <span className="text-primary/70">getKnowledge</span>(id), <span className="text-primary/70">listKnowledge</span>()
                  </p>
                  <p className="text-[11px] font-mono text-foreground/55">
                    <span className="text-primary/70">getProse</span>(id), <span className="text-primary/70">listProse</span>()
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 mb-1">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">Write tools (librarian only)</p>
              <P>
                These are available to the librarian agent but not during regular generation:
              </P>
              <ToolCard name="createFragment(type, name, description, content)" description="Create a new fragment of any type." />
              <ToolCard name="updateFragment(id, content, description)" description="Overwrite a fragment's content entirely." />
              <ToolCard name="editFragment(id, oldText, newText)" description="Search-and-replace within a fragment's content." />
              <ToolCard name="editProse(oldText, newText)" description="Search-and-replace across all active prose in the chain." />
              <ToolCard name="deleteFragment(id)" description="Permanently delete a fragment." />
            </div>
          </>
        ),
      },
      {
        id: 'output-format',
        title: 'Output format',
        content: (
          <>
            <P>
              Choose between <Mono>plaintext</Mono> and <Mono>markdown</Mono> output in Settings.
            </P>
            <P>
              <strong className="text-foreground/75">Plaintext</strong> produces clean prose without any
              formatting markers. Best for literary fiction and simple narratives.
            </P>
            <P>
              <strong className="text-foreground/75">Markdown</strong> allows the model to use emphasis,
              headings, and other formatting. Good for structured content or stories with distinct sections.
            </P>
          </>
        ),
      },
      {
        id: 'max-steps',
        title: 'Max steps',
        content: (
          <>
            <P>
              Controls how many tool-use rounds the model can perform before it must produce output.
              Default is 10 steps. Each step is one tool call + result cycle.
            </P>
            <Tip>
              If the model is calling too many tools before writing, lower this number.
              If it seems to cut off tool lookups prematurely, increase it.
            </Tip>
          </>
        ),
      },
      {
        id: 'summarization',
        title: 'Summarization',
        content: (
          <>
            <P>
              The context limit means older prose eventually falls out of the prompt. Summarization
              is what preserves that lost context — it's the model's long-term memory.
            </P>
            <P>
              After each generation, the librarian reads the new prose and writes a short
              summary update. These updates are stitched together into a rolling summary that
              appears in the prompt as "Story Summary So Far", positioned before the recent prose.
            </P>
            <P>
              The <strong className="text-foreground/75">summarization threshold</strong> controls
              how many prose positions back the librarian looks when building its analysis.
              A higher number gives the librarian more context to work with; a lower number
              keeps analysis faster. Setting it to 0 disables summarization entirely.
            </P>
            <Tip>
              Summarization and the context limit work as a pair: the context limit controls how
              much raw prose the model sees, and summarization ensures everything before that
              window is still represented. If you increase the context limit, you may be able to
              lower the summarization threshold (or vice versa).
            </Tip>
          </>
        ),
      },
      {
        id: 'context-limit',
        title: 'Context limit',
        content: (
          <>
            <P>
              This setting controls how much recent prose from the chain is included in the
              generation prompt (step 2 of the pipeline). Prose is always selected from the
              end of the chain backwards — the most recent writing comes first.
            </P>
            <P>
              Three modes are available:
            </P>
            <P>
              <strong className="text-foreground/75">Fragments</strong> — Include the last N prose fragments
              regardless of their length. Default is 10. Simple and predictable.
            </P>
            <P>
              <strong className="text-foreground/75">Tokens</strong> — Include recent prose up to an estimated
              token budget. Tokens are approximated at 1 token per 4 characters. Use this when your fragments
              vary widely in length and you want consistent prompt sizes.
            </P>
            <P>
              <strong className="text-foreground/75">Characters</strong> — Include recent prose up to a raw
              character count. Useful for precise control over context size.
            </P>
            <P>
              In all modes, at least one prose fragment is always included even if it exceeds the
              budget. Everything before the limit is represented by the librarian's rolling summary,
              so the model still has awareness of earlier events — just not the raw text.
            </P>
            <Tip>
              A larger context limit means the model sees more of your actual prose, which
              helps with consistency and voice. But it also costs more tokens per generation
              and may push other context (guidelines, characters) proportionally further from
              the model's attention. Find the balance that works for your story.
            </Tip>
          </>
        ),
      },
      {
        id: 'keyboard-shortcuts',
        title: 'Keyboard shortcuts',
        content: (
          <>
            <P>
              Keyboard shortcuts are managed by the <strong className="text-foreground/75">Keybinds</strong> plugin.
              Enable it in Settings to configure shortcuts for generation, navigation, and other actions.
            </P>
            <P>
              Some defaults when the plugin is active:
            </P>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-foreground/65">Generate & save</span>
                <span className="flex items-center gap-1"><Kbd>Ctrl</Kbd><span className="text-muted-foreground/30">+</span><Kbd>Enter</Kbd></span>
              </div>
              <div className="h-px bg-border/15" />
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-foreground/65">Close panel / dialog</span>
                <Kbd>Esc</Kbd>
              </div>
            </div>
            <Tip>
              Check the Keybinds plugin panel for the full list of available shortcuts and to
              customize them.
            </Tip>
          </>
        ),
      },
      {
        id: 'debug-panel',
        title: 'Debug panel',
        content: (
          <>
            <P>
              The debug panel lets you inspect generation logs after they complete. Each log records
              the full prompt (system + user messages), all tool calls with arguments and results,
              the model's output, and timing statistics.
            </P>
            <P>
              Open it from the generation panel's <strong className="text-foreground/75">Debug</strong> button,
              or from the <strong className="text-foreground/75">debug icon</strong> on any prose block
              in the chain view.
            </P>
            <Tip>
              Use the debug panel to understand why the model made certain choices. Check the
              Prompt tab to see exactly what context was sent, and the Tools tab to see which
              fragments the model looked up.
            </Tip>
          </>
        ),
      },
    ],
  },
  {
    id: 'fragments',
    title: 'Fragments',
    description: 'Everything in Errata is a fragment. Learn how they compose into your story.',
    subsections: [
      {
        id: 'overview',
        title: 'What are fragments',
        content: (
          <>
            <P>
              Fragments are the building blocks of your story. Every piece of content — prose passages,
              character profiles, world knowledge, writing guidelines — is stored as a fragment with
              a unique ID, name, description, and content body.
            </P>
            <P>
              Fragment IDs follow a short, readable pattern: a 2-character type prefix followed by 4-8
              characters. For example, <Mono>pr-katemi</Mono> for prose, <Mono>ch-bokura</Mono> for
              characters, <Mono>gl-sideno</Mono> for guidelines, <Mono>kn-taviku</Mono> for knowledge.
            </P>
          </>
        ),
      },
      {
        id: 'types',
        title: 'Fragment types',
        content: (
          <>
            <P>
              <strong className="text-foreground/75">Prose</strong> — The story itself. Prose fragments form
              a chain (ordered sequence) that represents the narrative. Each generation appends a new prose
              fragment to the chain.
            </P>
            <P>
              <strong className="text-foreground/75">Characters</strong> — Character profiles, backstories,
              and personality descriptions. Sticky characters are always visible to the model; non-sticky
              appear as shortlist entries the model can look up.
            </P>
            <P>
              <strong className="text-foreground/75">Guidelines</strong> — Writing style instructions, tone
              guidance, genre conventions, and rules the model should follow. Think of these as persistent
              writing directions.
            </P>
            <P>
              <strong className="text-foreground/75">Knowledge</strong> — World-building details, lore,
              timelines, magic systems, geography, and any reference information the model can consult.
            </P>
          </>
        ),
      },
      {
        id: 'sticky',
        title: 'Sticky vs non-sticky',
        content: (
          <>
            <P>
              <strong className="text-foreground/75">Sticky fragments</strong> are included in full in every
              generation prompt. The model always sees their complete content. Use this for critical
              guidelines, main characters, or essential world details.
            </P>
            <P>
              <strong className="text-foreground/75">Non-sticky fragments</strong> appear only as one-line
              entries in a shortlist (ID, name, description). The model can use tools to look up their
              full content if needed. This keeps the prompt focused while still making information accessible.
            </P>
            <Tip>
              Keep only the most important fragments sticky. Too many sticky fragments inflate the prompt
              and can dilute the model's attention. Let the model discover peripheral details via tools.
            </Tip>
          </>
        ),
      },
      {
        id: 'tags-refs',
        title: 'Tags & references',
        content: (
          <>
            <P>
              <strong className="text-foreground/75">Tags</strong> are freeform labels for organizing fragments.
              Use them for filtering and search.
            </P>
            <P>
              <strong className="text-foreground/75">References</strong> link one fragment to another by ID.
              When the model looks up a fragment, it can see what other fragments are related and follow
              the reference chain.
            </P>
          </>
        ),
      },
    ],
  },
  {
    id: 'librarian',
    title: 'Librarian',
    description: 'The background agent that maintains your story\'s memory and knowledge.',
    subsections: [
      {
        id: 'overview',
        title: 'What the librarian does',
        content: (
          <>
            <P>
              The librarian is a background agent that runs automatically after each prose generation.
              It analyzes new prose to maintain a rolling summary, detect character mentions, flag
              contradictions, suggest knowledge fragments, and track the timeline.
            </P>
            <P>
              Results are stored per-story and accessible from the Librarian panel in the sidebar.
            </P>
          </>
        ),
      },
      {
        id: 'auto-suggestions',
        title: 'Auto-apply suggestions',
        content: (
          <>
            <P>
              When enabled in Settings, the librarian will automatically create and update fragments
              based on its analysis. For example, if a new character is introduced in the prose, the
              librarian may create a character fragment for them.
            </P>
            <Tip>
              This is off by default. Enable it if you want the librarian to proactively maintain
              your story's knowledge base without manual intervention.
            </Tip>
          </>
        ),
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configuring providers, plugins, appearance, and generation behavior.',
    subsections: [
      {
        id: 'providers',
        title: 'LLM providers',
        content: (
          <>
            <P>
              Errata supports multiple LLM providers. Each provider has an API endpoint and key.
              You can set different providers for generation (prose output) and the librarian
              (background analysis).
            </P>
            <P>
              The default provider uses the <Mono>DEEPSEEK_API_KEY</Mono> environment variable.
              Add custom providers through the Manage Providers panel in Settings.
            </P>
          </>
        ),
      },
      {
        id: 'context-ordering',
        title: 'Context ordering',
        content: (
          <>
            <P>
              <strong className="text-foreground/75">Simple mode</strong> groups sticky fragments by type
              (guidelines, then knowledge, then characters) in the prompt.
            </P>
            <P>
              <strong className="text-foreground/75">Advanced mode</strong> lets you drag fragments into a
              custom order. Use this when the order of context presentation matters for your story.
              The Context Order panel becomes available in the sidebar when advanced mode is enabled.
            </P>
          </>
        ),
      },
      {
        id: 'plugins',
        title: 'Plugins',
        content: (
          <>
            <P>
              Plugins extend Errata with new fragment types, LLM tools, API routes, and sidebar
              panels. Enable or disable them per-story in Settings.
            </P>
            <P>
              Each plugin can hook into four stages of the generation pipeline:
            </P>
            <div className="rounded-md border border-border/25 bg-accent/10 px-3 py-2.5 mb-2.5 space-y-1.5">
              <div>
                <p className="text-[11.5px] font-medium text-foreground/65">beforeContext</p>
                <p className="text-[11px] text-muted-foreground/50 leading-snug">
                  Runs after fragments are loaded but before messages are assembled. Plugins can
                  add, remove, or reorder fragments in the context state.
                </p>
              </div>
              <div className="h-px bg-border/15" />
              <div>
                <p className="text-[11.5px] font-medium text-foreground/65">beforeGeneration</p>
                <p className="text-[11px] text-muted-foreground/50 leading-snug">
                  Runs after messages are assembled. Plugins can modify the final system and user
                  messages before they're sent to the LLM.
                </p>
              </div>
              <div className="h-px bg-border/15" />
              <div>
                <p className="text-[11.5px] font-medium text-foreground/65">afterGeneration</p>
                <p className="text-[11px] text-muted-foreground/50 leading-snug">
                  Runs after the LLM responds. Plugins can transform the generated text before
                  it's saved as a fragment.
                </p>
              </div>
              <div className="h-px bg-border/15" />
              <div>
                <p className="text-[11.5px] font-medium text-foreground/65">afterSave</p>
                <p className="text-[11px] text-muted-foreground/50 leading-snug">
                  Runs after the prose fragment is persisted. Plugins can trigger side effects
                  like notifications or external syncs.
                </p>
              </div>
            </div>
            <P>
              Plugins can also register custom LLM tools that the model can call during generation,
              alongside the built-in fragment tools.
            </P>
          </>
        ),
      },
    ],
  },
]

/** Find a section by ID */
export function findSection(sectionId: string): HelpSection | undefined {
  return HELP_SECTIONS.find((s) => s.id === sectionId)
}

/** Find a subsection within a section */
export function findSubsection(sectionId: string, subsectionId: string): HelpSubsection | undefined {
  const section = findSection(sectionId)
  return section?.subsections.find((s) => s.id === subsectionId)
}
