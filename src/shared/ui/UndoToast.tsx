import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { UiTokens } from "./primitives";

export type UndoRequest = {
  id: number;
  message: string;
  onUndo: () => void;
  duration?: number;
};

let current: UndoRequest | null = null;
let seq = 0;
const subscribers = new Set<(request: UndoRequest | null) => void>();

function emit() {
  subscribers.forEach((listener) => listener(current));
}

/** 全局唯一撤销 Toast。任何模块调用 showUndoToast 即可，避免各自维护一套 Toast。 */
export function showUndoToast(request: Omit<UndoRequest, "id">) {
  current = { ...request, id: ++seq };
  emit();
}

const DEFAULT_DURATION = 3500;
const DONE_DURATION = 1300;

export function UndoToastHost({ tokens }: { tokens: UiTokens }) {
  const [req, setReq] = useState<UndoRequest | null>(current);
  const [done, setDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const update = () => setReq(current);
    subscribers.add(update);
    return () => {
      subscribers.delete(update);
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    setDone(false);
    const timer = setTimeout(() => setReq(null), req.duration ?? DEFAULT_DURATION);
    return () => clearTimeout(timer);
  }, [req]);

  useEffect(() => () => {
    if (doneTimer.current) clearTimeout(doneTimer.current);
  }, []);

  if (!req) return null;

  const handleUndo = () => {
    try {
      req.onUndo();
    } catch {
      /* 忽略撤销回调异常，仍收起 Toast */
    }
    setDone(true);
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setReq(null), DONE_DURATION);
  };

  return (
    <View style={[styles.host, { backgroundColor: tokens.text }]} pointerEvents="box-none">
      <Text style={[styles.message, { color: tokens.surface }]} numberOfLines={1}>
        {done ? "已撤销" : req.message}
      </Text>
      {!done ? (
        <Pressable accessibilityRole="button" accessibilityLabel="撤销" onPress={handleUndo} style={styles.undo} hitSlop={{ top: 8, bottom: 8, left: 12, right: 4 }}>
          <Text style={[styles.undoText, { color: tokens.accent }]}>撤销</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    bottom: 26,
    left: 16,
    right: 16,
    alignItems: "center",
    borderRadius: 14,
    elevation: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    zIndex: 60
  },
  message: {
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
    marginRight: 12
  },
  undo: {
    flexShrink: 0,
    paddingVertical: 4
  },
  undoText: {
    fontSize: 14,
    fontWeight: "900"
  }
});
