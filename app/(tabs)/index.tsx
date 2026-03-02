import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet, Text, View, FlatList, Pressable, RefreshControl,
  useColorScheme, Platform, ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/lib/location-context";
import { authGet, authPost } from "@/lib/api";
import { AdBanner } from "@/components/AdBanner";
import { loadInterstitial } from "@/components/AdInterstitial";
import Colors from "@/constants/colors";

const CATEGORY_ICONS: Record<string, string> = {
  general: "message-circle",
  alert: "alert-triangle",
  question: "help-circle",
  event: "calendar",
  safety: "shield",
};

const REACTIONS = [
  { type: "like", icon: "thumbs-up", label: "Like" },
  { type: "helpful", icon: "award", label: "Helpful" },
  { type: "funny", icon: "smile", label: "Funny" },
  { type: "warning", icon: "alert-circle", label: "Warning" },
];

interface MessageItem {
  id: string;
  userId: string;
  content: string;
  category: string;
  likesCount: number;
  flagCount: number;
  createdAt: string;
  distance: number;
  username: string;
  displayName: string | null;
}

export default function FeedScreen() {
  const { user } = useAuth();
  const { location, permissionStatus, requestPermission } = useLocation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    loadInterstitial();
  }, []);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["/api/messages/nearby", location?.latitude, location?.longitude],
    queryFn: () => authGet<{ messages: MessageItem[]; radius: number }>(
      `/api/messages/nearby?lat=${location!.latitude}&lng=${location!.longitude}`
    ),
    enabled: !!location,
    staleTime: 30000,
  });

  const reactMutation = useMutation({
    mutationFn: ({ messageId, type }: { messageId: string; type: string }) =>
      authPost(`/api/messages/${messageId}/react`, { type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/messages/nearby"] }),
  });

  const reportMutation = useMutation({
    mutationFn: ({ messageId, reason }: { messageId: string; reason: string }) =>
      authPost(`/api/messages/${messageId}/report`, { reason }),
  });

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return "1d ago";
  }

  if (!permissionStatus || permissionStatus !== "granted") {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingTop: insets.top + webTopInset }]}>
        <Feather name="map-pin" size={48} color={theme.tint} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Location Required</Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Local Buzz needs your location to show messages from people near you.
        </Text>
        <Pressable
          style={[styles.actionButton, { backgroundColor: theme.tint }]}
          onPress={requestPermission}
        >
          <Text style={styles.actionButtonText}>Enable Location</Text>
        </Pressable>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.tint} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Getting your location...</Text>
      </View>
    );
  }

  function renderMessage({ item }: { item: MessageItem }) {
    const catIcon = CATEGORY_ICONS[item.category] || "message-circle";
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardMeta}>
            <View style={[styles.categoryBadge, { backgroundColor: theme.tint + "20" }]}>
              <Feather name={catIcon as any} size={12} color={theme.tint} />
            </View>
            <Text style={[styles.username, { color: theme.text }]}>
              {item.displayName || item.username}
            </Text>
            <Text style={[styles.dot, { color: theme.textSecondary }]}>.</Text>
            <Text style={[styles.time, { color: theme.textSecondary }]}>{timeAgo(item.createdAt)}</Text>
          </View>
          <View style={styles.distanceBadge}>
            <Feather name="navigation" size={10} color={theme.textSecondary} />
            <Text style={[styles.distance, { color: theme.textSecondary }]}>
              {item.distance < 1 ? `${Math.round(item.distance * 5280)}ft` : `${item.distance.toFixed(1)}mi`}
            </Text>
          </View>
        </View>

        <Text style={[styles.content, { color: theme.text }]}>{item.content}</Text>

        <View style={styles.cardActions}>
          {REACTIONS.map((r) => (
            <Pressable
              key={r.type}
              style={[styles.reactionBtn, { backgroundColor: theme.background }]}
              onPress={() => reactMutation.mutate({ messageId: item.id, type: r.type })}
            >
              <Feather name={r.icon as any} size={14} color={theme.textSecondary} />
              <Text style={[styles.reactionLabel, { color: theme.textSecondary }]}>{r.label}</Text>
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          {item.likesCount > 0 && (
            <Text style={[styles.likeCount, { color: theme.textSecondary }]}>
              {item.likesCount}
            </Text>
          )}
          <Pressable
            style={[styles.reactionBtn, { backgroundColor: "#ef444415" }]}
            onPress={() => reportMutation.mutate({ messageId: item.id, reason: "inappropriate" })}
          >
            <Feather name="flag" size={14} color="#ef4444" />
            <Text style={[styles.reactionLabel, { color: "#ef4444" }]}>Report</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {data && (
        <View style={[styles.radiusBanner, { backgroundColor: theme.accent }]}>
          <Feather name="radio" size={14} color={theme.tint} />
          <Text style={[styles.radiusText, { color: theme.tint }]}>
            {user?.isPremium ? "Premium" : "Free"} - Showing posts within {data.radius} miles
          </Text>
        </View>
      )}

      <FlatList
        data={data?.messages || []}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.tint} />
        }
        ListHeaderComponent={<AdBanner style={{ marginBottom: 8 }} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.tint} />
            </View>
          ) : (
            <View style={styles.center}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts nearby</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Be the first to share something with your community!
              </Text>
            </View>
          )
        }
      />

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.tint, opacity: pressed ? 0.9 : 1, bottom: 90 + (Platform.OS === "web" ? 34 : 0) },
        ]}
        onPress={() => router.push("/compose")}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
    paddingTop: 80,
  },
  radiusBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  radiusText: { fontSize: 13, fontWeight: "600" as const },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  categoryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { fontSize: 14, fontWeight: "600" as const },
  dot: { fontSize: 14 },
  time: { fontSize: 12 },
  distanceBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  distance: { fontSize: 12 },
  content: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
  },
  reactionLabel: {
    fontSize: 11,
    fontWeight: "500" as const,
  },
  likeCount: { fontSize: 13, fontWeight: "500" as const },
  emptyTitle: { fontSize: 20, fontWeight: "700" as const },
  emptyText: { fontSize: 15, textAlign: "center" as const, lineHeight: 22 },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  actionButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" as const },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
