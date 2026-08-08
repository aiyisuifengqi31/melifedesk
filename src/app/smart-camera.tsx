import { useRouter } from "expo-router";

import { SmartCameraScreen } from "@/features/camera/SmartCameraScreen";

export default function SmartCameraRoute() {
  const router = useRouter();
  return <SmartCameraScreen onExit={() => router.back()} />;
}
