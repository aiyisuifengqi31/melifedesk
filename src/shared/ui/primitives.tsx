import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type EmptyStateAction = {
  label: string;
  onPress: () => void;
};

export type UiTokens = {
  accent: string;
  accentSoft: string;
  background: string;
  border: string;
  danger?: string;
  shadow?: string;
  success?: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  warning?: string;
};

type TokenProps = {
  tokens: UiTokens;
};

export function AppPage({ children, tokens }: PropsWithChildren<TokenProps>) {
  return <View style={[styles.page, { backgroundColor: tokens.background }]}>{children}</View>;
}

export function PageHeader({ meta, subtitle, title, tokens }: TokenProps & { meta?: string; subtitle: string; title: string }) {
  return (
    <View style={[styles.header, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text accessibilityRole="header" role="heading" style={[styles.pageTitle, { color: tokens.text }]}>
        {title}
      </Text>
      <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{subtitle}</Text>
      {meta ? <Text style={[styles.meta, { color: tokens.accent }]}>{meta}</Text> : null}
    </View>
  );
}

export function SectionHeader({ action, title, tokens }: TokenProps & { action?: ReactNode; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: tokens.text }]}>{title}</Text>
      {action}
    </View>
  );
}

export function ContentCard({ children, tokens }: PropsWithChildren<TokenProps>) {
  return <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>{children}</View>;
}

export function StatCard({ label, tokens, value }: TokenProps & { label: string; value: string }) {
  return (
    <View style={[styles.statCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text style={[styles.statLabel, { color: tokens.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: tokens.text }]}>{value}</Text>
    </View>
  );
}

export function ActionChip({ label, selected = false, tokens }: TokenProps & { label: string; selected?: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: selected ? tokens.accentSoft : tokens.surfaceMuted, borderColor: selected ? tokens.accent : tokens.border }]}>
      <Text style={[styles.chipText, { color: tokens.text }]}>{label}</Text>
    </View>
  );
}

export function SegmentedTabs({ options, selected, tokens }: TokenProps & { options: string[]; selected: string }) {
  return (
    <View style={[styles.segmented, { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border }]}>
      {options.map((option) => (
        <ActionChip key={option} label={option} selected={option === selected} tokens={tokens} />
      ))}
    </View>
  );
}

export function EmptyState({ action, description, icon, title, tokens }: TokenProps & { action?: EmptyStateAction; description: string; icon?: ReactNode; title: string }) {
  return (
    <ContentCard tokens={tokens}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <Text style={[styles.sectionTitle, { color: tokens.text }]}>{title}</Text>
      <Text style={[styles.body, { color: tokens.textMuted }]}>{description}</Text>
      {action ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} style={[styles.emptyAction, { backgroundColor: tokens.accent }]}>
          <Text style={styles.emptyActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </ContentCard>
  );
}

export function InlineError({ message, tokens }: TokenProps & { message: string }) {
  return (
    <View style={[styles.inlineError, { borderColor: tokens.accent }]}>
      <Text style={[styles.body, { color: tokens.text }]}>{message}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, tokens }: TokenProps & { label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.primaryButton, { backgroundColor: tokens.accent }]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, tokens }: TokenProps & { label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.secondaryButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text style={[styles.secondaryText, { color: tokens.text }]}>{label}</Text>
    </Pressable>
  );
}

export function IconNavItem({ label, selected, tokens }: TokenProps & { label: string; selected: boolean }) {
  return (
    <View style={[styles.iconNavItem, { backgroundColor: selected ? tokens.accentSoft : "transparent", borderColor: selected ? tokens.accent : "transparent" }]}>
      <Text style={[styles.iconNavLabel, { color: tokens.text }]}>{label}</Text>
    </View>
  );
}

export function FloatingQuickAction({ label, onPress, tokens }: TokenProps & { label: string; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.fab, { backgroundColor: tokens.accent }]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 20
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 16
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  chipText: {
    fontSize: 13,
    fontWeight: "800"
  },
  fab: {
    alignSelf: "flex-end",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  header: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18
  },
  iconNavItem: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  iconNavLabel: {
    fontSize: 12,
    fontWeight: "800"
  },
  inlineError: {
    borderLeftWidth: 3,
    borderRadius: 8,
    padding: 10
  },
  meta: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8
  },
  page: {
    gap: 14
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "900"
  },
  primaryButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  secondaryText: {
    fontWeight: "900"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900"
  },
  segmented: {
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    padding: 6
  },
  statCard: {
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 142,
    padding: 14
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "800"
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 5
  },
  subtitle: {
    fontSize: 14,
    marginTop: 5
  },
  emptyIcon: {
    opacity: 0.32,
    marginBottom: 2
  },
  emptyAction: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  emptyActionText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900"
  }
});
