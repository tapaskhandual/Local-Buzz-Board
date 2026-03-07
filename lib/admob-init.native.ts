import { Platform } from "react-native";

let mobileAds: any = null;

try {
  if (Platform.OS !== "web") {
    const admob = require("react-native-google-mobile-ads");
    mobileAds = admob.default || admob.mobileAds;
  }
} catch (e) {}

export async function initializeAdMob(): Promise<void> {
  if (!mobileAds || Platform.OS === "web") return;

  try {
    await mobileAds().initialize();
    console.log("AdMob initialized");
  } catch (e) {
    console.log("AdMob init skipped:", e);
  }
}
