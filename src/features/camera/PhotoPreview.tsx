import { Image, Pressable, Text, View } from "react-native";

type Props = {
  photo: string;
  onRetake: () => void;
  onSave: () => void;
};

/**
 * 拍照后的预览层：整屏显示刚拍的照片，仅提供两个动作。
 * 不再包含「加入恋爱日记」——智能相机不自动上传任何内容。
 */
export function PhotoPreview({ photo, onRetake, onSave }: Props) {
  return (
    <View style={previewShell}>
      <Image accessibilityLabel="刚拍摄的照片预览" source={{ uri: photo }} style={previewImage} resizeMode="contain" />
      <View style={previewBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="重新拍摄" onPress={onRetake} style={previewBtn}>
          <Text style={previewBtnText}>↺ 重新拍摄</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="保存照片" onPress={onSave} style={[previewBtn, previewBtnPrimary]}>
          <Text style={previewBtnText}>⤓ 保存照片</Text>
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
  height: "84%",
  backgroundColor: "#000000"
};

const previewBar: object = {
  flexDirection: "row",
  gap: 14,
  paddingHorizontal: 16,
  paddingVertical: 18,
  width: "100%",
  justifyContent: "center"
};

const previewBtn: object = {
  backgroundColor: "rgba(255,255,255,0.95)",
  borderRadius: 14,
  paddingHorizontal: 22,
  paddingVertical: 14,
  minHeight: 50,
  justifyContent: "center"
};

const previewBtnPrimary: object = {
  backgroundColor: "#1f8f55"
};

const previewBtnText: object = {
  color: "#111827",
  fontSize: 15,
  fontWeight: "900"
};
