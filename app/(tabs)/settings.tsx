import React, { useState } from "react";
import {
  StyleSheet, Text, View, Pressable, useColorScheme,
  TextInput, ScrollView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { usePurchases } from "@/lib/purchases-context";
import { authPut, authPost } from "@/lib/api";
import Colors from "@/constants/colors";

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || "");

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => authPut("/api/auth/profile", { displayName: name }),
    onSuccess: () => {
      refreshUser();
      setEditingName(false);
    },
  });

  const { offerings, purchasePackage, restorePurchases, loading: purchaseLoading, isReady: purchasesReady } = usePurchases();

  const activateSubMutation = useMutation({
    mutationFn: (tier: string) => authPost("/api/subscriptions/activate", { type: "user", tier }),
    onSuccess: () => refreshUser(),
  });

  const isMod = user?.role === "moderator" || user?.role === "admin" || user?.role === "owner";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 120 + webBottomInset }}
    >
      <View style={[styles.profileCard, { backgroundColor: theme.surface }]}>
        <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
          <Text style={styles.avatarText}>
            {(user?.displayName || user?.username || "?")[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
              />
              <Pressable onPress={() => updateNameMutation.mutate(displayName)}>
                <Feather name="check" size={20} color={theme.success} />
              </Pressable>
              <Pressable onPress={() => setEditingName(false)}>
                <Feather name="x" size={20} color={theme.danger} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={styles.nameRow}>
              <Text style={[styles.displayName, { color: theme.text }]}>
                {user?.displayName || user?.username}
              </Text>
              <Feather name="edit-2" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
          <Text style={[styles.usernameText, { color: theme.textSecondary }]}>@{user?.username}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.text }]}>{user?.role}</Text>
            </View>
            {user?.isPremium && (
              <View style={[styles.badge, { backgroundColor: theme.premium + "30" }]}>
                <Feather name="star" size={12} color={theme.premium} />
                <Text style={[styles.badgeText, { color: theme.premium }]}>Premium</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {!user?.isPremium && (
        <View style={[styles.section, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Go Premium</Text>
          <Text style={[styles.sectionDesc, { color: theme.textSecondary }]}>
            See messages from up to 25 miles away instead of 5 miles.
          </Text>
          {purchasesReady && offerings?.availablePackages?.length > 0 ? (
            <>
              <View style={styles.subOptions}>
                {offerings.availablePackages.map((pkg: any) => (
                  <Pressable
                    key={pkg.identifier}
                    style={({ pressed }) => [
                      styles.subOption,
                      { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => purchasePackage(pkg)}
                    disabled={purchaseLoading}
                  >
                    {purchaseLoading ? (
                      <ActivityIndicator size="small" color={theme.tint} />
                    ) : (
                      <>
                        <Text style={[styles.subLabel, { color: theme.text }]}>
                          {pkg.product.title || pkg.identifier}
                        </Text>
                        <Text style={[styles.subPrice, { color: theme.tint }]}>
                          {pkg.product.priceString}
                        </Text>
                      </>
                    )}
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={restorePurchases} disabled={purchaseLoading}>
                <Text style={[styles.subNote, { color: theme.tint }]}>
                  Restore Purchases
                </Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.subOptions}>
              {[
                { tier: "monthly", label: "Monthly", price: "$2.99/mo" },
                { tier: "yearly", label: "Yearly", price: "$19.99/yr" },
                { tier: "lifetime", label: "Lifetime", price: "$49.99" },
              ].map((opt) => (
                <Pressable
                  key={opt.tier}
                  style={({ pressed }) => [
                    styles.subOption,
                    { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => activateSubMutation.mutate(opt.tier)}
                >
                  <Text style={[styles.subLabel, { color: theme.text }]}>{opt.label}</Text>
                  <Text style={[styles.subPrice, { color: theme.tint }]}>{opt.price}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {isMod && (
        <Pressable
          style={[styles.menuItem, { backgroundColor: theme.surface }]}
          onPress={() => router.push("/moderation")}
        >
          <Feather name="shield" size={20} color={theme.tint} />
          <Text style={[styles.menuText, { color: theme.text }]}>Moderation Panel</Text>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      )}

      <Pressable
        style={[styles.menuItem, { backgroundColor: theme.surface }]}
        onPress={() => router.push("/info")}
      >
        <Feather name="info" size={20} color={theme.tint} />
        <Text style={[styles.menuText, { color: theme.text }]}>About & Help Guide</Text>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>

      <Pressable
        style={[styles.logoutBtn, { backgroundColor: theme.danger + "15" }]}
        onPress={logout}
      >
        <Feather name="log-out" size={20} color={theme.danger} />
        <Text style={[styles.logoutText, { color: theme.danger }]}>Sign Out</Text>
      </Pressable>

      <View style={styles.creditFooter}>
        <Text style={[styles.creditText, { color: theme.textSecondary }]}>
          Crafted with ❤️ by Tapas Khandual
        </Text>
        <Text style={[styles.version, { color: theme.textSecondary }]}>
          Local Buzz v1.0.0 — Open Source
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "700" as const },
  profileInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  displayName: { fontSize: 18, fontWeight: "700" as const },
  usernameText: { fontSize: 14 },
  badges: { flexDirection: "row", gap: 6, marginTop: 4 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 12, fontWeight: "500" as const },
  section: {
    margin: 16,
    marginTop: 0,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700" as const },
  sectionDesc: { fontSize: 14, lineHeight: 20 },
  subOptions: { flexDirection: "row", gap: 8 },
  subOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  subLabel: { fontSize: 13, fontWeight: "600" as const },
  subPrice: { fontSize: 14, fontWeight: "700" as const },
  subNote: { fontSize: 12, textAlign: "center" as const },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  menuText: { flex: 1, fontSize: 16, fontWeight: "500" as const },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: { fontSize: 16, fontWeight: "600" as const },
  creditFooter: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  creditText: { fontSize: 15, fontWeight: "600" as const },
  version: { fontSize: 12, textAlign: "center" as const },
});
