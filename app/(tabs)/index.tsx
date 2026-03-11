import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet, Text, View, FlatList, Pressable, RefreshControl,
  useColorScheme, Platform, ActivityIndicator, TextInput, Modal,
  KeyboardAvoidingView, ScrollView,
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

interface ReplyItem {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  username: string;
  displayName: string | null;
}

interface MessageItem {
  id: string;
  userId: string;
  content: string;
  category: string;
  likesCount: number;
  replyCount: number;
  flagCount: number;
  createdAt: string;
  distance: number;
  username: string;
  displayName: string | null;
  userReaction: string | null;
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

  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

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

  const replyMutation = useMutation({
    mutationFn: ({ messageId, content }: { messageId: string; content: string }) =>
      authPost(`/api/messages/${messageId}/reply`, { content }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/nearby"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/replies", variables.messageId] });
      setReplyingTo(null);
      setReplyContent("");
    },
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

  function toggleReplies(messageId: string) {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
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
    const isExpanded = expandedReplies.has(item.id);
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
          {REACTIONS.map((r) => {
            const isActive = item.userReaction === r.type;
            return (
              <Pressable
                key={r.type}
                style={[
                  styles.reactionBtn,
                  {
                    backgroundColor: isActive ? theme.tint + "20" : theme.background,
                    borderWidth: isActive ? 1 : 0,
                    borderColor: isActive ? theme.tint + "40" : "transparent",
                  },
                ]}
                onPress={() => reactMutation.mutate({ messageId: item.id, type: r.type })}
              >
                <Feather
                  name={r.icon as any}
                  size={14}
                  color={isActive ? theme.tint : theme.textSecondary}
                />
                <Text style={[styles.reactionLabel, { color: isActive ? theme.tint : theme.textSecondary, fontWeight: isActive ? "700" : "500" }]}>
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.bottomRow}>
          <Pressable
            style={styles.replyTrigger}
            onPress={() => setReplyingTo(item)}
          >
            <Feather name="message-square" size={13} color={theme.textSecondary} />
            <Text style={[styles.replyTriggerText, { color: theme.textSecondary }]}>Reply</Text>
          </Pressable>

          {item.replyCount > 0 && (
            <Pressable onPress={() => toggleReplies(item.id)} style={styles.replyTrigger}>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13} color={theme.tint} />
              <Text style={[styles.replyTriggerText, { color: theme.tint }]}>
                {item.replyCount} {item.replyCount === 1 ? "reply" : "replies"}
              </Text>
            </Pressable>
          )}

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
          </Pressable>
        </View>

        {isExpanded && <RepliesSection messageId={item.id} theme={theme} timeAgo={timeAgo} />}
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

      <Modal visible={!!replyingTo} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.replyModalOverlay}
          behavior="padding"
        >
          <ScrollView
            contentContainerStyle={styles.replyModalScrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.replyModalSpacer} />
            <View style={[styles.replyModalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.replyModalHeader}>
                <Text style={[styles.replyModalTitle, { color: theme.text }]}>
                  Reply to {replyingTo?.displayName || replyingTo?.username}
                </Text>
                <Pressable onPress={() => { setReplyingTo(null); setReplyContent(""); }}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
              {replyingTo && (
                <Text style={[styles.replyOriginal, { color: theme.textSecondary }]} numberOfLines={2}>
                  "{replyingTo.content}"
                </Text>
              )}
              <TextInput
                style={[styles.replyInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                placeholder="Write a reply..."
                placeholderTextColor={theme.textSecondary}
                value={replyContent}
                onChangeText={setReplyContent}
                multiline
                maxLength={300}
                autoFocus
                textAlignVertical="top"
              />
              <View style={styles.replyModalFooter}>
                <Text style={[styles.replyCharCount, { color: theme.textSecondary }]}>
                  {replyContent.length}/300
                </Text>
                <Pressable
                  style={[styles.replySendBtn, { backgroundColor: theme.tint, opacity: replyContent.trim().length > 0 ? 1 : 0.5 }]}
                  onPress={() => {
                    if (replyingTo && replyContent.trim()) {
                      replyMutation.mutate({ messageId: replyingTo.id, content: replyContent.trim() });
                    }
                  }}
                  disabled={!replyContent.trim() || replyMutation.isPending}
                >
                  {replyMutation.isPending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name="send" size={14} color="#fff" />
                      <Text style={styles.replySendText}>Reply</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function RepliesSection({ messageId, theme, timeAgo }: { messageId: string; theme: typeof Colors.dark; timeAgo: (d: string) => string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/messages/replies", messageId],
    queryFn: () => authGet<{ replies: ReplyItem[] }>(`/api/messages/${messageId}/replies`),
  });

  if (isLoading) {
    return (
      <View style={styles.repliesContainer}>
        <ActivityIndicator size="small" color={theme.tint} />
      </View>
    );
  }

  if (!data?.replies?.length) {
    return null;
  }

  return (
    <View style={styles.repliesContainer}>
      {data.replies.map((reply) => (
        <View key={reply.id} style={[styles.replyCard, { backgroundColor: theme.background }]}>
          <View style={styles.replyHeader}>
            <Text style={[styles.replyAuthor, { color: theme.text }]}>
              {reply.displayName || reply.username}
            </Text>
            <Text style={[styles.replyTime, { color: theme.textSecondary }]}>
              {timeAgo(reply.createdAt)}
            </Text>
          </View>
          <Text style={[styles.replyText, { color: theme.text }]}>{reply.content}</Text>
        </View>
      ))}
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
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 8,
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
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  replyTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyTriggerText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  likeCount: { fontSize: 13, fontWeight: "500" as const },
  repliesContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
    gap: 8,
  },
  replyCard: {
    padding: 10,
    borderRadius: 10,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  replyTime: {
    fontSize: 10,
  },
  replyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  replyModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  replyModalScrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  replyModalSpacer: {
    flex: 1,
  },
  replyModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  replyModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  replyModalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  replyOriginal: {
    fontSize: 13,
    fontStyle: "italic" as const,
    lineHeight: 18,
  },
  replyInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    minHeight: 80,
  },
  replyModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyCharCount: {
    fontSize: 12,
  },
  replySendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  replySendText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
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
