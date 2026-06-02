import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export function Screen({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7b8794"
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
    >
      {loading ? (
        <ActivityIndicator color="#051018" />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Message({
  text,
  tone = "info",
}: {
  text?: string;
  tone?: "info" | "error";
}) {
  if (!text) return null;

  return (
    <View style={[styles.message, tone === "error" && styles.messageError]}>
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

export function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | string;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const active = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={[styles.optionButton, active && styles.optionButtonActive]}
            >
              <Text
                style={[styles.optionText, active && styles.optionTextActive]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const colors = {
  background: "#071018",
  panel: "#101b27",
  panelStrong: "#162334",
  text: "#edf4ff",
  muted: "#91a4ba",
  accent: "#7ee787",
  danger: "#ff7b72",
  line: "#263446",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 18,
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
  },
  input: {
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: colors.panel,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  button: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#051018",
    fontSize: 16,
    fontWeight: "800",
  },
  message: {
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: colors.panelStrong,
    padding: 12,
  },
  messageError: {
    borderColor: colors.danger,
  },
  messageText: {
    color: colors.text,
    lineHeight: 20,
  },
  optionGroup: {
    gap: 8,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.panel,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionButtonActive: {
    borderColor: colors.accent,
    backgroundColor: colors.panelStrong,
  },
  optionText: {
    color: colors.muted,
    fontWeight: "700",
  },
  optionTextActive: {
    color: colors.accent,
  },
});
