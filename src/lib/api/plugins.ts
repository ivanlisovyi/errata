import { apiFetch } from './client'
import type { PluginManifestInfo } from './types'

export const plugins = {
  list: () => apiFetch<PluginManifestInfo[]>('/plugins'),
}
