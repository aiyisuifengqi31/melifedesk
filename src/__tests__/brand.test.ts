import { getPublicAppConfig } from "@/config/app";

describe("brand configuration", () => {
  it("uses the confirmed product name everywhere user-visible", () => {
    const config = getPublicAppConfig();

    expect(config.displayName).toBe("帆帆和关关");
    expect(config.subtitle).toBe("双人成长工作台");
    expect(config.fullDisplayName).toBe("帆帆和关关·双人成长工作台");
    expect(config.webTitle).toBe("帆帆和关关");
    expect(JSON.stringify(config)).not.toContain("LifeDesk");
  });

  it("uses ASCII technical identifiers", () => {
    const config = getPublicAppConfig();

    expect(config.slug).toBe("fanfan-guanguan");
    expect(config.scheme).toBe("fanfan-guanguan");
    expect(config.androidPackage).toBe("com.fanfan.guanguan");
    expect(config.iosBundleIdentifier).toBe("com.fanfan.guanguan");
  });
});
