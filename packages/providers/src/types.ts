/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';

export type ProviderName = 'gemini' | 'ollama' | 'bedrock' | 'openai';

export type ProviderConfig = {
  provider?: ProviderName;
  model: string;
  proxy?: string;
  authType?: string;
};

export interface ProviderContentGenerator {
  generateContent(
    req: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;
  generateContentStream(
    req: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;
  countTokens(req: CountTokensParameters): Promise<CountTokensResponse>;
  embedContent(req: EmbedContentParameters): Promise<EmbedContentResponse>;
}
