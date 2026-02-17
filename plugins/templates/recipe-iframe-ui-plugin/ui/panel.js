const params = new URLSearchParams(window.location.search)
const storyId = params.get('storyId') || ''

document.getElementById('story').textContent = storyId ? `Story: ${storyId}` : 'No story selected'

document.getElementById('load').addEventListener('click', async () => {
  const out = document.getElementById('output')
  try {
    const response = await fetch(`/api/plugins/iframe-ui-recipe/panel-data?storyId=${encodeURIComponent(storyId)}`)
    const data = await response.json()
    out.textContent = JSON.stringify(data, null, 2)
  } catch (error) {
    out.textContent = String(error)
  }
})

// Listen for panel events from the host app
window.addEventListener('message', (e) => {
  if (e.data.type === 'errata:panel-open') {
    console.log('[iframe-ui-recipe] Panel opened:', e.data.event.panel)
  }
  if (e.data.type === 'errata:panel-close') {
    console.log('[iframe-ui-recipe] Panel closed:', e.data.event.panel)
  }
  if (e.data.type === 'errata:data-changed') {
    console.log('[iframe-ui-recipe] Data changed:', e.data.queryKeys)
  }
})
