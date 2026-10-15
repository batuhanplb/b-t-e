import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.butce",
  appName: "Bütçe",
  webDir: "app-www",
  android: { backgroundColor: "#f5f5f3" },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: "#f5f5f3", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#f5f5f3", overlaysWebView: false },
  },
};

export default config;
