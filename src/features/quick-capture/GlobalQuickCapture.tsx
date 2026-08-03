import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import { parseQuickCaptureText, saveQuickCaptureDraft, todayIso, type QuickCaptureDraft, type QuickCaptureKind } from "./quickCapture";

type GlobalQuickCaptureProps = {
  onClose: () => void;
  tokens: UiTokens;
};

const kindOptions: Array<{ label: string; value: QuickCaptureKind }> = [
  { label: "待办", value: "todo" },
  { label: "备忘录", value: "note" },
  { label: "支出/收入", value: "expense" },
  { label: "快递", value: "package" }
];

export function GlobalQuickCapture({ onClose, tokens }: GlobalQuickCaptureProps) {
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const inputRef = useRef<TextInput>(null);
  const recognitionRef = useRef<unknown>(null);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<QuickCaptureDraft | null>(null);
  const [status, setStatus] = useState("可以说一句，也可以直接打字。");
  const [listening, setListening] = useState(false);

  const parseText = (value = text) => {
    const clean = value.trim();
    if (!clean) {
      setStatus("先说一句或输入一句内容。");
      inputRef.current?.focus();
      return;
    }
    setDraft(parseQuickCaptureText(clean));
    setStatus("识别结果需要你确认后才会保存。");
  };

  const startSpeech = () => {
    if (typeof window === "undefined") {
      setStatus("当前环境不支持语音识别，可以先用文字输入。");
      return;
    }
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("这个浏览器暂不支持网页语音识别，可以直接打字。");
      inputRef.current?.focus();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      setText(transcript);
      setListening(false);
      parseText(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
      setStatus("语音识别失败了，内容没有清空，可以改用文字输入。");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    setStatus("正在听，你说完后会自动整理成确认卡片。");
    recognition.start();
  };

  const stopSpeech = () => {
    (recognitionRef.current as SpeechRecognitionLike | null)?.stop?.();
    setListening(false);
  };

  const updateDraft = (patch: Partial<QuickCaptureDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const saveDraft = () => {
    if (!draft) return;
    try {
      saveQuickCaptureDraft(draft);
      setStatus("已保存，相关列表和首页概览会刷新。");
      setDraft(null);
      setText("");
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败，请检查内容后再试。");
    }
  };

  return (
    <View style={styles.overlay} testID="global-quick-capture">
      <Pressable accessibilityRole="button" accessibilityLabel="关闭语音快速记录背景" onPress={onClose} style={styles.backdrop} />
      <View style={styles.panel}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>语音快速记录</Text>
            <Text style={styles.subtitle}>{status}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭语音快速记录" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <TextInput
            autoFocus
            multiline
            onChangeText={setText}
            placeholder="例如：午饭花了25元 / 明天下午三点提醒我取快递"
            placeholderTextColor="#9ca3af"
            ref={inputRef}
            style={styles.textArea}
            testID="quick-capture-text-input"
            value={text}
          />
          <View style={styles.actionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={listening ? "停止语音记录" : "开始语音记录"} onPress={listening ? stopSpeech : startSpeech} style={[styles.secondaryButton, listening ? styles.recordingButton : null]}>
              <Text style={[styles.secondaryButtonText, listening ? styles.recordingText : null]}>{listening ? "停止" : "点击开始说话"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="整理为确认卡片" onPress={() => parseText()} style={styles.primaryButton} testID="quick-capture-parse">
              <Text style={styles.primaryButtonText}>整理</Text>
            </Pressable>
          </View>

          {draft ? (
            <View style={styles.reviewCard} testID="quick-capture-review-card">
              <Text style={styles.reviewTitle}>保存前确认</Text>
              <View style={styles.kindRow}>
                {kindOptions.map((option) => (
                  <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`保存为${option.label}`} onPress={() => updateDraft({ kind: option.value })} style={[styles.kindChip, draft.kind === option.value ? styles.kindChipActive : null]}>
                    <Text style={[styles.kindText, draft.kind === option.value ? styles.kindTextActive : null]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>

              <ReviewInput label={draft.kind === "expense" ? "备注/用途" : "标题/内容"} onChangeText={(value) => updateDraft({ note: value, title: value })} styles={styles} value={draft.kind === "expense" ? draft.note : draft.title} />
              {draft.kind === "expense" ? (
                <>
                  <View style={styles.inlineRow}>
                    <ReviewInput containerStyle={styles.flexInput} keyboardType="decimal-pad" label="金额" onChangeText={(value) => updateDraft({ amount: value })} styles={styles} value={draft.amount} />
                    <ReviewInput containerStyle={styles.flexInput} label="分类" onChangeText={(value) => updateDraft({ categoryName: value })} styles={styles} value={draft.categoryName} />
                  </View>
                  <View style={styles.kindRow}>
                    {(["expense", "income"] as const).map((type) => (
                      <Pressable key={type} accessibilityRole="button" accessibilityLabel={type === "expense" ? "支出" : "收入"} onPress={() => updateDraft({ transactionType: type })} style={[styles.kindChip, draft.transactionType === type ? styles.kindChipActive : null]}>
                        <Text style={[styles.kindText, draft.transactionType === type ? styles.kindTextActive : null]}>{type === "expense" ? "支出" : "收入"}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
              {draft.kind === "todo" ? (
                <View style={styles.inlineRow}>
                  <ReviewInput containerStyle={styles.flexInput} label="日期" onChangeText={(value) => updateDraft({ date: value })} styles={styles} value={draft.date || todayIso()} />
                  <ReviewInput containerStyle={styles.flexInput} label="时间" onChangeText={(value) => updateDraft({ time: value })} styles={styles} value={draft.time} />
                </View>
              ) : null}
              {draft.kind === "package" ? (
                <>
                  <ReviewInput label="取件码" onChangeText={(value) => updateDraft({ pickupCode: value })} styles={styles} value={draft.pickupCode} />
                  <View style={styles.inlineRow}>
                    <ReviewInput containerStyle={styles.flexInput} label="快递公司" onChangeText={(value) => updateDraft({ packageCompany: value })} styles={styles} value={draft.packageCompany} />
                    <ReviewInput containerStyle={styles.flexInput} label="日期" onChangeText={(value) => updateDraft({ date: value })} styles={styles} value={draft.date || todayIso()} />
                  </View>
                  <ReviewInput label="取件地点" onChangeText={(value) => updateDraft({ pickupLocation: value })} styles={styles} value={draft.pickupLocation} />
                </>
              ) : null}
              <Text style={styles.confidence}>置信度：{draft.confidence === "high" ? "高" : draft.confidence === "medium" ? "需要核对" : "低，请手动补充"}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="确认保存快速记录" onPress={saveDraft} style={styles.saveButton} testID="quick-capture-save">
                <Text style={styles.saveButtonText}>确认保存</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

type SpeechRecognitionLike = {
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results?: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};

function ReviewInput({
  containerStyle,
  keyboardType,
  label,
  onChangeText,
  styles,
  value
}: {
  containerStyle?: object;
  keyboardType?: "default" | "decimal-pad";
  label: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  value: string;
}) {
  return (
    <View style={[styles.fieldWrap, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput keyboardType={keyboardType} onChangeText={onChangeText} placeholder={label} placeholderTextColor="#9ca3af" style={styles.input} value={value} />
    </View>
  );
}

function createStyles(tokens: UiTokens) {
  return StyleSheet.create({
    actionRow: { flexDirection: "row", gap: 10 },
    backdrop: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
    body: { gap: 12, paddingBottom: 16 },
    closeButton: { alignItems: "center", backgroundColor: tokens.surfaceMuted, borderRadius: 999, height: 36, justifyContent: "center", width: 36 },
    closeText: { color: tokens.text, fontSize: 22, fontWeight: "800", lineHeight: 24 },
    confidence: { color: tokens.warning, fontSize: 12, fontWeight: "800" },
    fieldLabel: { color: tokens.textMuted, fontSize: 12, fontWeight: "800", marginBottom: 6 },
    fieldWrap: { gap: 4 },
    flexInput: { flex: 1 },
    header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
    inlineRow: { flexDirection: "row", gap: 10 },
    input: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 12, borderWidth: 1, color: tokens.text, fontSize: 15, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 },
    kindChip: { alignItems: "center", backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 999, borderWidth: 1, flex: 1, minHeight: 38, justifyContent: "center", paddingHorizontal: 8 },
    kindChipActive: { backgroundColor: tokens.accentSoft, borderColor: tokens.accent },
    kindRow: { flexDirection: "row", gap: 8 },
    kindText: { color: tokens.textMuted, fontSize: 12, fontWeight: "900" },
    kindTextActive: { color: tokens.accent },
    overlay: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 130 },
    panel: { alignSelf: "center", backgroundColor: tokens.surface, borderColor: tokens.border, borderRadius: 20, borderWidth: 1, bottom: 24, maxHeight: "82%", maxWidth: 560, padding: 16, position: "absolute", shadowColor: "#000000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 28, width: "92%" },
    primaryButton: { alignItems: "center", backgroundColor: tokens.accent, borderRadius: 12, flex: 1, justifyContent: "center", minHeight: 46 },
    primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
    recordingButton: { backgroundColor: "#fff1f2", borderColor: tokens.danger },
    recordingText: { color: tokens.danger },
    reviewCard: { backgroundColor: "#ffffff", borderColor: tokens.border, borderRadius: 16, borderWidth: 1, gap: 10, padding: 12 },
    reviewTitle: { color: tokens.text, fontSize: 16, fontWeight: "900" },
    saveButton: { alignItems: "center", backgroundColor: tokens.accent, borderRadius: 14, justifyContent: "center", minHeight: 50 },
    saveButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
    secondaryButton: { alignItems: "center", backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 46 },
    secondaryButtonText: { color: tokens.text, fontSize: 14, fontWeight: "900" },
    subtitle: { color: tokens.textMuted, fontSize: 12, fontWeight: "700", marginTop: 4 },
    textArea: { backgroundColor: tokens.surfaceMuted, borderColor: tokens.border, borderRadius: 14, borderWidth: 1, color: tokens.text, fontSize: 15, minHeight: 92, paddingHorizontal: 12, paddingVertical: 10, textAlignVertical: "top" },
    title: { color: tokens.text, fontSize: 18, fontWeight: "900" }
  });
}
