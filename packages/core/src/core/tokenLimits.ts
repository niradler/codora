/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

type Model = string;
type TokenCount = number;

export const DEFAULT_TOKEN_LIMIT = 1_048_576;

export function tokenLimit(model: Model): TokenCount {
  // Gemini models
  switch (model) {
    case 'gemini-1.5-pro':
      return 2_097_152;
    case 'gemini-1.5-flash':
    case 'gemini-2.5-pro-preview-05-06':
    case 'gemini-2.5-pro-preview-06-05':
    case 'gemini-2.5-pro':
    case 'gemini-2.5-flash-preview-05-20':
    case 'gemini-2.5-flash':
    case 'gemini-2.5-flash-lite':
    case 'gemini-2.0-flash':
      return 1_048_576;
    case 'gemini-2.0-flash-preview-image-generation':
      return 32_000;

    // OpenAI models
    case 'gpt-4o':
    case 'gpt-4o-mini':
    case 'gpt-4-turbo':
      return 128_000;
    case 'gpt-4':
      return 8_192;
    case 'gpt-3.5-turbo':
      return 16_385;
    case 'o1-preview':
      return 128_000;
    case 'o1-mini':
      return 128_000;

    // Ollama models (varies by model)
    case 'llama3.2:latest':
    case 'llama3.2:3b':
    case 'llama3.1:latest':
      return 128_000;
    case 'qwen2.5:latest':
    case 'qwen3:30b':
      return 128_000;
    case 'codellama:latest':
      return 16_384;
    case 'mistral:latest':
      return 32_768;

    // AWS Bedrock models
    case 'anthropic.claude-3-5-sonnet-20241022-v2:0':
    case 'anthropic.claude-3-5-haiku-20241022-v1:0':
    case 'anthropic.claude-3-opus-20240229-v1:0':
      return 200_000;
    case 'amazon.titan-text-premier-v1:0':
      return 32_000;
    case 'meta.llama3-2-90b-instruct-v1:0':
    case 'meta.llama3-2-11b-instruct-v1:0':
      return 128_000;

    default:
      // For any unknown model, use a reasonable default
      // Check if it's an Ollama model (contains colon)
      if (model.includes(':')) {
        return 128_000; // Default for Ollama models
      }
      // Check if it's a Bedrock model (contains dots and version)
      if (model.includes('.') && model.includes(':')) {
        return 128_000; // Default for Bedrock models
      }
      return DEFAULT_TOKEN_LIMIT;
  }
}
