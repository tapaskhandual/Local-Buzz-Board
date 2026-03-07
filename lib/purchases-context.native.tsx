import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform, Alert } from "react-native";
import { useAuth } from "@/lib/auth-context";
import { authPost } from "@/lib/api";

let Purchases: any = null;
let LOG_LEVEL: any = null;
let PACKAGE_TYPE: any = null;

try {
  if (Platform.OS !== "web") {
    const rc = require("react-native-purchases");
    Purchases = rc.default || rc.Purchases;
    LOG_LEVEL = rc.LOG_LEVEL;
    PACKAGE_TYPE = rc.PACKAGE_TYPE;
  }
} catch (e) {}

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY || "";
const ENTITLEMENT_ID = "premium";

interface PurchasesContextType {
  isReady: boolean;
  isPremium: boolean;
  offerings: any | null;
  purchasePackage: (pkg: any) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  loading: boolean;
}

const PurchasesContext = createContext<PurchasesContextType>({
  isReady: false,
  isPremium: false,
  offerings: null,
  purchasePackage: async () => false,
  restorePurchases: async () => false,
  loading: false,
});

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!Purchases || !REVENUECAT_API_KEY || Platform.OS === "web") return;

    async function init() {
      try {
        if (LOG_LEVEL) {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }
        await Purchases.configure({
          apiKey: REVENUECAT_API_KEY,
          appUserID: user?.id || null,
        });
        setIsReady(true);
        await checkSubscriptionStatus();
        await loadOfferings();
      } catch (e) {
        console.log("RevenueCat init error:", e);
      }
    }

    if (user?.id) {
      init();
    }
  }, [user?.id]);

  async function checkSubscriptionStatus() {
    if (!Purchases) return;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      setIsPremium(!!entitlement);
    } catch (e) {
      console.log("Check subscription error:", e);
    }
  }

  async function loadOfferings() {
    if (!Purchases) return;
    try {
      const offeringsData = await Purchases.getOfferings();
      if (offeringsData.current) {
        setOfferings(offeringsData.current);
      }
    } catch (e) {
      console.log("Load offerings error:", e);
    }
  }

  const purchasePackage = useCallback(async (pkg: any): Promise<boolean> => {
    if (!Purchases) return false;
    setLoading(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

      if (entitlement) {
        setIsPremium(true);

        let tier = "monthly";
        if (PACKAGE_TYPE) {
          if (pkg.packageType === PACKAGE_TYPE.ANNUAL) tier = "yearly";
          else if (pkg.packageType === PACKAGE_TYPE.LIFETIME) tier = "lifetime";
        }

        const subType = pkg.identifier?.includes("business") ? "business" : "user";

        try {
          await authPost("/api/subscriptions/activate", {
            type: subType,
            tier,
            purchaseToken: entitlement.productIdentifier,
            revenuecatId: customerInfo.originalAppUserId,
          });
          refreshUser();
        } catch (e) {
          console.log("Server sync error:", e);
        }

        return true;
      }
      return false;
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Purchase Error", e.message || "Something went wrong. Please try again.");
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Purchases) return false;
    setLoading(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

      if (entitlement) {
        setIsPremium(true);
        try {
          await authPost("/api/subscriptions/activate", {
            type: "user",
            tier: "monthly",
            purchaseToken: entitlement.productIdentifier,
            revenuecatId: customerInfo.originalAppUserId,
          });
          refreshUser();
        } catch (e) {
          console.log("Server sync error:", e);
        }
        Alert.alert("Restored", "Your premium subscription has been restored.");
        return true;
      } else {
        Alert.alert("No Purchases", "No previous purchases were found.");
        return false;
      }
    } catch (e: any) {
      Alert.alert("Restore Error", e.message || "Could not restore purchases.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  return (
    <PurchasesContext.Provider
      value={{ isReady, isPremium, offerings, purchasePackage, restorePurchases, loading }}
    >
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  return useContext(PurchasesContext);
}
