import { Models } from './constants'
import type { JSONValue } from 'ai'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export async function getAvailableModels() {
  return [
    { id: Models.OpenAIGPT5, name: 'GPT-5' },
    { id: Models.AnthropicClaude4Sonnet, name: 'Claude 4 Sonnet' },
    { id: Models.GoogleGeminiFlash, name: 'Gemini 2.5 Flash' },
    { id: Models.XaiGrok4Fast, name: 'Grok 4 Fast' },
    { id: Models.AnthropicClaudeOpus45, name: 'Claude Opus 4.5' },
    { id: Models.GoogleGemini3Pro, name: 'Gemini 3 Pro' },
    { id: Models.GoogleGemini3Flash, name: 'Gemini 3 Flash' },
  ]
}

export interface ModelOptions {
  model: LanguageModelV3
  providerOptions?: Record<string, Record<string, JSONValue>>
  headers?: Record<string, string>
}

export function getModelOptions(
  modelId: string,
  options?: { reasoningEffort?: 'minimal' | 'low' | 'medium' },
): ModelOptions {
  const gateway = gatewayInstance()

  if (modelId === Models.OpenAIGPT5) {
    return {
      model: gateway(modelId),
      providerOptions: {
        openai: {
          include: ['reasoning.encrypted_content'],
          reasoningEffort: options?.reasoningEffort ?? 'low',
          reasoningSummary: 'auto',
          serviceTier: 'priority',
        },
      },
    }
  }

  if (modelId === Models.AnthropicClaude4Sonnet || modelId === Models.AnthropicClaude45Sonnet) {
    return {
      model: gateway(modelId),
      headers: { 'anthropic-beta': 'fine-grained-tool-streaming-2025-05-14' },
      providerOptions: {
        anthropic: {
          cacheControl: { type: 'ephemeral' },
        },
      },
    }
  }

  return {
    model: gateway(modelId),
  }
}

function gatewayInstance() {
  return createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  })
}
