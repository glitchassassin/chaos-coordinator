import { ipcMain } from 'electron'
import { z } from 'zod'
import { generate, generateStructured, getConfig } from '../llm'

export function registerLLMHandlers() {
  // Generate text completion
  ipcMain.handle(
    'llm:generate',
    async (_, request: { system?: string; prompt: string }) => {
      const options: Parameters<typeof generate>[0] = {
        prompt: request.prompt
      }
      if (request.system !== undefined) {
        options.system = request.system
      }
      return await generate(options)
    }
  )

  // Generate structured output
  // Note: This receives a JSON-serialized Zod schema definition, which is a limitation
  // of IPC serialization. In practice, consumer tasks will provide schema definitions.
  ipcMain.handle(
    'llm:generateStructured',
    async (_, request: { system?: string; prompt: string; schema: string }) => {
      // For now, we'll accept a schema definition object and reconstruct it
      // This is simplified - real usage will be from main process, not via IPC
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const schemaObject = JSON.parse(request.schema)
      const schema = z.object(schemaObject) as z.ZodType

      const options: Parameters<typeof generateStructured>[0] = {
        prompt: request.prompt,
        schema
      }
      if (request.system !== undefined) {
        options.system = request.system
      }

      return await generateStructured(options)
    }
  )

  // Health check - verify LLM is configured
  ipcMain.handle('llm:checkHealth', () => {
    try {
      getConfig()
      return { configured: true }
    } catch {
      return { configured: false }
    }
  })
}
