import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type NativeSyntheticEvent, type TextInputChangeEventData, type TextInputProps, type ViewStyle } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";

type FormFieldProps = {
  children?: ReactNode;
  containerStyle?: ViewStyle;
  error?: string;
  label?: string;
  testID?: string;
  tokens: UiTokens;
};

type TextFormFieldProps = FormFieldProps &
  TextInputProps & {
    compact?: boolean;
  };

type ButtonFormFieldProps = FormFieldProps & {
  compact?: boolean;
  onPress: () => void;
  value: string;
};

export function FormField({ children, containerStyle, error, label, testID, tokens }: FormFieldProps) {
  const styles = createStyles(tokens);

  return (
    <View testID={testID} style={[styles.field, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function TextFormField({ compact = false, containerStyle, error, label, onChange, onChangeText, style, testID, tokens, ...props }: TextFormFieldProps) {
  const styles = createStyles(tokens);
  const handleChange = (event: NativeSyntheticEvent<TextInputChangeEventData>) => {
    onChange?.(event);
    const webEvent = event as unknown as { currentTarget?: { value?: string }; target?: { value?: string } };
    const nextValue = event.nativeEvent.text ?? webEvent.currentTarget?.value ?? webEvent.target?.value;
    if (typeof nextValue === "string") {
      onChangeText?.(nextValue);
    }
  };

  return (
    <FormField containerStyle={containerStyle} error={error} label={label} testID={testID ? `${testID}-field` : undefined} tokens={tokens}>
      <TextInput
        {...props}
        onChange={handleChange}
        style={[styles.control, compact ? styles.controlCompact : null, error ? styles.controlError : null, style]}
        testID={testID}
      />
    </FormField>
  );
}

export function ButtonFormField({ compact = false, containerStyle, error, label, onPress, testID, tokens, value }: ButtonFormFieldProps) {
  const styles = createStyles(tokens);

  return (
    <FormField containerStyle={containerStyle} error={error} label={label} testID={testID ? `${testID}-field` : undefined} tokens={tokens}>
      <Pressable accessibilityRole="button" accessibilityLabel={label ?? value} onPress={onPress} style={[styles.control, styles.buttonControl, compact ? styles.controlCompact : null]} testID={testID}>
        <Text numberOfLines={1} style={styles.buttonValue}>{value}</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
    </FormField>
  );
}

function createStyles(tokens: UiTokens) {
  const danger = tokens.danger ?? "#ef4444";

  return StyleSheet.create({
    buttonControl: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between"
    },
    buttonValue: {
      color: tokens.text,
      flex: 1,
      fontSize: 14,
      fontWeight: "800"
    },
    chevron: {
      color: tokens.textMuted,
      fontSize: 16,
      fontWeight: "900"
    },
    control: {
      backgroundColor: "#f8fafc",
      borderColor: tokens.border,
      borderRadius: 14,
      borderWidth: 1.5,
      color: tokens.text,
      fontSize: 14,
      minHeight: 48,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    controlCompact: {
      minHeight: 44
    },
    controlError: {
      borderColor: danger
    },
    error: {
      color: danger,
      fontSize: 12,
      fontWeight: "800"
    },
    field: {
      flex: 1,
      gap: 6,
      minWidth: 0
    },
    label: {
      color: tokens.text,
      fontSize: 13,
      fontWeight: "900"
    }
  });
}
