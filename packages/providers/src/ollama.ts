/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ollama } from 'ollama';
import {
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

export function createOllamaProvider(
  config: ProviderConfig,
): ProviderContentGenerator {
  const host =
    (globalThis as any)?.process?.env?.OLLAMA_BASE_URL ||
    'http://127.0.0.1:11434';
  const client = new Ollama({ host });

  return {
    async generateContent(
      req: GenerateContentParameters,
    ): Promise<GenerateContentResponse> {
      const cs = toContentList(req.contents);
      const prompt = contentsToText(cs);
      const resolvedModel =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OLLAMA ||
        '';
      const data = (await client.chat({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          temperature: req.config?.temperature,
          top_p: req.config?.topP,
          num_predict: req.config?.maxOutputTokens,
          stop: req.config?.stopSequences,
        },
      })) as { message?: { content?: string }; response?: string };
      const text = data?.message?.content || data?.response || '';
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
      const resolvedModel =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OLLAMA ||
        '';
      const stream = (await client.chat({
        model: resolvedModel,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        options: {
          temperature: req.config?.temperature,
          top_p: req.config?.topP,
          num_predict: req.config?.maxOutputTokens,
          stop: req.config?.stopSequences,
        },
      })) as unknown as AsyncGenerator<{
        message?: { content?: string };
        response?: string;
      }>;

      async function* wrap() {
        for await (const part of stream) {
          const text = part?.message?.content || part?.response || '';
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
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OLLAMA ||
        '';
      const resp = (await client.embed({ model, input: text })) as {
        embeddings?: number[][];
        embedding?: number[];
      };
      const vector = Array.isArray(resp?.embeddings)
        ? resp.embeddings[0]
        : resp?.embedding || [];
      return { embeddings: [{ values: vector }] } as EmbedContentResponse;
    },
  };
}
