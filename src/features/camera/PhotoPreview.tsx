import { Image, Pressable, Text, View } from "react-native";
import type { UiTokens } from "@/shared/ui/primitives";

type Props = {
  photo: string;
  onRetake: () => void;
  onSave: () => void;
  onAddToDiary: () => void;
  tokens: UiTokens;
};

export function PhotoPreview({ photo, onRetake, onSave, onAddToDiary, tokens }: Props) {
  return (
    <View style={previewShell}>
      <Image accessibilityLabel="刚拍摄的照片预览" source={{ uri: photo }} style={previewImage} resizeMode="contain" />
      <View style={previewBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="重新拍摄" onPress={onRetake} style={previewBtn}>
          <Text style={previewBtnText}>↺ 重新拍摄</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="保存照片到手机" onPress={onSave} style={previewBtn}>
          <Text style={previewBtnText}>⤓ 保存照片</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="加入恋爱日记" onPress={onAddToDiary} style={[previewBtn, { backgroundColor: tokens.accent }]}>
          <Text style={[previewBtnText, { color: "#ffffff" }]}>♥ 加入恋爱日记</Text>
        </Pressable>
      </View>
    </View>
  );
}

const previewShell: object = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "#0b0f0c",
  alignItems: "center",
  justifyContent: "center"
};

const previewImage: object = {
  width: "100%",
  height: "82%",
  backgroundColor: "#000000"
};

const previewBar: object = {
  flexDirection: "row",
  gap: 10,
  paddingHorizontal: 16,
  paddingVertical: 16,
  width: "100%",
  justifyContent: "center",
  flexWrap: "wrap"
};

const previewBtn: object = {
  backgroundColor: "rgba(255,255,255,0.95)",
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 12,
  minHeight: 46,
  justifyContent: "center"
};

const previewBtnText: object = {
  color: "#111827",
  fontSize: 14,
  fontWeight: "900"
};
