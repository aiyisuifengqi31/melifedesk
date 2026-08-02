import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import buildExpoConfig from "../../app.config";

describe("Android app build configuration", () => {
  it("defines an APK build profile for sharing the app outside app stores", () => {
    const easPath = join(process.cwd(), "eas.json");

    expect(existsSync(easPath)).toBe(true);

    const config = JSON.parse(readFileSync(easPath, "utf8")) as {
      build: Record<string, { android?: { buildType?: string } }>;
    };

    expect(config.build.apk.android).toEqual({ buildType: "apk" });
    expect(config.build.production.android).toEqual({ buildType: "app-bundle" });
  });

  it("exposes package scripts for Android APK and store builds", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts["build:android:apk"]).toBe("eas build --platform android --profile apk");
    expect(pkg.scripts["build:android:store"]).toBe("eas build --platform android --profile production");
    expect(pkg.scripts["prebuild:android"]).toBe("expo prebuild --platform android");
  });

  it("uses the shared brand and Android package in Expo native config", () => {
    const config = buildExpoConfig();

    expect(config.name).toBe("帆帆和关关");
    expect(config.slug).toBe("fanfan-guanguan");
    expect(config.android?.package).toBe("com.fanfan.guanguan");
    expect(config.android?.versionCode).toBe(1);
  });
});
