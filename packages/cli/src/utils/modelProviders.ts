/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Ollama } from 'ollama';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export const getAvailableModels = async (
  provider: string,
): Promise<ModelInfo[]> => {
  switch (provider) {
    case 'gemini':
      return [
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          description: 'Latest and most capable model',
        },
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          description: 'Fast and efficient',
        },
        {
          id: 'gemini-2.5-flash-lite',
          name: 'Gemini 2.5 Flash Lite',
          description: 'Lightweight version',
        },
        {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          description: 'Previous generation flash model',
        },
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          description: 'Previous generation pro model',
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          description: 'Previous generation flash model',
        },
      ];

    case 'openai':
      return [
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          description: 'Most capable GPT-4 model',
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o Mini',
          description: 'Faster and cheaper GPT-4o',
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          description: 'Enhanced GPT-4 with latest knowledge',
        },
        {
          id: 'gpt-4',
          name: 'GPT-4',
          description: 'High-intelligence flagship model',
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'Fast and inexpensive model',
        },
        {
          id: 'o1-preview',
          name: 'o1-preview',
          description: 'Advanced reasoning model',
        },
        {
          id: 'o1-mini',
          name: 'o1-mini',
          description: 'Faster reasoning model',
        },
      ];

    case 'ollama':
      // Use Ollama SDK to get available models
      try {
        const host =
          (globalThis as any)?.process?.env?.OLLAMA_BASE_URL ||
          'http://127.0.0.1:11434';
        const ollama = new Ollama({ host });

        const modelList = await ollama.list();

        if (modelList?.models && modelList.models.length > 0) {
          return modelList.models.map((model: any) => {
            // Parse size for better display
            const sizeInBytes = model.size || 0;
            let sizeDisplay = 'Unknown size';

            if (sizeInBytes > 0) {
              const sizeInGB = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(1);
              sizeDisplay = `${sizeInGB} GB`;
            }

            // Extract model family from name
            const modelName = model.name || model.model || 'Unknown';
            const displayName = modelName.includes(':')
              ? modelName.split(':')[0] + ' (' + modelName.split(':')[1] + ')'
              : modelName;

            return {
              id: modelName,
              name: displayName,
              description: `${sizeDisplay}${model.modified_at ? ' • Updated: ' + new Date(model.modified_at).toLocaleDateString() : ''}`,
            };
          });
        }
      } catch (error) {
        console.warn('Failed to fetch Ollama models:', error);
        // Fallback to common models if API is not available
      }

      // Fallback models if Ollama is not running or API fails
      return [
        {
          id: 'llama3.2:latest',
          name: 'Llama 3.2 (latest)',
          description: 'Latest Llama model - requires download',
        },
        {
          id: 'llama3.2:3b',
          name: 'Llama 3.2 (3b)',
          description: 'Compact version - requires download',
        },
        {
          id: 'llama3.1:latest',
          name: 'Llama 3.1 (latest)',
          description: 'Previous Llama generation - requires download',
        },
        {
          id: 'qwen2.5:latest',
          name: 'Qwen 2.5 (latest)',
          description: 'Qwen model - requires download',
        },
        {
          id: 'codellama:latest',
          name: 'Code Llama (latest)',
          description: 'Code-focused model - requires download',
        },
        {
          id: 'mistral:latest',
          name: 'Mistral (latest)',
          description: 'Open source model - requires download',
        },
      ];

    case 'bedrock':
      return [
        {
          id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          name: 'Claude 3.5 Sonnet',
          description: 'Latest Claude model',
        },
        {
          id: 'anthropic.claude-3-5-haiku-20241022-v1:0',
          name: 'Claude 3.5 Haiku',
          description: 'Fast Claude model',
        },
        {
          id: 'anthropic.claude-3-opus-20240229-v1:0',
          name: 'Claude 3 Opus',
          description: 'Most capable Claude 3',
        },
        {
          id: 'amazon.titan-text-premier-v1:0',
          name: 'Titan Text Premier',
          description: 'Amazon Titan model',
        },
        {
          id: 'meta.llama3-2-90b-instruct-v1:0',
          name: 'Llama 3.2 90B',
          description: 'Large Llama model',
        },
        {
          id: 'meta.llama3-2-11b-instruct-v1:0',
          name: 'Llama 3.2 11B',
          description: 'Medium Llama model',
        },
      ];

    default:
      return [];
  }
};
