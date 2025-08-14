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
  FunctionCall,
  FunctionDeclaration,
} from '@google/genai';
import { ProviderConfig, ProviderContentGenerator } from './types.js';
import { contentsToText, toContentList, extractTools } from './utils.js';

export function createOpenAIProvider(
  _config: ProviderConfig,
): ProviderContentGenerator {
  const apiKey = (globalThis as any)?.process?.env?.OPENAI_API_KEY || '';
  const client = new OpenAI({ apiKey });

  function convertGeminiToolsToOpenAI(tools: FunctionDeclaration[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name!,
        description: tool.description || '',
        parameters: (tool.parameters as any) || { type: 'object', properties: {} }
      }
    }));
  }

  function convertOpenAIToolCallsToGemini(toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]): FunctionCall[] {
    return toolCalls.map(toolCall => ({
      name: toolCall.function.name,
      args: JSON.parse(toolCall.function.arguments || '{}'),
      id: toolCall.id
    }));
  }

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
      
      // Extract and convert tools
      const tools = extractTools(req.config?.tools);
      const openaiTools = tools.length > 0 ? convertGeminiToolsToOpenAI(tools) : undefined;
      
      const chat = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: req.config?.temperature as number | undefined,
        ...(openaiTools && { tools: openaiTools, tool_choice: 'auto' })
      });
      
      const message = chat.choices?.[0]?.message;
      const text = message?.content || '';
      const functionCalls = message?.tool_calls ? convertOpenAIToolCallsToGemini(message.tool_calls) : [];
      
      return {
        candidates: [
          { 
            content: { role: 'model', parts: [{ text }] } as Content,
            ...(functionCalls.length > 0 && { functionCalls })
          } as never,
        ],
        ...(functionCalls.length > 0 && { functionCalls })
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
      
      // Extract and convert tools
      const tools = extractTools(req.config?.tools);
      const openaiTools = tools.length > 0 ? convertGeminiToolsToOpenAI(tools) : undefined;
      
      const stream = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        temperature: req.config?.temperature as number | undefined,
        ...(openaiTools && { tools: openaiTools, tool_choice: 'auto' })
      });
      
      async function* wrap() {
        const toolCallsAccumulator: { [id: string]: { name?: string; arguments?: string } } = {};
        
        for await (const part of stream) {
          const delta = part?.choices?.[0]?.delta;
          const text = delta?.content || '';
          
          // Handle tool calls
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              if (!toolCall.id) continue;
              
              if (!toolCallsAccumulator[toolCall.id]) {
                toolCallsAccumulator[toolCall.id] = {};
              }
              
              if (toolCall.function?.name) {
                toolCallsAccumulator[toolCall.id].name = toolCall.function.name;
              }
              
              if (toolCall.function?.arguments) {
                toolCallsAccumulator[toolCall.id].arguments = 
                  (toolCallsAccumulator[toolCall.id].arguments || '') + toolCall.function.arguments;
              }
            }
          }
          
          // Send text content if available
          if (text) {
            yield {
              candidates: [
                {
                  content: { role: 'model', parts: [{ text }] } as Content,
                } as never,
              ],
            } as unknown as GenerateContentResponse;
          }
        }
        
        // Send complete tool calls at the end
        const completedToolCalls = Object.entries(toolCallsAccumulator)
          .filter(([_, call]) => call.name && call.arguments)
          .map(([id, call]) => ({
            name: call.name!,
            args: JSON.parse(call.arguments || '{}'),
            id
          }));
        
        if (completedToolCalls.length > 0) {
          yield {
            candidates: [
              {
                content: { role: 'model', parts: [{ text: '' }] } as Content,
                functionCalls: completedToolCalls
              } as never,
            ],
            functionCalls: completedToolCalls
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
