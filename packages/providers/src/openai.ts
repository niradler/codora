/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import OpenAI from 'openai';
import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
  Content,
} from '@google/genai';
import { ProviderConfig, ProviderContentGenerator } from './types.js';
import { contentsToText, toContentList } from './utils.js';

export function createOpenAIProvider(
  _config: ProviderConfig,
): ProviderContentGenerator {
  const apiKey = (globalThis as any)?.process?.env?.OPENAI_API_KEY || '';
  const client = new OpenAI({ apiKey });

  return {
    async generateContent(
      req: GenerateContentParameters,
    ): Promise<GenerateContentResponse> {
      const cs = toContentList(req.contents);
      const prompt = contentsToText(cs);
      const model =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OPENAI ||
        'gpt-4o-mini';
      const chat = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: req.config?.temperature as number | undefined,
      });
      const text = chat.choices?.[0]?.message?.content || '';
      return {
        candidates: [
          { content: { role: 'model', parts: [{ text }] } as Content } as never,
        ],
      } as unknown as GenerateContentResponse;
    },

    async generateContentStream(
      req: GenerateContentParameters,
    ): Promise<AsyncGenerator<GenerateContentResponse>> {
      const cs = toContentList(req.contents);
      const prompt = contentsToText(cs);
      const model =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OPENAI ||
        'gpt-4o-mini';
      const stream = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: req.config?.temperature as number | undefined,
      });
      async function* wrap() {
        for await (const part of stream) {
          const text = part?.choices?.[0]?.delta?.content || '';
          if (!text) continue;
          yield {
            candidates: [
              {
                content: { role: 'model', parts: [{ text }] } as Content,
              } as never,
            ],
          } as unknown as GenerateContentResponse;
        }
      }
      return wrap();
    },

    async countTokens(
      req: CountTokensParameters,
    ): Promise<CountTokensResponse> {
      const cs = toContentList(req.contents);
      const text = contentsToText(cs);
      const approx = Math.max(1, Math.round(text.length / 4));
      return { totalTokens: approx };
    },

    async embedContent(
      req: EmbedContentParameters,
    ): Promise<EmbedContentResponse> {
      const contents = Array.isArray(req.contents)
        ? req.contents
        : [req.contents];
      const first = contents[0] as Content | string;
      let text = '';
      if (typeof first === 'string') {
        text = first;
      } else {
        const parts = first.parts || [];
        const p = parts[0] as unknown as { text?: string } | string;
        text = typeof p === 'string' ? p : p?.text || '';
      }
      const model =
        (req as unknown as { model?: string }).model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OPENAI ||
        'text-embedding-3-small';
      const resp = await client.embeddings.create({ model, input: text });
      const vector = resp?.data?.[0]?.embedding || [];
      return { embeddings: [{ values: vector }] } as EmbedContentResponse;
    },
  };
}
