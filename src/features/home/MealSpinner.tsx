import { useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SvgXml } from "react-native-svg";

const MAX_WHEEL_SIZE = 240;
const WHEEL_PADDING = 24;
const CENTER = (size: number) => size / 2;
const RADIUS = (size: number) => size / 2 - 14;

const PRESET_MEALS = ["火锅", "烧烤", "麻辣烫", "寿司", "汉堡", "沙拉", "披萨", "拉面"];

const COLORS = ["#7cb87c", "#8bc68b", "#9bd39b", "#6ab0b0", "#7cc2c2", "#9bc4a3", "#b8d8a8", "#a8c9a8"];

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [`M ${x} ${y}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`, "Z"].join(" ");
}

function buildWheelSvg(options: string[], size: number) {
  const count = Math.max(options.length, 1);
  const sliceAngle = 360 / count;
  const slices: string[] = [];
  const labels: string[] = [];
  const center = CENTER(size);
  const radius = RADIUS(size);

  for (let i = 0; i < count; i++) {
    const startAngle = i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const color = COLORS[i % COLORS.length];
    const path = describeArc(center, center, radius, startAngle, endAngle);
    slices.push(`<path d="${path}" fill="${color}" stroke="#ffffff" stroke-width="2"/>`);

    const midAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 0.62;
    const labelPos = polarToCartesian(center, center, labelRadius, midAngle);
    const rotate = midAngle;
    const text = options[i] ?? "";
    const fontSize = Math.max(11, Math.round(size / 18));
    labels.push(
      `<text x="${labelPos.x}" y="${labelPos.y}" fill="#ffffff" font-size="${fontSize}" font-weight="900" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotate} ${labelPos.x} ${labelPos.y})">${text}</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${slices.join("")}${labels.join("")}</svg>`;
}

export function MealSpinner() {
  const [options, setOptions] = useState<string[]>(PRESET_MEALS);
  const [inputText, setInputText] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const rotation = useRef(new Animated.Value(0)).current;
  const currentRotation = useRef(0);

  const wheelSize = Math.max(160, Math.min(MAX_WHEEL_SIZE, containerWidth - WHEEL_PADDING * 2));
  const validOptions = options.filter((o) => o.trim());

  const addOption = () => {
    const text = inputText.trim();
    if (!text) return;
    if (options.includes(text)) {
      setInputText("");
      return;
    }
    setOptions([...options, text]);
    setInputText("");
    setResult(null);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const next = [...options];
    next.splice(index, 1);
    setOptions(next);
    setResult(null);
  };

  const resetOptions = () => {
    setOptions(PRESET_MEALS);
    setResult(null);
  };

  const spin = () => {
    if (spinning || validOptions.length < 2) return;
    setSpinning(true);
    setResult(null);

    const count = validOptions.length;
    const sliceAngle = 360 / count;
    const randomIndex = Math.floor(Math.random() * count);
    const targetSliceCenter = randomIndex * sliceAngle + sliceAngle / 2;
    const extraSpins = 360 * 5;
    const targetRotation = currentRotation.current + extraSpins + (360 - targetSliceCenter);

    Animated.timing(rotation, {
      toValue: targetRotation,
      duration: 5000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) {
        currentRotation.current = targetRotation % 360;
        rotation.setValue(currentRotation.current);
        setResult(validOptions[randomIndex]);
        setSpinning(false);
      }
    });
  };

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"]
  });

  return (
    <View style={styles.container} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      <Text style={styles.title}>今天吃什么</Text>
      <Text style={styles.subtitle}>输入几个选项，让转盘来决定</Text>

      <View style={[styles.wheelArea, { height: wheelSize + 24, width: wheelSize + 24 }]}>
        <View style={styles.pointer} />
        <Animated.View style={[styles.wheel, { height: wheelSize, width: wheelSize, transform: [{ rotate: rotateInterpolate }] }]}>
          <SvgXml height={wheelSize} width={wheelSize} xml={buildWheelSvg(validOptions, wheelSize)} />
        </Animated.View>
        <View style={styles.wheelCenter}>
          <Text style={styles.wheelCenterText}>GO</Text>
        </View>
      </View>

      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>转盘决定</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="开始转盘"
        disabled={spinning || validOptions.length < 2}
        onPress={spin}
        style={[styles.spinButton, (spinning || validOptions.length < 2) ? styles.spinButtonDisabled : null]}
      >
        <Text style={styles.spinButtonText}>{spinning ? "转转转..." : "开始转"}</Text>
      </Pressable>

      <View style={styles.inputRow}>
        <TextInput
          onChangeText={setInputText}
          onSubmitEditing={addOption}
          placeholder="输入选项，如：炸鸡"
          style={styles.input}
          value={inputText}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="添加选项" onPress={addOption} style={styles.addButton}>
          <Text style={styles.addButtonText}>添加</Text>
        </Pressable>
      </View>

      <View style={styles.optionsList}>
        {options.map((option, index) => (
          <View key={`${option}-${index}`} style={styles.optionChip}>
            <Text style={styles.optionChipText}>{option}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`删除${option}`} hitSlop={6} onPress={() => removeOption(index)} style={styles.removeChip}>
              <Text style={styles.removeChipText}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="恢复默认选项" onPress={resetOptions} style={styles.resetLink}>
        <Text style={styles.resetLinkText}>恢复默认</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900"
  },
  container: {
    gap: 14
  },
  input: {
    backgroundColor: "#f6faf6",
    borderRadius: 12,
    color: "#1f2937",
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  inputRow: {
    flexDirection: "row",
    gap: 10
  },
  optionChip: {
    alignItems: "center",
    backgroundColor: "#f1f5f1",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  optionChipText: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700"
  },
  optionsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pointer: {
    backgroundColor: "#ef4444",
    borderColor: "#ffffff",
    borderRadius: 4,
    borderWidth: 2,
    height: 18,
    left: "50%",
    position: "absolute",
    top: 0,
    transform: [{ translateX: -9 }],
    width: 18,
    zIndex: 10
  },
  removeChip: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  removeChipText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 18
  },
  resetLink: {
    alignSelf: "center"
  },
  resetLinkText: {
    color: "#697386",
    fontSize: 13,
    fontWeight: "800"
  },
  resultBox: {
    alignItems: "center",
    backgroundColor: "#e2f2e2",
    borderRadius: 14,
    paddingVertical: 14
  },
  resultLabel: {
    color: "#5a7a5a",
    fontSize: 13,
    fontWeight: "800"
  },
  resultText: {
    color: "#7cb87c",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4
  },
  spinButton: {
    alignItems: "center",
    backgroundColor: "#7cb87c",
    borderRadius: 14,
    paddingVertical: 14
  },
  spinButtonDisabled: {
    backgroundColor: "#c4dcc4"
  },
  spinButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900"
  },
  subtitle: {
    color: "#6b7c6b",
    fontSize: 14,
    fontWeight: "700",
    marginTop: -10
  },
  title: {
    color: "#1f2937",
    fontSize: 20,
    fontWeight: "900"
  },
  wheel: {
    alignItems: "center",
    borderRadius: MAX_WHEEL_SIZE / 2,
    justifyContent: "center",
    overflow: "hidden"
  },
  wheelArea: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center"
  },
  wheelCenter: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d8e8d8",
    borderRadius: 999,
    borderWidth: 2,
    height: 54,
    justifyContent: "center",
    position: "absolute",
    width: 54,
    zIndex: 5
  },
  wheelCenterText: {
    color: "#7cb87c",
    fontSize: 16,
    fontWeight: "900"
  }
});
