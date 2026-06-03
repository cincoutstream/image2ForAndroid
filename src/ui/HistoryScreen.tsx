import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { deleteHistoryItems, listHistoryItems } from "../storage/historyStore";
import {
  deleteLocalImagesForHistoryItems,
  exportImageToLibrary,
} from "../storage/imageStorage";
import { useAppStore } from "../store/useAppStore";
import type { GenerationHistory } from "../types";
import { colors, Message, PrimaryButton, Screen } from "./components";

export function HistoryScreen() {
  const historyItems = useAppStore((state) => state.historyItems);
  const setHistoryItems = useAppStore((state) => state.setHistoryItems);
  const editFromHistory = useAppStore((state) => state.editFromHistory);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [status, setStatus] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected =
    historyItems.length > 0 && selectedIds.length === historyItems.length;

  async function refresh() {
    setHistoryItems(await listHistoryItems());
  }

  useEffect(() => {
    void refresh();
  }, []);

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function toggleSelectionMode() {
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    setSelectionMode(true);
    setSelectedIds([]);
    setStatus("");
  }

  function toggleItemSelection(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(historyItems.map((item) => item.id));
  }

  async function removeHistoryItems(items: GenerationHistory[]) {
    if (items.length === 0) return;

    await deleteLocalImagesForHistoryItems(items);
    await deleteHistoryItems(items.map((item) => item.id));
    setHistoryItems(await listHistoryItems());
    setSelectedIds((current) =>
      current.filter((id) => !items.some((item) => item.id === id)),
    );
  }

  async function deleteSingleItem(item: GenerationHistory) {
    try {
      await removeHistoryItems([item]);
      setStatus("已删除 1 条记录。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "删除失败。");
    }
  }

  async function deleteSelectedItems() {
    if (selectedIds.length === 0) {
      setStatus("请先选择要删除的记录。");
      return;
    }

    const items = historyItems.filter((item) => selectedIdSet.has(item.id));
    try {
      await removeHistoryItems(items);
      setStatus(`已删除 ${items.length} 条记录。`);
      exitSelectionMode();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "批量删除失败。");
    }
  }

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
      <View style={styles.toolbar}>
        <PrimaryButton label="刷新历史" onPress={() => void refresh()} />
        <Pressable
          onPress={toggleSelectionMode}
          style={[styles.secondaryButton, selectionMode && styles.secondaryButtonActive]}
        >
          <Text
            style={[
              styles.secondaryButtonText,
              selectionMode && styles.secondaryButtonTextActive,
            ]}
          >
            {selectionMode ? "取消选择" : "批量管理"}
          </Text>
        </Pressable>
      </View>

      {selectionMode && (
        <View style={styles.batchBar}>
          <Pressable onPress={toggleSelectAll} style={styles.batchAction}>
            <Text style={styles.batchActionText}>
              {allSelected ? "取消全选" : "全选"}
            </Text>
          </Pressable>
          <Text style={styles.batchCount}>已选 {selectedIds.length} 条</Text>
          <Pressable
            onPress={() => void deleteSelectedItems()}
            disabled={selectedIds.length === 0}
            style={[
              styles.deleteButton,
              selectedIds.length === 0 && styles.deleteButtonDisabled,
            ]}
          >
            <Text style={styles.deleteButtonText}>
              删除已选{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Text>
          </Pressable>
        </View>
      )}

      <Message text={status} />

      <ScrollView contentContainerStyle={styles.content}>
        {historyItems.length === 0 && (
          <Text style={styles.empty}>还没有历史记录。生成成功后会显示在这里。</Text>
        )}

        {historyItems.map((item) => {
          const selected = selectedIdSet.has(item.id);

          return (
            <View
              key={item.id}
              style={[styles.card, selectionMode && selected && styles.cardSelected]}
            >
              {selectionMode && (
                <Pressable
                  onPress={() => toggleItemSelection(item.id)}
                  style={styles.checkboxRow}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                    {selected && <Text style={styles.checkboxMark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>
                    {selected ? "已选中" : "点击选中"}
                  </Text>
                </Pressable>
              )}

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
                {!selectionMode && (
                  <>
                    <PrimaryButton label="再次编辑" onPress={() => editAgain(item)} />
                    <PrimaryButton
                      label="下载首图"
                      onPress={() => void exportFirstImage(item)}
                      disabled={item.outputImages.length === 0}
                    />
                  </>
                )}
                <Pressable
                  onPress={() => void deleteSingleItem(item)}
                  style={styles.deleteOutlineButton}
                >
                  <Text style={styles.deleteOutlineText}>删除此条</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    gap: 10,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.panel,
    paddingVertical: 12,
  },
  secondaryButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.panelStrong,
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButtonTextActive: {
    color: colors.accent,
  },
  batchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: colors.panel,
    padding: 12,
  },
  batchAction: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  batchActionText: {
    color: colors.accent,
    fontWeight: "700",
  },
  batchCount: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
  },
  deleteButton: {
    borderRadius: 12,
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },
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
  cardSelected: {
    borderColor: colors.accent,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderColor: colors.line,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong,
  },
  checkboxChecked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkboxMark: {
    color: "#051018",
    fontSize: 14,
    fontWeight: "800",
  },
  checkboxLabel: {
    color: colors.muted,
    fontSize: 13,
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
  deleteOutlineButton: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
  },
  deleteOutlineText: {
    color: colors.danger,
    fontWeight: "700",
  },
});
