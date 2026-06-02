import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  getApiKey,
  getProviderConfig,
  getProviderConfigs,
  saveApiKey,
  saveProviderConfig,
  saveProviderConfigs,
} from "../security/credentialStore";
import { useAppStore } from "../store/useAppStore";
import {
  commonImageSizes,
  commonModelNames,
  defaultProviderConfig,
  type ImageInputMode,
  type ResponseFormat,
  type SavedProviderConfig,
} from "../types";
import {
  colors,
  Field,
  Message,
  OptionGroup,
  PrimaryButton,
  Screen,
} from "./components";

const responseFormatOptions: ResponseFormat[] = ["url", "b64_json"];
const imageInputModeOptions: ImageInputMode[] = [
  "chat_messages",
  "json_base64",
  "multipart",
];
const streamOptions = ["true", "false"] as const;

export function ConfigScreen() {
  const providerConfigs = useAppStore((state) => state.providerConfigs);
  const setProvider = useAppStore((state) => state.setProvider);
  const setProviderConfigs = useAppStore((state) => state.setProviderConfigs);
  const [draftProvider, setDraftProvider] = useState(defaultProviderConfig);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [configName, setConfigName] = useState("");
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const [savedConfig, savedConfigs, savedApiKey] = await Promise.all([
        getProviderConfig(),
        getProviderConfigs(),
        getApiKey(),
      ]);
      setProviderConfigs(savedConfigs);
      setProvider(savedConfig ?? defaultProviderConfig);
      setApiKey(savedApiKey);
      clearForm();
    })();
  }, [setProvider, setProviderConfigs]);

  function clearForm() {
    setDraftProvider(defaultProviderConfig);
    setConfigName("");
      setEditingConfigId(null);
    setIsFormOpen(false);
  }

  async function handleSave() {
    const trimmedName = configName.trim();
    if (!trimmedName) {
      setStatus("配置名称不能为空。");
      return;
    }

    const duplicateConfig = providerConfigs.find(
      (config) => config.name === trimmedName && config.id !== editingConfigId,
    );
    if (duplicateConfig) {
      setStatus(`配置名称“${trimmedName}”已存在，请换一个名称。`);
      return;
    }

    const savedConfig: SavedProviderConfig = {
      id: editingConfigId ?? trimmedName,
      name: trimmedName,
      ...draftProvider,
    };
    const existingIndex = providerConfigs.findIndex(
      (config) => config.id === savedConfig.id,
    );
    const nextConfigs =
      existingIndex >= 0
        ? providerConfigs.map((config) =>
            config.id === savedConfig.id ? savedConfig : config,
          )
        : [savedConfig, ...providerConfigs];

    await Promise.all([
      saveProviderConfig(savedConfig),
      saveProviderConfigs(nextConfigs),
      saveApiKey(apiKey),
    ]);
    setProviderConfigs(nextConfigs);
    setProvider(savedConfig);
    setStatus(
      existingIndex >= 0
        ? `已更新配置：${savedConfig.name}`
        : `已新增配置：${savedConfig.name}`,
    );
    clearForm();
  }

  async function handleSaveApiKey() {
    await saveApiKey(apiKey);
    setStatus("API Key 已保存。");
  }

  async function selectConfig(config: SavedProviderConfig) {
    setProvider(config);
    await saveProviderConfig(config);
    setStatus(`当前使用配置：${config.name}`);
  }

  function editConfig(config: SavedProviderConfig) {
    setDraftProvider(config);
    setConfigName(config.name);
    setEditingConfigId(config.id);
    setIsFormOpen(true);
    setStatus(`正在修改配置：${config.name}`);
  }

  function openCreateConfigForm() {
    setDraftProvider(defaultProviderConfig);
    setConfigName("");
    setEditingConfigId(null);
    setIsFormOpen(true);
    setStatus("正在新建配置。");
  }

  async function deleteConfig(configId: string) {
    const nextConfigs = providerConfigs.filter((config) => config.id !== configId);
    await saveProviderConfigs(nextConfigs);
    setProviderConfigs(nextConfigs);
    setStatus("配置已删除。");
  }

  return (
    <Screen title="设置">
      <ScrollView contentContainerStyle={{ gap: 14 }}>
        <Field
          label="API Key"
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="sk-..."
          secureTextEntry
        />
        <PrimaryButton label="保存 API Key" onPress={handleSaveApiKey} />
        <PrimaryButton
          label={isFormOpen ? "收起配置表单" : "配置"}
          onPress={() => {
            if (isFormOpen) {
              clearForm();
            } else {
              openCreateConfigForm();
            }
          }}
        />
        {isFormOpen && (
          <View style={styles.formPanel}>
            <Field
              label="配置名称"
              value={configName}
              onChangeText={setConfigName}
              placeholder="名称必须唯一，例如：gpt-image-2-pro url"
            />
            <Field
              label="Base URL"
              value={draftProvider.baseUrl}
              onChangeText={(baseUrl) =>
                setDraftProvider({ ...draftProvider, baseUrl })
              }
            />
            <Field
              label="Endpoint"
              value={draftProvider.endpoint}
              onChangeText={(endpoint) =>
                setDraftProvider({ ...draftProvider, endpoint })
              }
            />
            <Field
              label="Model"
              value={draftProvider.model}
              onChangeText={(model) =>
                setDraftProvider({ ...draftProvider, model })
              }
            />
            <Field
              label="Group"
              value={draftProvider.group}
              onChangeText={(group) =>
                setDraftProvider({ ...draftProvider, group })
              }
              placeholder="例如：vip_2_image"
            />
            <OptionGroup
              label="常用模型"
              options={commonModelNames}
              value={draftProvider.model}
              onChange={(model) => {
                setDraftProvider({ ...draftProvider, model });
                if (!configName.trim()) {
                  setConfigName(model);
                }
              }}
            />
            <OptionGroup
              label="Size"
              options={commonImageSizes}
              value={draftProvider.size}
              onChange={(size) => setDraftProvider({ ...draftProvider, size })}
            />
            <OptionGroup
              label="Response Format"
              options={responseFormatOptions}
              value={draftProvider.responseFormat}
              onChange={(responseFormat) =>
                setDraftProvider({ ...draftProvider, responseFormat })
              }
            />
            <OptionGroup
              label="参考图传输方式"
              options={imageInputModeOptions}
              value={draftProvider.imageInputMode}
              onChange={(imageInputMode) =>
                setDraftProvider({ ...draftProvider, imageInputMode })
              }
            />
            <OptionGroup
              label="Stream"
              options={streamOptions}
              value={String(draftProvider.stream)}
              onChange={(stream) =>
                setDraftProvider({
                  ...draftProvider,
                  stream: stream === "true",
                })
              }
            />
            <PrimaryButton
              label={editingConfigId ? "保存修改" : "保存为新配置"}
              onPress={handleSave}
            />
          </View>
        )}
        <Message text={status} />

        <View style={styles.configList}>
          <Text style={styles.sectionTitle}>已保存配置</Text>
          {providerConfigs.length === 0 && (
            <Text style={styles.mutedText}>还没有保存的模型配置。</Text>
          )}
          {providerConfigs.map((config) => (
            <View key={config.id} style={styles.configCard}>
              <View style={styles.configInfo}>
                <Text style={styles.configName}>
                  {config.name}
                  {editingConfigId === config.id ? "（编辑中）" : ""}
                </Text>
                <Text style={styles.configMeta}>
                  {config.model} / {config.size} / {config.responseFormat}
                </Text>
              </View>
              <View style={styles.configActions}>
                <Pressable
                  style={styles.smallButton}
                  onPress={() => void selectConfig(config)}
                >
                  <Text style={styles.smallButtonText}>使用</Text>
                </Pressable>
                <Pressable
                  style={styles.smallButton}
                  onPress={() => editConfig(config)}
                >
                  <Text style={styles.smallButtonText}>修改</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallButton, styles.deleteButton]}
                  onPress={() => void deleteConfig(config.id)}
                >
                  <Text style={styles.smallButtonText}>删除</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  configList: {
    gap: 10,
  },
  formPanel: {
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: colors.panel,
    gap: 14,
    padding: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  mutedText: {
    color: colors.muted,
  },
  configCard: {
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.panel,
    gap: 12,
    padding: 12,
  },
  configInfo: {
    gap: 4,
  },
  configName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  configMeta: {
    color: colors.muted,
  },
  configActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  deleteButton: {
    borderColor: colors.danger,
  },
  smallButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
});
