/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { getAvailableModels, ModelInfo } from '../../utils/modelProviders.js';
import { tokenLimit } from '@google/gemini-cli-core';

interface ModelDialogProps {
  onSelect: (model: string | undefined, scope: SettingScope) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
}

export function ModelDialog({
  onSelect,
  settings,
  initialErrorMessage,
}: ModelDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const currentProvider = settings.merged.selectedProvider || 'gemini';

  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true);
        const availableModels = await getAvailableModels(currentProvider);
        setModels(availableModels);
      } catch (error) {
        setErrorMessage(`Failed to load models: ${error}`);
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [currentProvider]);

  const items = models.map((model) => {
    const contextSize = tokenLimit(model.id);
    const contextDisplay =
      contextSize >= 1_000_000
        ? `${(contextSize / 1_000_000).toFixed(1)}M tokens`
        : contextSize >= 1_000
          ? `${(contextSize / 1_000).toFixed(0)}K tokens`
          : `${contextSize} tokens`;

    return {
      label: `${model.name} (${contextDisplay})${model.description ? ` - ${model.description}` : ''}`,
      value: model.id,
    };
  });

  const currentModel = settings.merged.model;
  const initialModelIndex = items.findIndex((item) => {
    return item.value === currentModel;
  });

  const handleModelSelect = (modelId: string) => {
    setErrorMessage(null);
    onSelect(modelId, SettingScope.User);
  };

  useInput((_input, key) => {
    if (key.escape) {
      if (errorMessage) {
        return;
      }
      onSelect(undefined, SettingScope.User);
    }
  });

  if (loading) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>Loading models...</Text>
        <Box marginTop={1}>
          <Text>
            {currentProvider === 'ollama'
              ? 'Connecting to Ollama and fetching installed models...'
              : `Fetching available models for ${currentProvider}...`}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color={Colors.Gray}>(This may take a moment)</Text>
        </Box>
      </Box>
    );
  }

  if (models.length === 0) {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.Gray}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold>No models available</Text>
        <Box marginTop={1}>
          <Text>
            {currentProvider === 'ollama'
              ? 'No models installed in Ollama. Run `ollama pull <model>` to install models.'
              : `No models found for provider: ${currentProvider}`}
          </Text>
        </Box>
        {currentProvider === 'ollama' && (
          <Box marginTop={1}>
            <Text color={Colors.AccentBlue}>
              Example: ollama pull llama3.2:latest
            </Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={Colors.Gray}>(Press Escape to close)</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Choose AI model</Text>
      <Box marginTop={1}>
        <Text>Select a model for {currentProvider}:</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialModelIndex}
          onSelect={handleModelSelect}
          isFocused={true}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Use Enter to select, Escape to cancel)</Text>
      </Box>
    </Box>
  );
}
