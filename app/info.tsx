import React from "react";
import {
  StyleSheet, Text, View, ScrollView, useColorScheme, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface InfoItemProps {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  theme: any;
}

function InfoItem({ icon, iconColor, title, description, theme }: InfoItemProps) {
  return (
    <View style={[styles.infoItem, { backgroundColor: theme.surface }]}>
      <View style={[styles.iconCircle, { backgroundColor: iconColor + "20" }]}>
        <Feather name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.infoDesc, { color: theme.textSecondary }]}>{description}</Text>
      </View>
    </View>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  theme: any;
}

function Section({ title, children, theme }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.tint }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function InfoScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: 40 + webBottomInset + insets.bottom }}
    >
      <View style={[styles.hero, { backgroundColor: theme.surface }]}>
        <View style={[styles.appIcon, { backgroundColor: theme.tint }]}>
          <Feather name="radio" size={32} color="#fff" />
        </View>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Local Buzz</Text>
        <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
          Your hyper-local community network
        </Text>
      </View>

      <Section title="Local Feed" theme={theme}>
        <InfoItem
          icon="map-pin"
          iconColor="#e94560"
          title="Location-Based Posts"
          description="All messages are tied to your location. Free users see posts within 5 miles, premium users see up to 25 miles."
          theme={theme}
        />
        <InfoItem
          icon="clock"
          iconColor="#f59e0b"
          title="24-Hour Auto-Delete"
          description="Every post automatically disappears after 24 hours, keeping the feed fresh and relevant."
          theme={theme}
        />
        <InfoItem
          icon="navigation"
          iconColor="#3b82f6"
          title="Distance Badge"
          description="Each post shows how far it was posted from your current location (in feet or miles)."
          theme={theme}
        />
      </Section>

      <Section title="Post Categories" theme={theme}>
        <InfoItem
          icon="message-circle"
          iconColor="#8b5cf6"
          title="General"
          description="Everyday updates, thoughts, and conversations with your neighbors."
          theme={theme}
        />
        <InfoItem
          icon="alert-triangle"
          iconColor="#ef4444"
          title="Alert"
          description="Important alerts like power outages, road closures, or severe weather."
          theme={theme}
        />
        <InfoItem
          icon="help-circle"
          iconColor="#06b6d4"
          title="Question"
          description="Ask your local community for recommendations, advice, or information."
          theme={theme}
        />
        <InfoItem
          icon="calendar"
          iconColor="#10b981"
          title="Event"
          description="Share local events, meetups, garage sales, or community gatherings."
          theme={theme}
        />
        <InfoItem
          icon="shield"
          iconColor="#f59e0b"
          title="Safety"
          description="Safety-related posts like suspicious activity, lost pets, or hazard warnings."
          theme={theme}
        />
      </Section>

      <Section title="Reactions" theme={theme}>
        <InfoItem
          icon="thumbs-up"
          iconColor="#3b82f6"
          title="Like"
          description="Show appreciation for a helpful or interesting post."
          theme={theme}
        />
        <InfoItem
          icon="award"
          iconColor="#f59e0b"
          title="Helpful"
          description="Mark a post as particularly useful to the community."
          theme={theme}
        />
        <InfoItem
          icon="smile"
          iconColor="#10b981"
          title="Funny"
          description="React to posts that make you laugh or smile."
          theme={theme}
        />
        <InfoItem
          icon="alert-circle"
          iconColor="#ef4444"
          title="Warning"
          description="Highlight posts that contain important warnings others should notice."
          theme={theme}
        />
        <InfoItem
          icon="flag"
          iconColor="#ef4444"
          title="Report"
          description="Flag inappropriate, spam, or harmful content for moderator review."
          theme={theme}
        />
      </Section>

      <Section title="Business Tab" theme={theme}>
        <InfoItem
          icon="briefcase"
          iconColor="#8b5cf6"
          title="Business Promotions"
          description="Local businesses can post promotions visible to nearby users. Requires an active business subscription."
          theme={theme}
        />
        <InfoItem
          icon="star"
          iconColor="#f59e0b"
          title="Business Subscription"
          description="Business owners subscribe (monthly/yearly/lifetime) to post promotions in the Business tab."
          theme={theme}
        />
      </Section>

      <Section title="Premium Features" theme={theme}>
        <InfoItem
          icon="radio"
          iconColor="#e94560"
          title="Extended Radius"
          description="Free: 5-mile radius. Premium: 25-mile radius. See and post to a larger community."
          theme={theme}
        />
        <InfoItem
          icon="zap"
          iconColor="#f59e0b"
          title="Subscription Tiers"
          description="Monthly ($2.99), Yearly ($19.99), or Lifetime ($49.99) — via Google Play In-App Purchases."
          theme={theme}
        />
      </Section>

      <Section title="Moderation & Safety" theme={theme}>
        <InfoItem
          icon="shield"
          iconColor="#10b981"
          title="Community Moderation"
          description="Trusted moderators and admins review reports and keep the community safe."
          theme={theme}
        />
        <InfoItem
          icon="eye-off"
          iconColor="#6366f1"
          title="Content Soft-Hide"
          description="Flagged content is hidden (never permanently deleted) and can be restored by the owner."
          theme={theme}
        />
        <InfoItem
          icon="file-text"
          iconColor="#8b5cf6"
          title="Audit Trail"
          description="Every moderation action is logged with who, what, when, and why — full transparency."
          theme={theme}
        />
      </Section>

      <View style={styles.creditSection}>
        <Text style={[styles.creditText, { color: theme.textSecondary }]}>
          Crafted with ❤️ by Tapas Khandual
        </Text>
        <Text style={[styles.versionText, { color: theme.textSecondary }]}>
          Local Buzz v1.0.0 — Open Source
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: { fontSize: 28, fontWeight: "800" as const },
  heroSubtitle: { fontSize: 15, textAlign: "center" as const },
  section: {
    marginBottom: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  infoItem: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 14,
    gap: 14,
    alignItems: "flex-start",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: "600" as const },
  infoDesc: { fontSize: 13, lineHeight: 19 },
  creditSection: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 6,
  },
  creditText: { fontSize: 15, fontWeight: "600" as const },
  versionText: { fontSize: 12 },
});
