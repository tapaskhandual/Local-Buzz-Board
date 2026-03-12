import React from "react";
import {
  StyleSheet, Text, View, FlatList, Pressable, RefreshControl,
  useColorScheme, Platform, ActivityIndicator, Dimensions, Linking,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "@/lib/location-context";
import { authGet } from "@/lib/api";
import { AdBanner } from "@/components/AdBanner";
import Colors from "@/constants/colors";

interface BusyArea {
  id: string;
  name: string;
  lat: number;
  lng: number;
  venueCount: number;
  score: number;
  distance: number;
  routeDistance: number | null;
  routeDuration: number | null;
  direction: string;
  venueTypes: Record<string, number>;
  topVenues: string[];
  busynessLevel: "low" | "moderate" | "busy" | "very_busy";
}

const BUSYNESS_CONFIG = {
  very_busy: { color: "#ef4444", label: "Very Busy", icon: "zap" as const, bgOpacity: "30" },
  busy: { color: "#f59e0b", label: "Busy", icon: "trending-up" as const, bgOpacity: "25" },
  moderate: { color: "#3b82f6", label: "Moderate", icon: "minus" as const, bgOpacity: "20" },
  low: { color: "#10b981", label: "Quiet", icon: "moon" as const, bgOpacity: "15" },
};

const VENUE_TYPE_ICONS: Record<string, string> = {
  nightlife: "moon",
  dining: "coffee",
  cafe: "coffee",
  entertainment: "film",
  shopping: "shopping-bag",
  tourism: "camera",
  other: "map-pin",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function MiniMap({ areas, userLat, userLng, theme }: {
  areas: BusyArea[];
  userLat: number;
  userLng: number;
  theme: typeof Colors.dark;
}) {
  const mapHeight = 200;
  const padding = 30;

  if (areas.length === 0) {
    return (
      <View style={[styles.mapContainer, { backgroundColor: theme.surface, height: mapHeight }]}>
        <Text style={[styles.mapEmptyText, { color: theme.textSecondary }]}>No busy areas to display</Text>
      </View>
    );
  }

  const allLats = [userLat, ...areas.map(a => a.lat)];
  const allLngs = [userLng, ...areas.map(a => a.lng)];
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);

  const latSpan = Math.max(maxLat - minLat, 0.005);
  const lngSpan = Math.max(maxLng - minLng, 0.005);

  const mapWidth = SCREEN_WIDTH - 32;

  function toX(lng: number): number {
    return padding + ((lng - minLng) / lngSpan) * (mapWidth - padding * 2);
  }

  function toY(lat: number): number {
    return padding + ((maxLat - lat) / latSpan) * (mapHeight - padding * 2);
  }

  return (
    <View style={[styles.mapContainer, { backgroundColor: theme.surface, height: mapHeight }]}>
      <View style={[styles.mapInner, { width: mapWidth, height: mapHeight }]}>
        {areas.slice(0, 15).map((area) => {
          const config = BUSYNESS_CONFIG[area.busynessLevel];
          const size = Math.max(16, Math.min(40, area.venueCount / 2 + 12));
          const x = toX(area.lng);
          const y = toY(area.lat);

          return (
            <View
              key={area.id}
              style={[
                styles.mapDot,
                {
                  left: x - size / 2,
                  top: y - size / 2,
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: config.color + "40",
                  borderColor: config.color,
                },
              ]}
            />
          );
        })}

        <View
          style={[
            styles.userDot,
            {
              left: toX(userLng) - 8,
              top: toY(userLat) - 8,
              backgroundColor: theme.tint,
            },
          ]}
        >
          <View style={styles.userDotInner} />
        </View>
      </View>

      <View style={[styles.mapLegend, { backgroundColor: theme.background + "CC" }]}>
        <View style={[styles.legendDot, { backgroundColor: theme.tint }]} />
        <Text style={[styles.legendText, { color: theme.textSecondary }]}>You</Text>
        {(["very_busy", "busy", "moderate", "low"] as const).map((level) => (
          <React.Fragment key={level}>
            <View style={[styles.legendDot, { backgroundColor: BUSYNESS_CONFIG[level].color }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>{BUSYNESS_CONFIG[level].label}</Text>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

export default function BusyAreasScreen() {
  const { user } = useAuth();
  const { location, permissionStatus, requestPermission } = useLocation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["/api/busy-areas", location?.latitude, location?.longitude],
    queryFn: () => authGet<{ areas: BusyArea[]; radius: number }>(
      `/api/busy-areas?lat=${location!.latitude}&lng=${location!.longitude}`
    ),
    enabled: !!location,
    staleTime: 60000,
    refetchInterval: 60000,
    retry: 2,
  });

  if (!permissionStatus || permissionStatus !== "granted") {
    return (
      <View style={[styles.center, { backgroundColor: theme.background, paddingTop: insets.top + webTopInset }]}>
        <Feather name="activity" size={48} color={theme.tint} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Location Required</Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Enable location to discover busy areas near you.
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

  function getTimeContext(): string {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "Morning estimates - dining spots may be quieter";
    if (hour >= 12 && hour < 17) return "Afternoon estimates - lunch spots may be busier";
    if (hour >= 17 && hour < 21) return "Evening estimates - dining & nightlife picking up";
    return "Night estimates - nightlife spots at peak activity";
  }

  function openInMaps(lat: number, lng: number, name: string) {
    const encodedName = encodeURIComponent(name);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedName}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`,
      default: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
    });
    if (url) Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`);
    });
  }

  function formatDuration(minutes: number): string {
    if (minutes < 1) return "<1 min";
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }

  function renderBusyArea({ item, index }: { item: BusyArea; index: number }) {
    const config = BUSYNESS_CONFIG[item.busynessLevel];
    const venueTypeEntries = Object.entries(item.venueTypes).sort((a, b) => b[1] - a[1]);

    const showRoute = item.routeDistance != null;
    const displayDist = showRoute ? item.routeDistance! : item.distance;
    const distLabel = displayDist < 1
      ? `${Math.round(displayDist * 5280)}ft`
      : `${displayDist.toFixed(1)}mi`;

    return (
      <Pressable
        onPress={() => openInMaps(item.lat, item.lng, item.name)}
        style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, shadowColor: theme.cardShadow, opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.cardRow}>
          <View style={[styles.rankBadge, { backgroundColor: config.color + config.bgOpacity }]}>
            <Text style={[styles.rankText, { color: config.color }]}>#{index + 1}</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={[styles.areaName, { color: theme.text }]} numberOfLines={2}>{item.name}</Text>
              <View style={[styles.busynessBadge, { backgroundColor: config.color + "20" }]}>
                <Feather name={config.icon} size={12} color={config.color} />
                <Text style={[styles.busynessLabel, { color: config.color }]}>{config.label}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Feather name={showRoute ? "truck" : "navigation"} size={12} color={theme.textSecondary} />
                <Text style={[styles.statText, { color: theme.textSecondary }]}>{distLabel} {item.direction}</Text>
              </View>
              {item.routeDuration != null && (
                <View style={styles.stat}>
                  <Feather name="clock" size={12} color={theme.tint} />
                  <Text style={[styles.statText, { color: theme.tint }]}>{formatDuration(item.routeDuration)} drive</Text>
                </View>
              )}
              <View style={styles.stat}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} />
                <Text style={[styles.statText, { color: theme.textSecondary }]}>{item.venueCount} venues</Text>
              </View>
            </View>

            <View style={styles.venueTypesRow}>
              {venueTypeEntries.slice(0, 4).map(([type, count]) => (
                <View key={type} style={[styles.venueTypeBadge, { backgroundColor: theme.background }]}>
                  <Feather name={(VENUE_TYPE_ICONS[type] || "map-pin") as any} size={10} color={theme.textSecondary} />
                  <Text style={[styles.venueTypeText, { color: theme.textSecondary }]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                  </Text>
                </View>
              ))}
            </View>

            {item.topVenues.length > 0 && (
              <Text style={[styles.topVenuesText, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.topVenues.join(" · ")}
              </Text>
            )}

            <View style={styles.openMapRow}>
              <Feather name="external-link" size={10} color={theme.tint} />
              <Text style={[styles.openMapText, { color: theme.tint }]}>Open in Maps</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {data && (
        <View style={[styles.radiusBanner, { backgroundColor: theme.accent }]}>
          <Feather name="radio" size={14} color={theme.tint} />
          <Text style={[styles.radiusText, { color: theme.tint }]}>
            {user?.isPremium ? "Premium" : "Free"} - Showing hotspots within {data.radius} miles
          </Text>
        </View>
      )}

      <FlatList
        data={data?.areas || []}
        keyExtractor={(item) => item.id}
        renderItem={renderBusyArea}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.tint} />
        }
        ListHeaderComponent={
          <View>
            <AdBanner style={{ marginBottom: 8 }} />
            {location && data && (
              <MiniMap
                areas={data.areas}
                userLat={location.latitude}
                userLng={location.longitude}
                theme={theme}
              />
            )}
            {data && data.areas.length > 0 && (
              <View style={[styles.timeContextBanner, { backgroundColor: theme.accent }]}>
                <Feather name="clock" size={12} color={theme.textSecondary} />
                <Text style={[styles.timeContextText, { color: theme.textSecondary }]}>
                  {getTimeContext()}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.tint} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Scanning for busy areas...
              </Text>
            </View>
          ) : isError ? (
            <View style={styles.center}>
              <Feather name="wifi-off" size={48} color={theme.danger} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Unable to load hotspots</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Could not fetch busy area data. Pull down to try again.
              </Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Feather name="map" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No busy areas found</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                There aren't many venues nearby. Try expanding your search with a premium subscription!
              </Text>
            </View>
          )
        }
      />
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
  mapContainer: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  mapInner: {
    position: "relative",
  },
  mapDot: {
    position: "absolute",
    borderWidth: 2,
  },
  userDot: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  userDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  mapLegend: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 9,
    marginRight: 4,
  },
  mapEmptyText: {
    fontSize: 14,
  },
  card: {
    borderRadius: 16,
    padding: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 14,
    fontWeight: "800" as const,
  },
  cardContent: {
    flex: 1,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  areaName: {
    fontSize: 15,
    fontWeight: "600" as const,
    flex: 1,
    lineHeight: 20,
  },
  busynessBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  busynessLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
  },
  venueTypesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  venueTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  venueTypeText: {
    fontSize: 10,
  },
  topVenuesText: {
    fontSize: 11,
    fontStyle: "italic" as const,
  },
  openMapRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 4,
    marginTop: 2,
  },
  openMapText: {
    fontSize: 11,
    fontWeight: "500" as const,
  },
  timeContextBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  timeContextText: {
    fontSize: 12,
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
});
