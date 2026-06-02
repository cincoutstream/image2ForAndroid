import { create } from "zustand";

import type {
  DebugLogEntry,
  GenerationHistory,
  ImageInput,
  ImageResult,
  ProviderConfig,
  SavedProviderConfig,
} from "../types";
import { defaultProviderConfig, defaultSavedProviderConfigs } from "../types";

type AppTab = "generate" | "history" | "config";

type AppState = {
  activeTab: AppTab;
  provider: ProviderConfig;
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
  providerConfigs: defaultSavedProviderConfigs,
  prompt: "",
  inputImages: [],
  outputImages: [],
  historyItems: [],
  isGenerating: false,
  errorMessage: undefined,
  debugLogs: [],
  setActiveTab: (activeTab) => set({ activeTab }),
  setProvider: (provider) => set({ provider }),
  setProviderConfigs: (providerConfigs) => set({ providerConfigs }),
  setPrompt: (prompt) => set({ prompt }),
  setInputImages: (inputImages) => set({ inputImages }),
  setOutputImages: (outputImages) => set({ outputImages }),
  setHistoryItems: (historyItems) => set({ historyItems }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  appendDebugLog: (summary, details) =>
    set((state) => ({
      debugLogs: [
        {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          createdAt: new Date().toLocaleTimeString(),
          summary,
          details:
            typeof details === "undefined"
              ? undefined
              : typeof details === "string"
                ? details
                : JSON.stringify(details, null, 2),
        },
        ...state.debugLogs,
      ].slice(0, 30),
    })),
  clearDebugLogs: () => set({ debugLogs: [] }),
  editFromHistory: (item) =>
    set({
      activeTab: "generate",
      provider: item.provider,
      prompt: item.prompt,
      inputImages: item.inputImages,
      outputImages: item.outputImages,
      errorMessage: undefined,
    }),
}));
