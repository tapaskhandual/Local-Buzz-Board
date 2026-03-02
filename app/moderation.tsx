import React, { useState } from "react";
import {
  StyleSheet, Text, View, FlatList, Pressable,
  useColorScheme, ActivityIndicator, ScrollView, Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { authGet, authPost, authPut } from "@/lib/api";
import Colors from "@/constants/colors";

type Tab = "reports" | "logs";

export default function ModerationScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("reports");

  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ["/api/moderation/reports"],
    queryFn: () => authGet<any[]>("/api/moderation/reports"),
    staleTime: 10000,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["/api/moderation/logs"],
    queryFn: () => authGet<any[]>("/api/moderation/logs"),
    enabled: isAdmin,
    staleTime: 10000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      authPost(`/api/moderation/reports/${id}/review`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/moderation/reports"] }),
  });

  const hideMutation = useMutation({
    mutationFn: ({ type, id, reason }: { type: string; id: string; reason: string }) =>
      authPost(`/api/moderation/hide/${type}/${id}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moderation/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/nearby"] });
    },
  });

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  function renderReport({ item }: { item: any }) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.reportHeader}>
          <View style={[styles.reasonBadge, { backgroundColor: theme.danger + "20" }]}>
            <Text style={[styles.reasonText, { color: theme.danger }]}>{item.reason}</Text>
          </View>
          <Text style={[styles.time, { color: theme.textSecondary }]}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={[styles.reporterText, { color: theme.textSecondary }]}>
          Reported by: {item.reporterUsername}
        </Text>
        {item.details && (
          <Text style={[styles.details, { color: theme.text }]}>{item.details}</Text>
        )}
        <Text style={[styles.targetId, { color: theme.textSecondary }]}>
          {item.messageId ? `Message: ${item.messageId.slice(0, 8)}...` : `Business Post: ${item.businessPostId?.slice(0, 8)}...`}
        </Text>
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: theme.success + "20" }]}
            onPress={() => {
              if (item.messageId) {
                hideMutation.mutate({ type: "message", id: item.messageId, reason: `Report: ${item.reason}` });
              }
              reviewMutation.mutate({ id: item.id, status: "reviewed" });
            }}
          >
            <Feather name="eye-off" size={14} color={theme.success} />
            <Text style={[styles.actionText, { color: theme.success }]}>Hide & Review</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: theme.textSecondary + "20" }]}
            onPress={() => reviewMutation.mutate({ id: item.id, status: "dismissed" })}
          >
            <Feather name="x" size={14} color={theme.textSecondary} />
            <Text style={[styles.actionText, { color: theme.textSecondary }]}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderLog({ item }: { item: any }) {
    const actionColors: Record<string, string> = {
      hide: theme.warning,
      unhide: theme.success,
      warn: theme.warning,
      ban: theme.danger,
      unban: theme.success,
      role_change: theme.tint,
    };
    return (
      <View style={[styles.logItem, { borderBottomColor: theme.border }]}>
        <View style={styles.logHeader}>
          <View style={[styles.actionBadge, { backgroundColor: (actionColors[item.action] || theme.tint) + "20" }]}>
            <Text style={[styles.actionBadgeText, { color: actionColors[item.action] || theme.tint }]}>
              {item.action}
            </Text>
          </View>
          <Text style={[styles.logMod, { color: theme.text }]}>{item.moderatorUsername}</Text>
          <Text style={[styles.logTime, { color: theme.textSecondary }]}>{timeAgo(item.createdAt)}</Text>
        </View>
        <Text style={[styles.logTarget, { color: theme.textSecondary }]}>
          {item.targetType}: {item.targetId.slice(0, 12)}...
        </Text>
        {item.reason && (
          <Text style={[styles.logReason, { color: theme.textSecondary }]}>{item.reason}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === "reports" && { borderBottomColor: theme.tint, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("reports")}
        >
          <Text style={[styles.tabText, { color: activeTab === "reports" ? theme.tint : theme.textSecondary }]}>
            Reports ({reports?.length || 0})
          </Text>
        </Pressable>
        {isAdmin && (
          <Pressable
            style={[styles.tab, activeTab === "logs" && { borderBottomColor: theme.tint, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab("logs")}
          >
            <Text style={[styles.tabText, { color: activeTab === "logs" ? theme.tint : theme.textSecondary }]}>
              Audit Log
            </Text>
          </Pressable>
        )}
      </View>

      {activeTab === "reports" && (
        <FlatList
          data={reports || []}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
          ListEmptyComponent={
            reportsLoading ? (
              <View style={styles.emptyCenter}>
                <ActivityIndicator size="large" color={theme.tint} />
              </View>
            ) : (
              <View style={styles.emptyCenter}>
                <Feather name="check-circle" size={48} color={theme.success} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>All clear</Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No pending reports to review.
                </Text>
              </View>
            )
          }
        />
      )}

      {activeTab === "logs" && isAdmin && (
        <FlatList
          data={logs || []}
          keyExtractor={(item) => item.id}
          renderItem={renderLog}
          contentContainerStyle={[styles.list, { paddingBottom: 40 }]}
          ListEmptyComponent={
            logsLoading ? (
              <View style={styles.emptyCenter}>
                <ActivityIndicator size="large" color={theme.tint} />
              </View>
            ) : (
              <View style={styles.emptyCenter}>
                <Feather name="file-text" size={48} color={theme.textSecondary} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No logs yet</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabText: { fontSize: 15, fontWeight: "600" as const },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reasonBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  reasonText: { fontSize: 12, fontWeight: "600" as const, textTransform: "uppercase" as const },
  time: { fontSize: 12 },
  reporterText: { fontSize: 13 },
  details: { fontSize: 14 },
  targetId: { fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionText: { fontSize: 13, fontWeight: "500" as const },
  logItem: { paddingVertical: 12, borderBottomWidth: 1, gap: 4 },
  logHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  actionBadgeText: { fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase" as const },
  logMod: { fontSize: 14, fontWeight: "500" as const, flex: 1 },
  logTime: { fontSize: 12 },
  logTarget: { fontSize: 12, marginLeft: 4 },
  logReason: { fontSize: 13, marginLeft: 4, fontStyle: "italic" as const },
  emptyCenter: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600" as const },
  emptyText: { fontSize: 14, textAlign: "center" as const },
});
