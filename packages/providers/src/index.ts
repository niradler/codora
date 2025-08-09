/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createOllamaProvider } from './ollama.js';
import { createBedrockProvider } from './bedrock.js';
import { createOpenAIProvider } from './openai.js';
import type { ProviderConfig, ProviderContentGenerator } from './types.js';

export function createProvider(
  config: ProviderConfig,
): ProviderContentGenerator {
  switch (config.provider) {
    case 'bedrock':
      return createBedrockProvider(config);
    case 'ollama':
      return createOllamaProvider(config);
    case 'openai':
      return createOpenAIProvider(config);
    default:
      return createOllamaProvider(config);
  }
}
