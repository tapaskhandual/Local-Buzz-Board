import React, { useState } from "react";
import {
  StyleSheet, Text, View, FlatList, Pressable, RefreshControl,
  useColorScheme, ActivityIndicator, TextInput, Modal, Platform,
  KeyboardAvoidingView, ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocation } from "@/lib/location-context";
import { useAuth } from "@/lib/auth-context";
import { usePurchases } from "@/lib/purchases-context";
import { authGet, authPost, authPut } from "@/lib/api";
import { AdBanner } from "@/components/AdBanner";
import Colors from "@/constants/colors";

interface BusinessPostItem {
  id: string;
  content: string;
  businessName: string;
  businessCategory: string | null;
  distance: number;
  createdAt: string;
}

export default function BusinessScreen() {
  const { user, refreshUser } = useAuth();
  const { location } = useLocation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [showSetup, setShowSetup] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessDesc, setBusinessDesc] = useState("");
  const [businessCat, setBusinessCat] = useState("");
  const [postContent, setPostContent] = useState("");
  const [error, setError] = useState("");

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data: postsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["/api/business/posts/nearby", location?.latitude, location?.longitude],
    queryFn: () => authGet<{ posts: BusinessPostItem[]; radius: number }>(
      `/api/business/posts/nearby?lat=${location!.latitude}&lng=${location!.longitude}`
    ),
    enabled: !!location,
    staleTime: 30000,
  });

  const { data: profile } = useQuery({
    queryKey: ["/api/business/profile"],
    queryFn: async () => {
      try {
        return await authGet<any>("/api/business/profile");
      } catch (e: any) {
        if (e.message === "No business profile") return null;
        throw e;
      }
    },
    retry: 1,
  });

  const createProfileMutation = useMutation({
    mutationFn: (data: { businessName: string; description?: string; category?: string }) =>
      authPost("/api/business/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/profile"] });
      setShowSetup(false);
    },
    onError: (err: any) => setError(err.message),
  });

  const createPostMutation = useMutation({
    mutationFn: (data: { content: string; latitude: number; longitude: number }) =>
      authPost("/api/business/posts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/posts/nearby"] });
      setShowPost(false);
      setPostContent("");
    },
    onError: (err: any) => setError(err.message),
  });

  const { offerings, purchasePackage, loading: purchaseLoading, isReady: purchasesReady } = usePurchases();

  const activateSubMutation = useMutation({
    mutationFn: (tier: string) =>
      authPost("/api/subscriptions/activate", { type: "business", tier }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/profile"] });
      refreshUser();
    },
    onError: (err: any) => setError(err.message),
  });

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  }

  function renderPost({ item }: { item: BusinessPostItem }) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.bizBadge, { backgroundColor: theme.tint + "20" }]}>
            <Feather name="briefcase" size={14} color={theme.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bizName, { color: theme.text }]}>{item.businessName}</Text>
            {item.businessCategory && (
              <Text style={[styles.bizCat, { color: theme.textSecondary }]}>{item.businessCategory}</Text>
            )}
          </View>
          <View style={styles.cardMetaRight}>
            <Text style={[styles.time, { color: theme.textSecondary }]}>{timeAgo(item.createdAt)}</Text>
            <View style={styles.distBadge}>
              <Feather name="navigation" size={10} color={theme.textSecondary} />
              <Text style={[styles.dist, { color: theme.textSecondary }]}>
                {item.distance < 1 ? `${Math.round(item.distance * 5280)}ft` : `${item.distance.toFixed(1)}mi`}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.content, { color: theme.text }]}>{item.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={postsData?.posts || []}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.tint} />
        }
        ListHeaderComponent={
          <>
            <AdBanner style={{ marginBottom: 8 }} />
            {profile && (
            <View style={[styles.ownerBanner, { backgroundColor: theme.accent }]}>
              <Feather name="briefcase" size={16} color={theme.tint} />
              <Text style={[styles.ownerText, { color: theme.text }]}>
                {profile.businessName}
              </Text>
              {profile.subscriptionStatus === "active" ? (
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: theme.tint }]}
                  onPress={() => setShowPost(true)}
                >
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={styles.smallBtnText}>Post</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: theme.premium }]}
                  onPress={() => {
                    if (purchasesReady && offerings?.availablePackages?.length > 0) {
                      const monthlyPkg = offerings.availablePackages.find(
                        (p: any) => p.packageType === "$rc_monthly" || p.identifier === "$rc_monthly"
                      ) || offerings.availablePackages[0];
                      purchasePackage(monthlyPkg);
                    } else {
                      activateSubMutation.mutate("monthly");
                    }
                  }}
                  disabled={purchaseLoading}
                >
                  <Feather name="star" size={14} color="#fff" />
                  <Text style={styles.smallBtnText}>
                    {purchasesReady ? "Subscribe" : "Activate (Test)"}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyCenter}>
              <ActivityIndicator size="large" color={theme.tint} />
            </View>
          ) : (
            <View style={styles.emptyCenter}>
              <Feather name="briefcase" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No business promotions</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No businesses are promoting in your area yet.
              </Text>
            </View>
          )
        }
      />

      {!profile && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.tint, opacity: pressed ? 0.9 : 1, bottom: 90 + (Platform.OS === "web" ? 34 : 0) },
          ]}
          onPress={() => setShowSetup(true)}
        >
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.fabText}>Business</Text>
        </Pressable>
      )}

      <Modal visible={showSetup} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.modalSpacer} />
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Register Business</Text>
                <Pressable onPress={() => setShowSetup(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="Business Name"
                placeholderTextColor={theme.textSecondary}
                value={businessName}
                onChangeText={setBusinessName}
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="Category (e.g., Restaurant, Retail)"
                placeholderTextColor={theme.textSecondary}
                value={businessCat}
                onChangeText={setBusinessCat}
              />
              <TextInput
                style={[styles.input, styles.multiInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="Description"
                placeholderTextColor={theme.textSecondary}
                value={businessDesc}
                onChangeText={setBusinessDesc}
                multiline
                textAlignVertical="top"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                style={[styles.submitBtn, { backgroundColor: theme.tint }]}
                onPress={() => createProfileMutation.mutate({
                  businessName: businessName.trim(),
                  description: businessDesc.trim() || undefined,
                  category: businessCat.trim() || undefined,
                })}
              >
                <Text style={styles.submitBtnText}>Register</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPost} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.modalSpacer} />
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>New Promotion</Text>
                <Pressable onPress={() => setShowPost(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, styles.multiInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="Write your promotion..."
                placeholderTextColor={theme.textSecondary}
                value={postContent}
                onChangeText={setPostContent}
                multiline
                autoFocus
                textAlignVertical="top"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Pressable
                style={[styles.submitBtn, { backgroundColor: theme.tint }]}
                onPress={() => {
                  if (!postContent.trim() || !location) return;
                  createPostMutation.mutate({
                    content: postContent.trim(),
                    latitude: location.latitude,
                    longitude: location.longitude,
                  });
                }}
              >
                {createPostMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Post Promotion</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  bizBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bizName: { fontSize: 15, fontWeight: "600" as const },
  bizCat: { fontSize: 12 },
  cardMetaRight: { alignItems: "flex-end", gap: 2 },
  time: { fontSize: 12 },
  distBadge: { flexDirection: "row", alignItems: "center", gap: 2 },
  dist: { fontSize: 11 },
  content: { fontSize: 15, lineHeight: 22 },
  ownerBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  ownerText: { flex: 1, fontSize: 14, fontWeight: "600" as const },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  smallBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" as const },
  emptyCenter: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700" as const },
  emptyText: { fontSize: 15, textAlign: "center" as const },
  fab: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 14, fontWeight: "600" as const },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  modalSpacer: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 20, fontWeight: "700" as const },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  multiInput: { height: 100, paddingTop: 12 },
  errorText: { color: "#ef4444", fontSize: 14, textAlign: "center" as const },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
});
