import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { exportImageToLibrary } from "../storage/imageStorage";
import { listHistoryItems } from "../storage/historyStore";
import { useAppStore } from "../store/useAppStore";
import type { GenerationHistory } from "../types";
import { colors, Message, PrimaryButton, Screen } from "./components";

export function HistoryScreen() {
  const historyItems = useAppStore((state) => state.historyItems);
  const setHistoryItems = useAppStore((state) => state.setHistoryItems);
  const editFromHistory = useAppStore((state) => state.editFromHistory);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [status, setStatus] = useState("");

  async function refresh() {
    setHistoryItems(await listHistoryItems());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function exportFirstImage(item: GenerationHistory) {
    const firstImage = item.outputImages[0];
    if (!firstImage || firstImage.type !== "local") {
      setStatus("这条记录没有可导出的本地图片。");
      return;
    }

    await exportImageToLibrary(firstImage.value);
    setStatus("已导出到系统相册。");
  }

  function editAgain(item: GenerationHistory) {
    editFromHistory(item);
    setActiveTab("generate");
  }

  return (
    <Screen title="历史">
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton label="刷新历史" onPress={refresh} />
        <Message text={status} />

        {historyItems.length === 0 && (
          <Text style={styles.empty}>还没有历史记录。生成成功后会显示在这里。</Text>
        )}

        {historyItems.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
            <Text style={styles.prompt}>{item.prompt}</Text>
            <Text style={styles.meta}>
              {item.provider.model} / {item.provider.size} / {item.status}
            </Text>
            {item.errorMessage && (
              <Text style={styles.error}>{item.errorMessage}</Text>
            )}

            {item.inputImages.length > 0 && (
              <View style={styles.row}>
                {item.inputImages.map((image) => (
                  <View key={`${item.id}-${image.index}`} style={styles.smallCard}>
                    <Image source={{ uri: image.localUri }} style={styles.smallImage} />
                    <Text style={styles.caption}>图 {image.index}</Text>
                  </View>
                ))}
              </View>
            )}

            {item.outputImages.length > 0 && (
              <View style={styles.outputGrid}>
                {item.outputImages.map((image) => (
                  <Image
                    key={`${item.id}-${image.value}`}
                    source={{ uri: image.value }}
                    style={styles.outputImage}
                  />
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <PrimaryButton label="再次编辑" onPress={() => editAgain(item)} />
              <PrimaryButton
                label="下载首图"
                onPress={() => void exportFirstImage(item)}
                disabled={item.outputImages.length === 0}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingBottom: 40,
  },
  empty: {
    color: colors.muted,
    lineHeight: 22,
  },
  card: {
    borderColor: colors.line,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.panel,
    gap: 10,
    padding: 14,
  },
  time: {
    color: colors.muted,
    fontSize: 12,
  },
  prompt: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  meta: {
    color: colors.muted,
  },
  error: {
    color: colors.danger,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  smallCard: {
    width: 74,
    gap: 4,
  },
  smallImage: {
    width: 74,
    height: 74,
    borderRadius: 12,
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
  outputGrid: {
    gap: 10,
  },
  outputImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
  },
  actions: {
    gap: 10,
  },
});
