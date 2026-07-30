export type PublicAppConfig = {
  displayName: string;
  subtitle: string;
  fullDisplayName: string;
  webTitle: string;
  slug: string;
  scheme: string;
  androidPackage: string;
  iosBundleIdentifier: string;
};

const publicAppConfig: PublicAppConfig = {
  displayName: "帆帆和关关",
  subtitle: "双人成长工作台",
  fullDisplayName: "帆帆和关关·双人成长工作台",
  webTitle: "帆帆和关关",
  slug: "fanfan-guanguan",
  scheme: "fanfan-guanguan",
  androidPackage: "com.fanfan.guanguan",
  iosBundleIdentifier: "com.fanfan.guanguan"
};

export function getPublicAppConfig(): PublicAppConfig {
  return publicAppConfig;
}
