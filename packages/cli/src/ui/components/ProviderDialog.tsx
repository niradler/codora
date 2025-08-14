/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType } from '@google/gemini-cli-core';
import { validateAuthMethod } from '../../config/auth.js';
import { loadEnvironment } from '../../config/settings.js';

export type ProviderType = 'gemini' | 'ollama' | 'bedrock' | 'openai';

export interface ProviderSelection {
  provider: ProviderType;
  authType?: AuthType | 'none';
}

const validateProviderRequirements = (
  provider: ProviderType,
): string | null => {
  loadEnvironment();

  switch (provider) {
    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        return 'OPENAI_API_KEY environment variable not found. Please set your OpenAI API key in your environment and try again.';
      }
      return null;

    case 'bedrock':
      if (!process.env.AWS_REGION && !process.env.AWS_DEFAULT_REGION) {
        return 'AWS_REGION environment variable not found. Please configure your AWS region and credentials.';
      }
      return null;

    case 'ollama':
      // Ollama is local and doesn't require API keys, but we can check if base URL is accessible
      return null;

    case 'gemini':
      // Gemini validation is handled by the existing auth validation
      return null;

    default:
      return null;
  }
};

interface ProviderDialogProps {
  onSelect: (
    selection: ProviderSelection | undefined,
    scope: SettingScope,
  ) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
  onTriggerAuth?: (authType: AuthType) => void;
}

export function ProviderDialog({
  onSelect,
  settings,
  initialErrorMessage,
  onTriggerAuth,
}: ProviderDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );

  // Load environment to check for API keys
  loadEnvironment();

  const items = [
    {
      label: 'Gemini - Login with Google',
      value: {
        provider: 'gemini' as ProviderType,
        authType: AuthType.LOGIN_WITH_GOOGLE,
      },
    },
    ...(process.env.CLOUD_SHELL === 'true'
      ? [
          {
            label: 'Gemini - Use Cloud Shell credentials',
            value: {
              provider: 'gemini' as ProviderType,
              authType: AuthType.CLOUD_SHELL,
            },
          },
        ]
      : []),
    {
      label: 'Gemini - Use API Key',
      value: {
        provider: 'gemini' as ProviderType,
        authType: AuthType.USE_GEMINI,
      },
    },
    {
      label: 'Gemini - Vertex AI',
      value: {
        provider: 'gemini' as ProviderType,
        authType: AuthType.USE_VERTEX_AI,
      },
    },
    {
      label: 'Ollama (Local)',
      value: { provider: 'ollama' as ProviderType, authType: 'none' as const },
    },
    {
      label: 'AWS Bedrock',
      value: { provider: 'bedrock' as ProviderType, authType: 'none' as const },
    },
    {
      label: `OpenAI${!process.env.OPENAI_API_KEY ? ' (requires OPENAI_API_KEY)' : ''}`,
      value: { provider: 'openai' as ProviderType, authType: 'none' as const },
    },
  ];

  const initialProviderIndex = items.findIndex((item) => {
    if (settings.merged.selectedProvider && settings.merged.selectedAuthType) {
      return (
        item.value.provider === settings.merged.selectedProvider &&
        item.value.authType === settings.merged.selectedAuthType
      );
    }
    if (settings.merged.selectedProvider) {
      return item.value.provider === settings.merged.selectedProvider;
    }
    return false;
  });

  const handleProviderSelect = (selection: ProviderSelection) => {
    // First validate provider-specific requirements
    const providerError = validateProviderRequirements(selection.provider);
    if (providerError) {
      setErrorMessage(providerError);
      return;
    }

    // For Gemini, validate auth method and trigger auth flow if needed
    if (
      selection.provider === 'gemini' &&
      selection.authType &&
      selection.authType !== 'none'
    ) {
      const authError = validateAuthMethod(
        selection.authType,
        selection.provider,
      );
      if (authError) {
        setErrorMessage(authError);
        return;
      }

      // For Google login, trigger the authentication flow
      if (selection.authType === AuthType.LOGIN_WITH_GOOGLE && onTriggerAuth) {
        onTriggerAuth(selection.authType);
      }
    }

    setErrorMessage(null);
    onSelect(selection, SettingScope.User);
  };

  useInput((_input, key) => {
    if (key.escape) {
      if (errorMessage) {
        return;
      }
      if (settings.merged.selectedProvider === undefined) {
        setErrorMessage(
          'You must select a provider to proceed. Press Ctrl+C twice to exit.',
        );
        return;
      }
      onSelect(undefined, SettingScope.User);
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Choose your AI provider and authentication</Text>
      <Box marginTop={1}>
        <Text>
          Select your preferred AI provider and authentication method:
        </Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialProviderIndex}
          onSelect={handleProviderSelect}
          isFocused={true}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.Gray}>(Use Enter to select)</Text>
      </Box>
    </Box>
  );
}
