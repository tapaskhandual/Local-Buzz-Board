import { Platform } from "react-native";

export const AD_UNIT_IDS = {
  BANNER: "ca-app-pub-8601548769874186/2793113749",
  INTERSTITIAL: "ca-app-pub-8601548769874186/6133117597",
  APP_OPEN: "ca-app-pub-8601548769874186/7314483118",
  NATIVE_ADVANCED: "ca-app-pub-8601548769874186/4106195413",
};

export const TEST_AD_UNIT_IDS = {
  BANNER: Platform.select({
    android: "ca-app-pub-3940256099942544/6300978111",
    ios: "ca-app-pub-3940256099942544/2934735716",
    default: "",
  }) as string,
  INTERSTITIAL: Platform.select({
    android: "ca-app-pub-3940256099942544/1033173712",
    ios: "ca-app-pub-3940256099942544/4411468910",
    default: "",
  }) as string,
  APP_OPEN: Platform.select({
    android: "ca-app-pub-3940256099942544/9257395921",
    ios: "ca-app-pub-3940256099942544/5575463023",
    default: "",
  }) as string,
};

export const IS_DEV = __DEV__;

export function getAdUnitId(type: keyof typeof AD_UNIT_IDS): string {
  if (IS_DEV) {
    return TEST_AD_UNIT_IDS[type as keyof typeof TEST_AD_UNIT_IDS] || "";
  }
  return AD_UNIT_IDS[type];
}
