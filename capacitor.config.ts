import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.butce",
  appName: "Bütçe",
  webDir: "app-www",
  android: { backgroundColor: "#f5f5f3" },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: "#f5f5f3", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#f5f5f3", overlaysWebView: false },
    // Havadan güncelleme: app.js kendisi kontrol eder (canlı sitedeki /ota/latest.json).
    CapacitorUpdater: { autoUpdate: false, appReadyTimeout: 15000 },
    // Canlı siteye yapılan istekler yerel ağ katmanından gider (CORS engeli olmaz).
    CapacitorHttp: { enabled: true },
  },
};

export default config;
