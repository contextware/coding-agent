export enum Models {
  AmazonNovaPro = 'amazon/nova-pro',
  AnthropicClaude4Sonnet = 'anthropic/claude-4-sonnet',
  AnthropicClaude45Sonnet = 'anthropic/claude-sonnet-4.5',
  GoogleGeminiFlash = 'google/gemini-2.5-flash',
  GoogleGemini3Pro = 'google/gemini-3-pro-preview',
  GoogleGemini3Flash = 'google/gemini-3-flash-preview',
  MoonshotKimiK2 = 'moonshotai/kimi-k2',
  OpenAIGPT5 = 'openai/gpt-5',
  XaiGrok4Fast = 'x-ai/grok-code-fast-1',
  AnthropicClaudeOpus45 = 'anthropic/claude-opus-4.5',
}

export const DEFAULT_MODEL = Models.GoogleGeminiFlash

export const SUPPORTED_MODELS: string[] = [
  Models.AmazonNovaPro,
  Models.AnthropicClaude4Sonnet,
  Models.AnthropicClaude45Sonnet,
  Models.GoogleGeminiFlash,
  Models.GoogleGemini3Pro,
  Models.GoogleGemini3Flash,
  Models.MoonshotKimiK2,
  Models.OpenAIGPT5,
  Models.XaiGrok4Fast,
  Models.AnthropicClaudeOpus45,
]

export const TEST_PROMPTS = [
  'Generate a Next.js app that allows to list and search Pokemons',
  'Create a `golang` server that responds with "Hello World" to any request',
]
