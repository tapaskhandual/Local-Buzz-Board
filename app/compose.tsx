import React, { useState } from "react";
import {
  StyleSheet, Text, View, TextInput, Pressable,
  useColorScheme, ActivityIndicator, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useLocation } from "@/lib/location-context";
import { authPost } from "@/lib/api";
import { showInterstitial } from "@/components/AdInterstitial";
import Colors from "@/constants/colors";

const CATEGORIES = [
  { id: "general", label: "General", icon: "message-circle" },
  { id: "alert", label: "Alert", icon: "alert-triangle" },
  { id: "question", label: "Question", icon: "help-circle" },
  { id: "event", label: "Event", icon: "calendar" },
  { id: "safety", label: "Safety", icon: "shield" },
];

export default function ComposeScreen() {
  const { location } = useLocation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { content: string; latitude: number; longitude: number; category: string }) =>
      authPost("/api/messages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/nearby"] });
      showInterstitial();
      router.back();
    },
    onError: (err: any) => setError(err.message),
  });

  function handlePost() {
    if (!content.trim()) {
      setError("Please write something");
      return;
    }
    if (content.trim().length > 500) {
      setError("Message too long (max 500 characters)");
      return;
    }
    if (!location) {
      setError("Location not available");
      return;
    }
    setError("");
    mutation.mutate({
      content: content.trim(),
      latitude: location.latitude,
      longitude: location.longitude,
      category,
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="What's happening in your area?"
          placeholderTextColor={theme.textSecondary}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={500}
          autoFocus
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: theme.textSecondary }]}>
          {content.length}/500
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Category</Text>
      <View style={styles.categories}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.categoryChip,
              {
                backgroundColor: category === cat.id ? theme.tint : theme.surface,
                borderColor: category === cat.id ? theme.tint : theme.border,
              },
            ]}
            onPress={() => setCategory(cat.id)}
          >
            <Feather
              name={cat.icon as any}
              size={14}
              color={category === cat.id ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.categoryLabel,
                { color: category === cat.id ? "#fff" : theme.text },
              ]}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.footer}>
        <View style={styles.locationInfo}>
          <Feather name="map-pin" size={14} color={theme.textSecondary} />
          <Text style={[styles.locationText, { color: theme.textSecondary }]}>
            {location ? "Location attached" : "Getting location..."}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.postButton,
            { backgroundColor: theme.tint, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handlePost}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="send" size={16} color="#fff" />
              <Text style={styles.postButtonText}>Post</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={[styles.disclaimer, { color: theme.textSecondary }]}>
        This post will be visible to nearby users and auto-delete after 24 hours.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  card: {
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 80,
  },
  charCount: { fontSize: 12, textAlign: "right" as const, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: "600" as const },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryLabel: { fontSize: 13, fontWeight: "500" as const },
  errorText: { color: "#ef4444", fontSize: 14, textAlign: "center" as const },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationInfo: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 13 },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  postButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" as const },
  disclaimer: { fontSize: 12, textAlign: "center" as const, lineHeight: 18 },
});
