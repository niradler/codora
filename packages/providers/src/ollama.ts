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
  FunctionCall,
} from '@google/genai';
import { ProviderConfig, ProviderContentGenerator } from './types.js';
import {
  contentsToText,
  toContentList,
  extractTools,
  createToolSystemPrompt,
  parseFunctionCall,
} from './utils.js';

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

      // Extract tools and add to system prompt
      const tools = extractTools(req.config?.tools);
      const toolsPrompt = createToolSystemPrompt(tools);
      const finalPrompt = prompt + toolsPrompt;

      const resolvedModel =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OLLAMA ||
        '';
      const data = (await client.chat({
        model: resolvedModel,
        messages: [{ role: 'user', content: finalPrompt }],
        stream: false,
        options: {
          temperature: req.config?.temperature,
          top_p: req.config?.topP,
          num_predict: req.config?.maxOutputTokens,
          stop: req.config?.stopSequences,
        },
      })) as { message?: { content?: string }; response?: string };
      const text = data?.message?.content || data?.response || '';

      // Parse potential function calls from the response
      const functionCall = parseFunctionCall(text);
      const functionCalls: FunctionCall[] = functionCall ? [functionCall] : [];

      // Clean text by removing function call JSON if present
      const cleanText = functionCall
        ? text
            .replace(
              /\{[\s\S]*?"function_call"[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}/,
              '',
            )
            .trim()
        : text;

      return {
        candidates: [
          {
            content: { role: 'model', parts: [{ text: cleanText }] } as Content,
            ...(functionCalls.length > 0 && { functionCalls }),
          } as never,
        ],
        ...(functionCalls.length > 0 && { functionCalls }),
      } as unknown as GenerateContentResponse;
    },

    async generateContentStream(
      req: GenerateContentParameters,
    ): Promise<AsyncGenerator<GenerateContentResponse>> {
      const cs = toContentList(req.contents);
      const prompt = contentsToText(cs);

      // Extract tools and add to system prompt
      const tools = extractTools(req.config?.tools);
      const toolsPrompt = createToolSystemPrompt(tools);
      const finalPrompt = prompt + toolsPrompt;

      const resolvedModel =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_OLLAMA ||
        '';
      const stream = (await client.chat({
        model: resolvedModel,
        messages: [{ role: 'user', content: finalPrompt }],
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
        let accumulatedText = '';
        let functionCallProcessed = false;

        for await (const part of stream) {
          const text = part?.message?.content || part?.response || '';
          if (!text) continue;

          accumulatedText += text;

          // Check for complete function call in accumulated text
          const functionCall = parseFunctionCall(accumulatedText);

          if (functionCall && !functionCallProcessed) {
            functionCallProcessed = true;

            // Send function call response
            yield {
              candidates: [
                {
                  content: { role: 'model', parts: [{ text: '' }] } as Content,
                  functionCalls: [functionCall],
                } as never,
              ],
              functionCalls: [functionCall],
            } as unknown as GenerateContentResponse;

            // Clean the accumulated text
            accumulatedText = accumulatedText
              .replace(
                /\{[\s\S]*?"function_call"[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}/,
                '',
              )
              .trim();
          } else if (!functionCall) {
            // Regular text streaming
            yield {
              candidates: [
                {
                  content: { role: 'model', parts: [{ text }] } as Content,
                } as never,
              ],
            } as unknown as GenerateContentResponse;
          }
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
