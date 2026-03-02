import { Platform } from "react-native";
import { getAdUnitId } from "@/constants/ads";

let InterstitialAd: any = null;
let AdEventType: any = null;

try {
  if (Platform.OS !== "web") {
    const admob = require("react-native-google-mobile-ads");
    InterstitialAd = admob.InterstitialAd;
    AdEventType = admob.AdEventType;
  }
} catch (e) {}

let interstitial: any = null;
let isLoaded = false;
let listeners: Array<() => void> = [];

function cleanupListeners() {
  listeners.forEach((unsub) => {
    try { unsub(); } catch (e) {}
  });
  listeners = [];
}

export function loadInterstitial() {
  if (!InterstitialAd || !AdEventType || Platform.OS === "web") return;

  const unitId = getAdUnitId("INTERSTITIAL");
  if (!unitId) return;

  cleanupListeners();
  isLoaded = false;

  try {
    interstitial = InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const unsubLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      isLoaded = true;
    });

    const unsubClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      isLoaded = false;
      loadInterstitial();
    });

    const unsubError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
      isLoaded = false;
    });

    listeners = [unsubLoaded, unsubClosed, unsubError];
    interstitial.load();
  } catch (e) {
    console.log("Interstitial ad not available");
  }
}

export function showInterstitial(): boolean {
  if (!interstitial || !isLoaded) return false;
  try {
    interstitial.show();
    return true;
  } catch (e) {
    return false;
  }
}
