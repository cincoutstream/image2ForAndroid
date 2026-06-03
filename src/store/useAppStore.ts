import { create } from "zustand";

import type {
  DebugLogEntry,
  GenerationHistory,
  ImageInput,
  ImageResult,
  ProviderConfig,
  SavedProviderConfig,
} from "../types";
import { normalizeProviderConfig } from "../security/credentialStore";
import { defaultProviderConfig, defaultSavedProviderConfigs } from "../types";

function formatLogDetails(details: unknown): string | undefined {
  if (typeof details === "undefined") return undefined;
  return typeof details === "string" ? details : JSON.stringify(details, null, 2);
}

function printLogToConsole(summary: string, details?: unknown): void {
  const formattedDetails = formatLogDetails(details);
  if (formattedDetails) {
    console.log(`[Image2 请求日志] ${summary}\n${formattedDetails}`);
    return;
  }

  console.log(`[Image2 请求日志] ${summary}`);
}

type AppTab = "generate" | "history" | "config";

type AppState = {
  activeTab: AppTab;
  provider: ProviderConfig;
  activeProviderConfigId?: string;
  providerConfigs: SavedProviderConfig[];
  prompt: string;
  inputImages: ImageInput[];
  outputImages: ImageResult[];
  historyItems: GenerationHistory[];
  isGenerating: boolean;
  errorMessage?: string;
  debugLogs: DebugLogEntry[];
  setActiveTab: (tab: AppTab) => void;
  setProvider: (provider: ProviderConfig) => void;
  setActiveProviderConfigId: (configId?: string) => void;
  setProviderConfigs: (configs: SavedProviderConfig[]) => void;
  setPrompt: (prompt: string) => void;
  setInputImages: (images: ImageInput[]) => void;
  setOutputImages: (images: ImageResult[]) => void;
  setHistoryItems: (items: GenerationHistory[]) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setErrorMessage: (message?: string) => void;
  appendDebugLog: (summary: string, details?: unknown) => void;
  clearDebugLogs: () => void;
  editFromHistory: (item: GenerationHistory) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeTab: "generate",
  provider: defaultProviderConfig,
  activeProviderConfigId: defaultSavedProviderConfigs[0]?.id,
  providerConfigs: defaultSavedProviderConfigs,
  prompt: "",
  inputImages: [],
  outputImages: [],
  historyItems: [],
  isGenerating: false,
  errorMessage: undefined,
  debugLogs: [],
  setActiveTab: (activeTab) => set({ activeTab }),
  setProvider: (provider) => set({ provider: normalizeProviderConfig(provider) }),
  setActiveProviderConfigId: (activeProviderConfigId) =>
    set({ activeProviderConfigId }),
  setProviderConfigs: (providerConfigs) => set({ providerConfigs }),
  setPrompt: (prompt) => set({ prompt }),
  setInputImages: (inputImages) => set({ inputImages }),
  setOutputImages: (outputImages) => set({ outputImages }),
  setHistoryItems: (historyItems) => set({ historyItems }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  appendDebugLog: (summary, details) =>
    set((state) => {
      printLogToConsole(summary, details);
      return {
        debugLogs: [
          {
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            createdAt: new Date().toLocaleTimeString(),
            summary,
            details: formatLogDetails(details),
          },
          ...state.debugLogs,
        ].slice(0, 30),
      };
    }),
  clearDebugLogs: () => set({ debugLogs: [] }),
  editFromHistory: (item) =>
    set({
      activeTab: "generate",
      provider: normalizeProviderConfig(item.provider),
      activeProviderConfigId: undefined,
      prompt: item.prompt,
      inputImages: item.inputImages,
      outputImages: item.outputImages,
      errorMessage: undefined,
    }),
}));
