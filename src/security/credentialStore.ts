import * as SecureStore from "expo-secure-store";

import type { ProviderConfig, SavedProviderConfig } from "../types";
import { defaultProviderConfig, defaultSavedProviderConfigs } from "../types";

const API_KEY_STORAGE_KEY = "image2.apiKey";
const PROVIDER_CONFIG_STORAGE_KEY = "image2.providerConfig";
const PROVIDER_CONFIGS_STORAGE_KEY = "image2.providerConfigs";

export async function saveApiKey(apiKey: string): Promise<void> {
  const value = apiKey.trim();

  if (!value) {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
    return;
  }

  await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, value);
}

export async function getApiKey(): Promise<string> {
  return (await SecureStore.getItemAsync(API_KEY_STORAGE_KEY)) ?? "";
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  await SecureStore.setItemAsync(
    PROVIDER_CONFIG_STORAGE_KEY,
    JSON.stringify(config),
  );
}

export async function getProviderConfig(): Promise<ProviderConfig | null> {
  const value = await SecureStore.getItemAsync(PROVIDER_CONFIG_STORAGE_KEY);
  return value ? normalizeProviderConfig(JSON.parse(value) as ProviderConfig) : null;
}

export async function saveProviderConfigs(
  configs: SavedProviderConfig[],
): Promise<void> {
  await SecureStore.setItemAsync(
    PROVIDER_CONFIGS_STORAGE_KEY,
    JSON.stringify(configs),
  );
}

export async function getProviderConfigs(): Promise<SavedProviderConfig[]> {
  const value = await SecureStore.getItemAsync(PROVIDER_CONFIGS_STORAGE_KEY);
  if (value) {
    return (JSON.parse(value) as SavedProviderConfig[]).map((config) => ({
      ...normalizeProviderConfig(config),
      id: config.id,
      name: config.name,
    }));
  }

  const legacyConfig = await getProviderConfig();
  if (legacyConfig) {
    return [
      {
        id: "legacy-config",
        name: legacyConfig.model || "旧配置",
        ...normalizeProviderConfig(legacyConfig),
      },
    ];
  }

  return defaultSavedProviderConfigs;
}

export function normalizeProviderConfig(
  config: Partial<ProviderConfig>,
): ProviderConfig {
  return {
    ...defaultProviderConfig,
    ...config,
    baseUrl: (config.baseUrl ?? defaultProviderConfig.baseUrl).trim(),
    endpoint: (config.endpoint ?? defaultProviderConfig.endpoint).trim(),
    referenceEndpoint: (
      config.referenceEndpoint ?? defaultProviderConfig.referenceEndpoint
    ).trim(),
    model: (config.model ?? defaultProviderConfig.model).trim(),
    size: (config.size ?? defaultProviderConfig.size).trim(),
    group: (config.group ?? defaultProviderConfig.group).trim(),
    responseFormat:
      config.responseFormat ?? defaultProviderConfig.responseFormat,
    imageInputMode: "chat_messages",
    stream: config.stream ?? defaultProviderConfig.stream,
  };
}
