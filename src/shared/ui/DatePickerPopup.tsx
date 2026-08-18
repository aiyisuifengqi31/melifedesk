import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type MonthDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

type DatePickerPopupProps = {
  onCancel: () => void;
  onConfirm: (date: string) => void;
  selectedDate: string;
  title?: string;
  visible: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function DatePickerPopup({
  onCancel,
  onConfirm,
  selectedDate,
  title = "选择日期",
  visible
}: DatePickerPopupProps) {
  if (!visible) return null;

  const initial = parseIsoDate(selectedDate || todayIso());
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [pickedDate, setPickedDate] = useState(selectedDate || todayIso());
  const rows = buildMonthRows(viewYear, viewMonth);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleConfirm = () => {
    onConfirm(pickedDate);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="关闭日期选择器"
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.backdrop}
      >
        <View style={styles.centered}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.monthRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="上一月" onPress={goPrevMonth} hitSlop={12} style={styles.arrowBtn}>
                <Text style={styles.arrow}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{viewYear}/{String(viewMonth + 1).padStart(2, "0")}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="下一月" onPress={goNextMonth} hitSlop={12} style={styles.arrowBtn}>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
                <Text key={day} style={styles.weekText}>{day}</Text>
              ))}
            </View>
            <View style={styles.dayGrid}>
              {rows.map((row) => (
                <View key={row.map((day) => day.date).join(":")} style={styles.dayRow}>
                  {row.map((day) => {
                    const selected = day.date === pickedDate;
                    return (
                      <Pressable
                        key={day.date}
                        accessibilityRole="button"
                        accessibilityLabel={`选择日期：${day.date}`}
                        onPress={() => {
                          if (!day.inMonth) return;
                          setPickedDate(day.date);
                          onConfirm(day.date);
                        }}
                        style={[styles.dayCell, selected ? styles.dayCellSelected : null]}
                      >
                        <Text style={[
                          styles.dayText,
                          !day.inMonth ? styles.dayMuted : null,
                          selected ? styles.dayTextSelected : null
                        ]}>{day.day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" accessibilityLabel="取消" onPress={onCancel} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="确定" onPress={handleConfirm} style={styles.confirmBtn}>
                <Text style={styles.confirmText}>确定</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export function buildMonthRows(year: number, monthIndex: number): MonthDay[][] {
  const first = new Date(year, monthIndex, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - mondayOffset);

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex
    };
  });

  return Array.from({ length: 6 }, (_, rowIndex) => days.slice(rowIndex * 7, rowIndex * 7 + 7));
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4
  },
  arrow: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "500",
    lineHeight: 32
  },
  arrowBtn: {
    alignItems: "center",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  backdrop: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    flex: 1
  },
  cancelBtn: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12
  },
  cancelText: {
    color: "#111827",
    fontWeight: "900"
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e8ef",
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
    width: "86%"
  },
  centered: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20
  },
  confirmBtn: {
    alignItems: "center",
    backgroundColor: "#1fa8e2",
    borderRadius: 12,
    flex: 1,
    paddingVertical: 12
  },
  confirmText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  dayCell: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    height: 36,
    justifyContent: "center"
  },
  dayCellSelected: {
    backgroundColor: "#1fa8e2"
  },
  dayGrid: {
    gap: 4
  },
  dayRow: {
    flexDirection: "row",
    gap: 4
  },
  dayMuted: {
    color: "#c6ccd5"
  },
  dayText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800"
  },
  dayTextSelected: {
    color: "#ffffff"
  },
  monthLabel: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    minWidth: 100,
    textAlign: "center"
  },
  monthRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  title: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2
  },
  weekText: {
    color: "#697386",
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center"
  }
});
