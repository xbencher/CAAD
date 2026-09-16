import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Proxi",
  slug: "proxi",
  scheme: "proxi",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: ["expo-router", "expo-status-bar"],
  extra: {
    API_BASE_URL: process.env.API_BASE_URL,
  },
};

export default config;
