/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { AuthType, Config } from '@google/gemini-cli-core';
import type { ProviderSelection } from '../components/ProviderDialog.js';

export const useProviderCommand = (
  settings: LoadedSettings,
  setProviderError: (error: string | null) => void,
  config: Config,
) => {
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(
    settings.merged.selectedProvider === undefined,
  );

  const openProviderDialog = useCallback(() => {
    setIsProviderDialogOpen(true);
  }, []);

  const handleProviderSelect = useCallback(
    async (selection: ProviderSelection | undefined, scope: SettingScope) => {
      if (selection) {
        settings.setValue(scope, 'selectedProvider', selection.provider);
        if (selection.authType === 'none') {
          settings.setValue(scope, 'selectedAuthType', undefined);
        } else if (selection.authType) {
          settings.setValue(scope, 'selectedAuthType', selection.authType);
        }

        // Update environment variable for the new provider
        process.env.CODORA_PROVIDER = selection.provider;

        // Reinitialize the client with the new provider/auth
        try {
          if (selection.authType && selection.authType !== 'none') {
            await config.refreshAuth(selection.authType);
          } else {
            await config.refreshModel();
          }
          console.log(`Provider changed to: ${selection.provider}`);
        } catch (error) {
          setProviderError(`Failed to switch provider: ${error}`);
          console.error('Failed to refresh provider:', error);
        }
      }
      setIsProviderDialogOpen(false);
      setProviderError(null);
    },
    [settings, setProviderError, config],
  );

  const handleTriggerAuth = useCallback(
    async (authType: AuthType) => {
      try {
        await config.refreshAuth(authType);
        console.log(`Successfully authenticated via "${authType}".`);
      } catch (error) {
        setProviderError(`Authentication failed: ${error}`);
      }
    },
    [config, setProviderError],
  );

  return {
    isProviderDialogOpen,
    openProviderDialog,
    handleProviderSelect,
    handleTriggerAuth,
  };
};
