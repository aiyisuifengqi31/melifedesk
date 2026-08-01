import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { UiTokens } from "@/shared/ui/primitives";
import {
  createNoteId,
  getDefaultNotesStorage,
  loadNotes,
  NOTE_CATEGORIES,
  type NoteCategory,
  type NoteItem,
  type NotesStorage,
  saveNotes
} from "./notesStorage";

type NotesPanelProps = {
  onClose: () => void;
  storage?: NotesStorage;
  themeTokens: UiTokens;
};

export function NotesPanel({ onClose, storage, themeTokens }: NotesPanelProps) {
  const notesStorage = useMemo(() => storage ?? getDefaultNotesStorage(), [storage]);
  const [notes, setNotes] = useState<NoteItem[]>(() => loadNotes(notesStorage));
  const [category, setCategory] = useState<NoteCategory>("全部");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [newCategory, setNewCategory] = useState<NoteCategory>("未分类");
  const [feedback, setFeedback] = useState("记录一闪而过的念头、待办事项或购物清单。");

  const filteredNotes = category === "全部" ? notes : notes.filter((n) => n.category === category);

  const persist = (nextNotes: NoteItem[]) => {
    setNotes(nextNotes);
    saveNotes(nextNotes, notesStorage);
  };

  const addNote = () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle && !cleanContent) {
      setFeedback("请先写点什么。");
      return;
    }

    const note: NoteItem = {
      category: newCategory,
      content: cleanContent,
      createTime: new Date().toISOString(),
      id: createNoteId(),
      title: cleanTitle || cleanContent.slice(0, 20)
    };
    const next = [note, ...notes];
    persist(next);
    setTitle("");
    setContent("");
    setFeedback("灵感已记录。");
  };

  const deleteNote = (id: string) => {
    const next = notes.filter((n) => n.id !== id);
    persist(next);
    setFeedback("已删除。");
  };

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="返回首页" onPress={onClose} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </Pressable>
        <Text style={styles.headerTitle}>备忘录</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>记一笔</Text>
        <TextInput onChangeText={setTitle} placeholder="标题（可选）" style={styles.input} value={title} />
        <TextInput
          multiline
          onChangeText={setContent}
          placeholder="闪过的念头..."
          style={[styles.input, styles.textArea]}
          value={content}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {NOTE_CATEGORIES.filter((c) => c !== "全部").map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`分类：${c}`}
              onPress={() => setNewCategory(c)}
              style={[styles.categoryChip, newCategory === c ? styles.categoryChipActive : null]}
            >
              <Text style={[styles.categoryChipText, newCategory === c ? styles.categoryChipTextActive : null]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="记录灵感" onPress={addNote} style={styles.primaryButton}>
          <Text style={styles.primaryText}>记录</Text>
        </Pressable>
        <Text style={styles.feedback}>{feedback}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {NOTE_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`筛选：${c}`}
            onPress={() => setCategory(c)}
            style={[styles.filterChip, category === c ? styles.filterChipActive : null]}
          >
            <Text style={[styles.filterChipText, category === c ? styles.filterChipTextActive : null]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filteredNotes.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>✍️</Text>
          <Text style={styles.emptyTitle}>还没有备忘</Text>
          <Text style={styles.emptyText}>写下第一条备忘吧</Text>
        </View>
      ) : (
        <View style={styles.notesGrid}>
          {filteredNotes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteCategory}>{note.category}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`删除${note.title}`} hitSlop={6} onPress={() => deleteNote(note.id)} style={styles.deleteButton}>
                  <Text style={styles.deleteText}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.noteTitle}>{note.title}</Text>
              {note.content ? <Text style={styles.noteContent} numberOfLines={4}>{note.content}</Text> : null}
              <Text style={styles.noteTime}>{note.createTime.slice(0, 10)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    minWidth: 60
  },
  backText: {
    color: "#7cb87c",
    fontSize: 15,
    fontWeight: "900"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    gap: 12,
    padding: 18,
    shadowColor: "#7cb87c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2
  },
  cardTitle: {
    color: "#1f2937",
    fontSize: 20,
    fontWeight: "900"
  },
  categoryChip: {
    backgroundColor: "#f1f5f1",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  categoryChipActive: {
    backgroundColor: "#7cb87c"
  },
  categoryChipText: {
    color: "#6b7c6b",
    fontSize: 14,
    fontWeight: "800"
  },
  categoryChipTextActive: {
    color: "#ffffff"
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 999,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  deleteText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 22
  },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    minHeight: 200,
    justifyContent: "center"
  },
  emptyIcon: {
    fontSize: 48
  },
  emptyText: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "700"
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900"
  },
  feedback: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "800"
  },
  filterChip: {
    backgroundColor: "#f1f5f1",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  filterChipActive: {
    backgroundColor: "#7cb87c"
  },
  filterChipText: {
    color: "#6b7c6b",
    fontSize: 14,
    fontWeight: "900"
  },
  filterChipTextActive: {
    color: "#ffffff"
  },
  filterRow: {
    flexDirection: "row",
    gap: 8
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  headerTitle: {
    color: "#1f2937",
    fontSize: 22,
    fontWeight: "900"
  },
  input: {
    backgroundColor: "#f6faf6",
    borderRadius: 14,
    color: "#1f2937",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  noteCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    flex: 1,
    gap: 8,
    minWidth: 160,
    padding: 14,
    shadowColor: "#7cb87c",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1
  },
  noteCategory: {
    backgroundColor: "#e2f2e2",
    borderRadius: 999,
    color: "#7cb87c",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  noteContent: {
    color: "#6b7c6b",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  noteHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  noteTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900"
  },
  notesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  noteTime: {
    color: "#94a3a3",
    fontSize: 12,
    fontWeight: "800"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 14,
    paddingVertical: 13
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  stack: {
    gap: 16
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top"
  }
});
