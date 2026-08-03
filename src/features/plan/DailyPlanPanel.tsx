import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { getHolidayLabel, isWeekend } from "@/features/plan/holidays";
import { resolveCurrentCityWeather, weatherEmoji, type WeatherState } from "@/features/plan/weatherProvider";
import type { UiTokens } from "@/shared/ui/primitives";
import { PackagePanel } from "./PackagePanel";

type DailyPlanPanelProps = {
  shortcutNonce?: number;
  shortcutTarget?: "packages" | "packageScan";
  storage?: unknown;
  themeTokens: UiTokens;
};

type MonthDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export function DailyPlanPanel({ shortcutNonce, shortcutTarget, themeTokens }: DailyPlanPanelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [weather, setWeather] = useState<WeatherState>({ message: "未获取天气", status: "idle" });

  const loadWeather = async () => {
    setWeather({ message: "正在读取当前位置天气...", status: "loading" });
    setWeather(await resolveCurrentCityWeather());
  };

  useEffect(() => {
    if (shortcutTarget !== "packages" && shortcutTarget !== "packageScan") return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [shortcutNonce, shortcutTarget]);

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.stack}>
      <WeatherCard onRefresh={loadWeather} weather={weather} />
      <MonthCalendar selectedDate={todayIso()} />
      <PackagePanel shortcutCreate={shortcutTarget === "packages"} shortcutScan={shortcutTarget === "packageScan"} themeTokens={themeTokens} />
    </ScrollView>
  );
}

function WeatherCard({ onRefresh, weather }: { onRefresh: () => void; weather: WeatherState }) {
  if (weather.status !== "ready") {
    return (
      <View style={styles.weatherCard}>
        <View style={styles.weatherPlaceholder}>
          <Text style={styles.weatherCity}>当前城市天气</Text>
          <Text style={styles.weatherMeta}>{weather.message}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="获取当前城市天气" onPress={onRefresh} style={styles.weatherButton}>
          <Text style={styles.weatherButtonText}>{weather.status === "loading" ? "读取中" : "获取天气"}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.weatherCard}>
      <View style={styles.weatherMain}>
        <Text style={styles.weatherCity}>{weather.locationLabel}</Text>
        <Text style={styles.temperature}>{weather.temperature}°</Text>
        <Text style={styles.weatherMeta}>{weather.description} · 体感 {weather.apparentTemperature}°</Text>
      </View>
      <View style={styles.weatherRight}>
        <Text style={styles.weatherEmoji}>{weatherEmoji(weather.weatherCode)}</Text>
        <Text style={styles.weatherMeta}>湿度 {weather.humidity}%</Text>
        <Text style={styles.weatherMeta}>降雨以实时接口为准</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="刷新当前城市天气" onPress={onRefresh} style={styles.weatherSmallButton}>
          <Text style={styles.weatherSmallButtonText}>刷新</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MonthCalendar({ selectedDate }: { selectedDate: string }) {
  const [viewYear, setViewYear] = useState(parseIsoDate(selectedDate).getFullYear());
  const [viewMonth, setViewMonth] = useState(parseIsoDate(selectedDate).getMonth());
  const days = buildMonthDays(viewYear, viewMonth);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((year) => year - 1);
      setViewMonth(11);
    } else {
      setViewMonth((month) => month - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((year) => year + 1);
      setViewMonth(0);
    } else {
      setViewMonth((month) => month + 1);
    }
  };

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="上一个月" hitSlop={12} onPress={goPrevMonth}>
          <Text style={styles.calendarArrow}>‹</Text>
        </Pressable>
        <Text style={styles.calendarTitle}>{viewYear}年{viewMonth + 1}月</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="下一个月" hitSlop={12} onPress={goNextMonth}>
          <Text style={styles.calendarArrow}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {["日", "一", "二", "三", "四", "五", "六"].map((weekday) => (
          <Text key={weekday} style={[styles.weekday, weekday === "日" || weekday === "六" ? styles.weekendHeader : null]}>{weekday}</Text>
        ))}
      </View>
      <View style={styles.dayGrid}>
        {days.map((day) => {
          const holiday = day.inMonth ? getHolidayLabel(day.date) : null;
          const weekend = day.inMonth && isWeekend(day.date);
          const selected = day.date === selectedDate;
          return (
            <View key={day.date} style={[styles.dayCell, selected ? styles.dayCellSelected : null]}>
              <Text style={[styles.dayText, !day.inMonth ? styles.mutedDay : null, weekend ? styles.weekendDay : null, selected ? styles.selectedDay : null]}>{day.day}</Text>
              {holiday ? <Text numberOfLines={1} style={styles.holidayText}>{holiday}</Text> : <View style={styles.holidayPlaceholder} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthDays(year: number, monthIndex: number): MonthDay[] {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: toIsoDate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex
    };
  });
}

const styles = StyleSheet.create({
  calendarArrow: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "700"
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10
  },
  calendarTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900"
  },
  calendarTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  dayCell: {
    alignItems: "center",
    flexBasis: "14.285%",
    height: 34,
    justifyContent: "center",
    paddingVertical: 1
  },
  dayCellSelected: {
    backgroundColor: "#28aeea",
    borderRadius: 10
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  dayText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
    textAlign: "center"
  },
  holidayPlaceholder: {
    height: 8
  },
  holidayText: {
    color: "#ef4444",
    fontSize: 8,
    fontWeight: "800",
    marginTop: 1,
    textAlign: "center"
  },
  mutedDay: {
    color: "#c9ced6"
  },
  selectedDay: {
    color: "#ffffff"
  },
  stack: {
    gap: 14,
    paddingBottom: 40
  },
  temperature: {
    color: "#111827",
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 44
  },
  weatherButton: {
    alignItems: "center",
    backgroundColor: "#28aeea",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  weatherButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  weatherCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e3e6eb",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12
  },
  weatherCity: {
    color: "#697386",
    fontSize: 15,
    fontWeight: "800"
  },
  weatherEmoji: {
    fontSize: 30,
    lineHeight: 34
  },
  weatherMain: {
    flex: 1,
    gap: 2
  },
  weatherMeta: {
    color: "#697386",
    fontSize: 12,
    fontWeight: "700"
  },
  weatherPlaceholder: {
    flex: 1,
    gap: 3
  },
  weatherRight: {
    alignItems: "center",
    gap: 4
  },
  weatherSmallButton: {
    backgroundColor: "#eef7ff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  weatherSmallButtonText: {
    color: "#1677a8",
    fontSize: 12,
    fontWeight: "900"
  },
  weekday: {
    color: "#697386",
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center"
  },
  weekRow: {
    flexDirection: "row",
    gap: 4,
    justifyContent: "space-between",
    marginBottom: 6
  },
  weekendDay: {
    color: "#ef4444"
  },
  weekendHeader: {
    color: "#ef4444"
  }
});
