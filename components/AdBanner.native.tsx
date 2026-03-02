import React, { useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { getAdUnitId } from "@/constants/ads";

let BannerAd: any = null;
let BannerAdSize: any = null;

try {
  if (Platform.OS !== "web") {
    const admob = require("react-native-google-mobile-ads");
    BannerAd = admob.BannerAd;
    BannerAdSize = admob.BannerAdSize;
  }
} catch (e) {}

interface AdBannerProps {
  style?: any;
}

export function AdBanner({ style }: AdBannerProps) {
  const [adError, setAdError] = useState(false);

  if (!BannerAd || !BannerAdSize || Platform.OS === "web" || adError) {
    return null;
  }

  const unitId = getAdUnitId("BANNER");
  if (!unitId) return null;

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setAdError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    width: "100%",
  },
});
