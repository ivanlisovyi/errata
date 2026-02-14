import { createDeepSeek } from '@ai-sdk/deepseek'

export const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY ?? 'DEEPSEEK_API_KEY',
})

export const defaultModel = deepseek('deepseek-chat')
