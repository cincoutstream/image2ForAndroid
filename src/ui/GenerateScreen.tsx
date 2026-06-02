import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getApiKey } from "../security/credentialStore";
import { exportImageToLibrary } from "../storage/imageStorage";
import { listHistoryItems } from "../storage/historyStore";
import { useAppStore } from "../store/useAppStore";
import { runGenerationTask } from "../tasks/generationTaskManager";
import type { ImageInput, SavedProviderConfig, SupportedImageMimeType } from "../types";
import { commonImageSizes } from "../types";
import {
  colors,
  Field,
  Message,
  OptionGroup,
  PrimaryButton,
  Screen,
} from "./components";

function toSupportedMimeType(value?: string | null): SupportedImageMimeType | null {
  if (value === "image/png" || value === "image/jpeg" || value === "image/webp") {
    return value;
  }
  return null;
}

function reindexImages(images: ImageInput[]): ImageInput[] {
  return images.map((image, index) => ({
    ...image,
    index: index + 1,
  }));
}

export function GenerateScreen() {
  const provider = useAppStore((state) => state.provider);
  const providerConfigs = useAppStore((state) => state.providerConfigs);
  const prompt = useAppStore((state) => state.prompt);
  const inputImages = useAppStore((state) => state.inputImages);
  const outputImages = useAppStore((state) => state.outputImages);
  const isGenerating = useAppStore((state) => state.isGenerating);
  const errorMessage = useAppStore((state) => state.errorMessage);
  const debugLogs = useAppStore((state) => state.debugLogs);
  const setPrompt = useAppStore((state) => state.setPrompt);
  const setProvider = useAppStore((state) => state.setProvider);
  const setInputImages = useAppStore((state) => state.setInputImages);
  const setOutputImages = useAppStore((state) => state.setOutputImages);
  const setHistoryItems = useAppStore((state) => state.setHistoryItems);
  const setIsGenerating = useAppStore((state) => state.setIsGenerating);
  const setErrorMessage = useAppStore((state) => state.setErrorMessage);
  const appendDebugLog = useAppStore((state) => state.appendDebugLog);
  const clearDebugLogs = useAppStore((state) => state.clearDebugLogs);
  const [expandedLogIds, setExpandedLogIds] = useState<string[]>([]);

  function selectProviderConfig(config: SavedProviderConfig) {
    setProvider(config);
    appendDebugLog(
      `已切换模型配置：${config.name} / ${config.model} / ${config.size}`,
    );
  }

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage("没有相册读取权限，无法选择参考图。");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ["images"],
      quality: 1,
    });

    if (result.canceled) return;

    const images: ImageInput[] = [];
    for (const [assetIndex, asset] of result.assets.entries()) {
      const mimeType = toSupportedMimeType(asset.mimeType);
      if (!mimeType) {
        setErrorMessage("第一版只支持 PNG、JPG/JPEG、WEBP 图片。");
        return;
      }

      const base64Data = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      images.push({
        index: assetIndex + 1,
        localUri: asset.uri,
        mimeType,
        displayName: asset.fileName ?? `图 ${assetIndex + 1}`,
        base64Data,
      });
    }

    setInputImages(images);
    appendDebugLog(
      `已选择 ${images.length} 张参考图：${images
        .map((image) => `图 ${image.index}=${image.displayName ?? image.localUri}`)
        .join("；")}`,
      {
        images: images.map((image) => ({
          index: image.index,
          uri: image.localUri,
          mimeType: image.mimeType,
          displayName: image.displayName,
          base64Length: image.base64Data?.length ?? 0,
          hasBase64Data: Boolean(image.base64Data),
        })),
      },
    );
    setErrorMessage(undefined);
  }

  function removeImage(imageIndex: number) {
    const nextImages = reindexImages(
      inputImages.filter((image) => image.index !== imageIndex),
    );
    setInputImages(nextImages);
    appendDebugLog(`已删除图 ${imageIndex}，剩余 ${nextImages.length} 张参考图。`);
  }

  function moveImage(imageIndex: number, direction: -1 | 1) {
    const currentIndex = inputImages.findIndex((image) => image.index === imageIndex);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= inputImages.length) {
      return;
    }

    const nextImages = [...inputImages];
    const current = nextImages[currentIndex];
    nextImages[currentIndex] = nextImages[targetIndex];
    nextImages[targetIndex] = current;
    setInputImages(reindexImages(nextImages));
    appendDebugLog(`已调整图 ${imageIndex} 的顺序。`);
  }

  async function downloadOutputImage(localUri: string) {
    try {
      await exportImageToLibrary(localUri);
      appendDebugLog("当前输出图片已保存到系统相册。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "下载图片失败。");
    }
  }

  async function generate() {
    const apiKey = await getApiKey();
    if (!apiKey.trim()) {
      setErrorMessage("请先到设置页填写并保存 API Key。");
      return;
    }

    if (!prompt.trim()) {
      setErrorMessage("请输入提示词。");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(undefined);
    clearDebugLogs();

    const request = {
      provider,
      apiKey,
      prompt,
      inputImages,
    };
    appendDebugLog("生成任务开始", {
      model: provider.model,
      size: provider.size,
      endpoint: provider.endpoint,
      imageInputMode: provider.imageInputMode,
      prompt,
      imageCount: inputImages.length,
    });

    const historyItem = await runGenerationTask(request, (payload) =>
      appendDebugLog(payload.summary, payload.details),
    );

    if (historyItem?.status === "success") {
      setOutputImages(historyItem.outputImages);
      appendDebugLog(`生成成功，保存 ${historyItem.outputImages.length} 张输出图。`);
    } else if (historyItem?.status === "failed") {
      setErrorMessage(historyItem.errorMessage);
      appendDebugLog(`生成失败：${historyItem.errorMessage ?? "未知错误"}`);
    } else {
      appendDebugLog("请求已被新的生成任务取消。");
    }

    setHistoryItems(await listHistoryItems());
    setIsGenerating(false);
  }

  return (
    <Screen title="生成">
      <ScrollView contentContainerStyle={styles.content}>
        {providerConfigs.length > 0 && (
          <View style={styles.configSelector}>
            <Text style={styles.sectionTitle}>模型配置</Text>
            <View style={styles.configPills}>
              {providerConfigs.map((config) => {
                const active =
                  config.model === provider.model &&
                  config.baseUrl === provider.baseUrl &&
                  config.endpoint === provider.endpoint;
                return (
                  <Pressable
                    key={config.id}
                    onPress={() => selectProviderConfig(config)}
                    style={[styles.configPill, active && styles.configPillActive]}
                  >
                    <Text
                      style={[
                        styles.configPillTitle,
                        active && styles.configPillTitleActive,
                      ]}
                    >
                      {config.name}
                    </Text>
                    <Text style={styles.configPillMeta}>
                      {config.model} / {config.responseFormat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <OptionGroup
          label="当前尺寸"
          options={commonImageSizes}
          value={provider.size}
          onChange={(size) => {
            setProvider({ ...provider, size });
            appendDebugLog(`已切换尺寸：${size}`);
          }}
        />

        <Field
          label="Prompt"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="描述你想生成的图片。多图时可写第一张图、第二张图..."
          multiline
        />

        <PrimaryButton label="选择参考图" onPress={pickImages} />

        {inputImages.length > 0 && (
          <View style={styles.imageGrid}>
            {inputImages.map((image) => (
              <View key={`${image.index}-${image.localUri}`} style={styles.imageCard}>
                <Image source={{ uri: image.localUri }} style={styles.thumb} />
                <Text style={styles.caption}>图 {image.index}</Text>
                <View style={styles.imageActions}>
                  <SmallAction
                    label="上移"
                    onPress={() => moveImage(image.index, -1)}
                    disabled={image.index === 1}
                  />
                  <SmallAction
                    label="下移"
                    onPress={() => moveImage(image.index, 1)}
                    disabled={image.index === inputImages.length}
                  />
                  <SmallAction label="删除" onPress={() => removeImage(image.index)} />
                </View>
              </View>
            ))}
          </View>
        )}

        <PrimaryButton
          label={isGenerating ? "生成中..." : "开始生成 / 重新生成"}
          onPress={generate}
          loading={isGenerating}
        />

        <Message text={errorMessage} tone="error" />

        {outputImages.length > 0 && (
          <View style={styles.outputList}>
            <Text style={styles.sectionTitle}>当前输出</Text>
            {outputImages.map((image) => (
              <View key={image.value} style={styles.outputCard}>
                <Image source={{ uri: image.value }} style={styles.outputImage} />
                <PrimaryButton
                  label="下载这张图到相册"
                  onPress={() => void downloadOutputImage(image.value)}
                />
              </View>
            ))}
          </View>
        )}

        {debugLogs.length > 0 && (
          <View style={styles.debugPanel}>
            <Text style={styles.sectionTitle}>调试日志</Text>
            {debugLogs.map((log) => {
              const expanded = expandedLogIds.includes(log.id);
              return (
                <Pressable
                  key={log.id}
                  onPress={() =>
                    setExpandedLogIds((ids) =>
                      expanded
                        ? ids.filter((id) => id !== log.id)
                        : [log.id, ...ids],
                    )
                  }
                  style={styles.debugEntry}
                >
                  <Text style={styles.debugLine}>
                    {log.createdAt} {log.summary}
                  </Text>
                  {expanded && log.details && (
                    <Text style={styles.debugDetails}>{log.details}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SmallAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.smallAction, disabled && styles.smallActionDisabled]}
    >
      <Text style={styles.smallActionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 40,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  configSelector: {
    gap: 8,
  },
  configPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  configPill: {
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.panel,
    minWidth: 140,
    padding: 10,
  },
  configPillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.panelStrong,
  },
  configPillTitle: {
    color: colors.text,
    fontWeight: "800",
  },
  configPillTitleActive: {
    color: colors.accent,
  },
  configPillMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  imageCard: {
    width: 112,
    gap: 6,
  },
  thumb: {
    width: 112,
    height: 112,
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  caption: {
    color: colors.muted,
    textAlign: "center",
  },
  outputList: {
    gap: 12,
  },
  outputCard: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  outputImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: colors.panel,
  },
  imageActions: {
    gap: 6,
  },
  smallAction: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 6,
  },
  smallActionDisabled: {
    opacity: 0.35,
  },
  smallActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  debugPanel: {
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.panel,
    gap: 8,
    padding: 12,
  },
  debugLine: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  debugEntry: {
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 8,
  },
  debugDetails: {
    color: colors.text,
    fontFamily: "monospace",
    fontSize: 11,
    lineHeight: 16,
  },
});
