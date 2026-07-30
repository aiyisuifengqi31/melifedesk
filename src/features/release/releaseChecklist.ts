const serviceRole = ["SERVICE", "ROLE"].join("_");
const serviceRoleLower = serviceRole.toLowerCase();
const publicServiceRole = ["EXPO_PUBLIC_SUPABASE", serviceRole, "KEY"].join("_");
const forbiddenClientFragments = [serviceRole, serviceRoleLower, publicServiceRole, "postgresql://", "pooler.supabase.com"];

export function assertPreviewEnvironment(input: { environment: "dev" | "staging" | "production"; releaseChannel: string }) {
  if (input.environment === "production") {
    throw new Error("Task 10 preview checks must not publish production");
  }
  if (input.releaseChannel === "production") {
    throw new Error("Production release channel requires a separate confirmation stage");
  }
  return true;
}

export function scanClientBundleForSecrets(bundleText: string) {
  return forbiddenClientFragments.filter((fragment) => bundleText.includes(fragment));
}

export function buildReleaseReadiness(input: {
  androidPackage: string;
  bundleIdentifier: string;
  hasBackupPlan: boolean;
  hasRollbackPlan: boolean;
  webTitle: string;
}) {
  return {
    androidPackageLocked: input.androidPackage === "com.fanfan.guanguan",
    bundleIdentifierLocked: input.bundleIdentifier === "com.fanfan.guanguan",
    canCreatePreviewBuild: input.hasBackupPlan && input.hasRollbackPlan && input.webTitle === "帆帆和关关",
    productionPublishAllowed: false
  };
}
