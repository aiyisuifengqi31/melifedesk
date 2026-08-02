import { useEffect, useMemo, useState } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

import { getImageSource, loadBackground } from "@/theme/background";
import { getPublicAppConfig } from "@/config/app";

const app = getPublicAppConfig();

const greetings = [
  "你今天真棒，简直是天才来的。",
  "新的一天，新的期待，出发吧。",
  "愿今天的你，比昨天更快乐一点。",
  "世界很大，今天先从一件小事开始。",
  "你值得拥有闪闪发光的一天。"
];

const subGreetings = [
  "苹果绿配你，绝配！因为你就是那么清新脱俗。",
  "今天的计划已经迫不及待想见你了。",
  "慢慢来，好戏都在烟火里。",
  "把今天安排得轻一点，心情会重一点幸福。",
  "相信自己，你可以把今天过得很好。"
];

function formatToday(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${month}月${date}日 · ${weekDays[now.getDay()]}`;
}

function pickPhrase(index: number): string {
  return greetings[index % greetings.length];
}

function pickSubPhrase(index: number): string {
  return subGreetings[index % subGreetings.length];
}

export type WelcomeScreenProps = {
  onStart: () => void;
};

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [background, setBackground] = useState(() => loadBackground());
  const imageSource = useMemo(() => getImageSource(background), [background]);
  const today = useMemo(() => formatToday(), []);
  const phraseIndex = useMemo(() => new Date().getDate() % greetings.length, []);
  const phrase = useMemo(() => pickPhrase(phraseIndex), [phraseIndex]);
  const subPhrase = useMemo(() => pickSubPhrase(phraseIndex), [phraseIndex]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onStart();
    }, 800);
    return () => clearTimeout(timer);
  }, [onStart]);

  const content = (
    <View style={styles.content}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoIcon}>🌱</Text>
      </View>
      <Text style={styles.date}>{today}</Text>
      <Text style={styles.title}>嗨，宿主大人</Text>
      <Text style={styles.phrase}>{phrase}</Text>
      <Text style={styles.subPhrase}>{subPhrase}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="开始今天" onPress={onStart} style={styles.startButton}>
        <Text style={styles.startText}>开始今天 ✨</Text>
      </Pressable>
      <Text style={styles.hint}>点一下，开启今日计划</Text>
    </View>
  );

  if (imageSource) {
    return (
      <ImageBackground imageStyle={styles.backgroundImage} resizeMode="cover" source={imageSource} style={styles.root}>
        <View style={styles.overlay}>
          {content}
        </View>
      </ImageBackground>
    );
  }

  return (
    <View style={styles.root}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    opacity: 0.35
  },
  content: {
    alignItems: "center",
    gap: 16,
    justifyContent: "center",
    padding: 32
  },
  date: {
    color: "#4a5d4a",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 8
  },
  hint: {
    color: "#7a8d7a",
    fontSize: 12,
    fontWeight: "700"
  },
  logoCircle: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 999,
    borderWidth: 1,
    height: 86,
    justifyContent: "center",
    width: 86
  },
  logoIcon: {
    fontSize: 40
  },
  overlay: {
    backgroundColor: "rgba(240, 247, 240, 0.72)",
    flex: 1
  },
  phrase: {
    color: "#3a4a3a",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center"
  },
  root: {
    alignItems: "center",
    backgroundColor: "#f0f7f0",
    flex: 1,
    justifyContent: "center"
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    elevation: 3,
    marginTop: 24,
    paddingHorizontal: 52,
    paddingVertical: 16,
    shadowColor: "#7cb87c",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18
  },
  startText: {
    color: "#5a7a5a",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 1
  },
  subPhrase: {
    color: "#6a7d6a",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center"
  },
  title: {
    color: "#3a4a3a",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 4
  }
});
