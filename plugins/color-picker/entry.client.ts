import { ColorPickerPanel } from './Panel'
import { startColorPickerRuntime, stopColorPickerRuntime, onPanelOpen as runtimePanelOpen, onPanelClose as runtimePanelClose } from './runtime'
import type { PanelEvent, PluginRuntimeContext } from '@/lib/plugin-panels'

export const pluginName = 'color-picker'
export const panel = ColorPickerPanel
export const activate = () => startColorPickerRuntime()
export const deactivate = () => stopColorPickerRuntime()
export const onPanelOpen = (event: PanelEvent, context: PluginRuntimeContext) => runtimePanelOpen(event, context)
export const onPanelClose = (event: PanelEvent, context: PluginRuntimeContext) => runtimePanelClose(event, context)
