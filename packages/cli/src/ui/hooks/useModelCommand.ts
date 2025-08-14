/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { LoadedSettings, SettingScope } from '../../config/settings.js';
import { Config } from '@google/gemini-cli-core';

export const useModelCommand = (
  settings: LoadedSettings,
  setModelError: (error: string | null) => void,
  setCurrentModel: (model: string) => void,
  config: Config,
) => {
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);

  const openModelDialog = useCallback(() => {
    setIsModelDialogOpen(true);
  }, []);

  const handleModelSelect = useCallback(
    async (model: string | undefined, scope: SettingScope) => {
      if (model) {
        settings.setValue(scope, 'model', model);

        // Update environment variable for the new model
        process.env.GEMINI_MODEL = model;

        // Reinitialize the client with the new model
        try {
          await config.refreshModel();
          console.log(`Model changed to: ${model}`);

          // Set the current model after refresh is complete to ensure it sticks
          setCurrentModel(model);
        } catch (error) {
          setModelError(`Failed to switch model: ${error}`);
          console.error('Failed to refresh model:', error);
        }
      }
      setIsModelDialogOpen(false);
      setModelError(null);
    },
    [settings, setModelError, setCurrentModel, config],
  );

  return {
    isModelDialogOpen,
    openModelDialog,
    handleModelSelect,
  };
};
