/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
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

export function createBedrockProvider(
  _config: ProviderConfig,
): ProviderContentGenerator {
  const region = (globalThis as any)?.process?.env?.AWS_REGION || 'us-east-1';
  const client = new BedrockRuntimeClient({ region });

  function requestBodyFromContents(req: GenerateContentParameters): unknown {
    const cs = toContentList(req.contents);
    const text = contentsToText(cs);
    return {
      inputText: text,
      textGenerationConfig: {
        temperature: req.config?.temperature,
        topP: req.config?.topP,
        maxTokenCount: req.config?.maxOutputTokens,
        stopSequences: req.config?.stopSequences,
      },
    };
  }

  return {
    async generateContent(
      req: GenerateContentParameters,
    ): Promise<GenerateContentResponse> {
      const body = JSON.stringify(requestBodyFromContents(req));
      const modelId =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_BEDROCK ||
        '';
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body,
      });
      const resp = await client.send(command);
      const decoded = new TextDecoder().decode(resp.body);
      const payload = JSON.parse(decoded) as
        | { outputText?: string; results?: Array<{ outputText?: string }> }
        | undefined;
      const text =
        payload?.outputText || payload?.results?.[0]?.outputText || '';
      return {
        candidates: [
          { content: { role: 'model', parts: [{ text }] } as Content } as never,
        ],
      } as unknown as GenerateContentResponse;
    },

    async generateContentStream(
      req: GenerateContentParameters,
    ): Promise<AsyncGenerator<GenerateContentResponse>> {
      const body = JSON.stringify(requestBodyFromContents(req));
      const modelId =
        req.model ||
        (globalThis as any)?.process?.env?.CODORA_DEFAULT_MODEL_BEDROCK ||
        '';
      const command = new InvokeModelWithResponseStreamCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body,
      });
      const resp = await client.send(command);
      const stream = resp.body;
      async function* wrap() {
        for await (const event of stream as AsyncGenerator<{
          chunk?: { bytes?: Uint8Array };
        }>) {
          const chunk = event.chunk?.bytes;
          if (!chunk) continue;
          const decoded = new TextDecoder().decode(chunk);
          const json = JSON.parse(decoded) as
            | {
                outputText?: string;
                delta?: string;
              }
            | undefined;
          const text = json?.outputText || json?.delta || '';
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
      _req: EmbedContentParameters,
    ): Promise<EmbedContentResponse> {
      return { embeddings: [{ values: [] }] } as EmbedContentResponse;
    },
  };
}
