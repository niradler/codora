/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Content,
  ContentListUnion,
  Part,
  PartUnion,
  FunctionCall,
  FunctionDeclaration,
  Tool,
  ToolListUnion,
} from '@google/genai';

export function toContentList(contents: ContentListUnion): Content[] {
  if (Array.isArray(contents)) {
    return contents.map(toContent);
  }
  return [toContent(contents)];
}

export function toContent(
  content: Content | PartUnion[] | string | PartUnion,
): Content {
  if (Array.isArray(content)) {
    return { role: 'user', parts: toParts(content) };
  }
  if (typeof content === 'string') {
    return { role: 'user', parts: [{ text: content }] } as Content;
  }
  if ((content as Content).parts) {
    return content as Content;
  }
  return { role: 'user', parts: [content as Part] } as Content;
}

export function toParts(parts: PartUnion[]): Part[] {
  return parts.map((p) =>
    typeof p === 'string' ? ({ text: p } as Part) : (p as Part),
  );
}

export function partToText(p: Part | string): string {
  return typeof p === 'string' ? p : p.text || '';
}

export function contentsToText(contents: Content[]): string {
  return contents
    .map((c) => (c.parts || []).map(partToText).join(''))
    .join('\n');
}

export function extractTools(tools?: ToolListUnion): FunctionDeclaration[] {
  if (!tools) return [];

  const functionDeclarations: FunctionDeclaration[] = [];
  const toolArray = Array.isArray(tools) ? tools : [tools];

  for (const tool of toolArray) {
    if (typeof tool === 'object' && tool !== null) {
      // Handle Tool type with functionDeclarations property
      if (
        'functionDeclarations' in tool &&
        Array.isArray(tool.functionDeclarations)
      ) {
        functionDeclarations.push(...tool.functionDeclarations);
      }
    }
  }
  return functionDeclarations;
}

export function createToolSystemPrompt(tools: FunctionDeclaration[]): string {
  if (!tools.length) return '';

  const toolsDescription = tools
    .map((tool) => {
      const name = tool.name;
      const description = tool.description || 'No description provided';
      const params = tool.parameters?.properties
        ? Object.keys(tool.parameters.properties).join(', ')
        : 'none';

      return `- ${name}: ${description} (Parameters: ${params})`;
    })
    .join('\n');

  return `

You have access to the following tools/functions. When you need to use a tool, respond with a JSON object in this exact format:
{"function_call": {"name": "tool_name", "arguments": {"param1": "value1", "param2": "value2"}}}

Available tools:
${toolsDescription}

Only respond with the JSON function call when you need to use a tool. For regular responses, respond normally without JSON.`;
}

export function parseFunctionCall(text: string): FunctionCall | null {
  try {
    // First try to find complete JSON objects with function_call
    // Use more flexible regex that handles multiline JSON
    const jsonObjectRegex = /\{[\s\S]*?"function_call"[\s\S]*?\}/;
    let functionCallMatch = text.match(jsonObjectRegex);

    if (!functionCallMatch) {
      // Fallback: look for the pattern anywhere in the text
      const simpleMatch = text.match(
        /\{[\s\S]*?"function_call"[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}/,
      );
      if (simpleMatch) {
        functionCallMatch = simpleMatch;
      }
    }

    if (!functionCallMatch) return null;

    // Try to parse the matched JSON
    const parsed = JSON.parse(functionCallMatch[0]);
    if (!parsed.function_call?.name) return null;

    return {
      name: parsed.function_call.name,
      args: parsed.function_call.arguments || {},
      id: `${parsed.function_call.name}-${Date.now()}`,
    };
  } catch (error) {
    // If JSON parsing fails, try a more aggressive approach
    try {
      // Extract just the function call data manually
      const nameMatch = text.match(/"name":\s*"([^"]+)"/);
      const argsMatch = text.match(/"arguments":\s*(\{[^}]*\})/);

      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1];
        let args = {};

        if (argsMatch && argsMatch[1]) {
          args = JSON.parse(argsMatch[1]);
        }

        return {
          name,
          args,
          id: `${name}-${Date.now()}`,
        };
      }
    } catch {
      // Final fallback - return null if everything fails
    }

    return null;
  }
}
