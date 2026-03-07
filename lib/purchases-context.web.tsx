import React, { createContext, useContext } from "react";

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
  return (
    <PurchasesContext.Provider
      value={{
        isReady: false,
        isPremium: false,
        offerings: null,
        purchasePackage: async () => false,
        restorePurchases: async () => false,
        loading: false,
      }}
    >
      {children}
    </PurchasesContext.Provider>
  );
}

export function usePurchases() {
  return useContext(PurchasesContext);
}
