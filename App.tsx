import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import {
  getProviderConfig,
  getProviderConfigs,
} from "./src/security/credentialStore";
import { initHistoryStore, listHistoryItems } from "./src/storage/historyStore";
import { useAppStore } from "./src/store/useAppStore";
import { ConfigScreen } from "./src/ui/ConfigScreen";
import { GenerateScreen } from "./src/ui/GenerateScreen";
import { HistoryScreen } from "./src/ui/HistoryScreen";
import { colors } from "./src/ui/components";

export default function App() {
  const activeTab = useAppStore((state) => state.activeTab);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const setProvider = useAppStore((state) => state.setProvider);
  const setProviderConfigs = useAppStore((state) => state.setProviderConfigs);
  const setHistoryItems = useAppStore((state) => state.setHistoryItems);
  const setErrorMessage = useAppStore((state) => state.setErrorMessage);

  useEffect(() => {
    void (async () => {
      try {
        await initHistoryStore();
        const [savedProvider, savedConfigs] = await Promise.all([
          getProviderConfig(),
          getProviderConfigs(),
        ]);
        setProviderConfigs(savedConfigs);
        if (savedProvider ?? savedConfigs[0]) {
          setProvider(savedProvider ?? savedConfigs[0]);
        }
        setHistoryItems(await listHistoryItems());
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "初始化 App 失败。",
        );
      }
    })();
  }, [setErrorMessage, setHistoryItems, setProvider, setProviderConfigs]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.content}>
        {activeTab === "generate" && <GenerateScreen />}
        {activeTab === "history" && <HistoryScreen />}
        {activeTab === "config" && <ConfigScreen />}
      </View>

      <View style={styles.tabs}>
        <TabButton
          label="生成"
          active={activeTab === "generate"}
          onPress={() => setActiveTab("generate")}
        />
        <TabButton
          label="历史"
          active={activeTab === "history"}
          onPress={() => setActiveTab("history")}
        />
        <TabButton
          label="设置"
          active={activeTab === "config"}
          onPress={() => setActiveTab("config")}
        />
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    gap: 10,
    borderTopColor: colors.line,
    borderTopWidth: 1,
    backgroundColor: "#09131d",
    padding: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: colors.panelStrong,
  },
  tabText: {
    color: colors.muted,
    fontWeight: "700",
  },
  tabTextActive: {
    color: colors.accent,
  },
});
