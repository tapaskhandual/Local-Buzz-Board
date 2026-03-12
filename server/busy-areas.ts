const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const AMENITY_TYPES = [
  "restaurant", "bar", "cafe", "nightclub", "pub", "fast_food",
  "cinema", "theatre", "marketplace", "food_court", "ice_cream",
  "biergarten", "beer_garden"
];

const SHOP_TYPES = [
  "mall", "supermarket", "department_store"
];

const LEISURE_TYPES = [
  "amusement_arcade", "bowling_alley", "fitness_centre",
  "sports_centre", "stadium", "water_park"
];

const TOURISM_TYPES = [
  "attraction", "museum", "theme_park", "zoo", "aquarium"
];

interface OverpassPOI {
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface BusyAreaCluster {
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

const GRID_SIZE_DEGREES = 0.008;

function milesToMeters(miles: number): number {
  return miles * 1609.344;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getDirection(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
  const dLat = toLat - fromLat;
  const dLng = toLng - fromLng;
  const angle = Math.atan2(dLng, dLat) * 180 / Math.PI;

  if (angle >= -22.5 && angle < 22.5) return "N";
  if (angle >= 22.5 && angle < 67.5) return "NE";
  if (angle >= 67.5 && angle < 112.5) return "E";
  if (angle >= 112.5 && angle < 157.5) return "SE";
  if (angle >= 157.5 || angle < -157.5) return "S";
  if (angle >= -157.5 && angle < -112.5) return "SW";
  if (angle >= -112.5 && angle < -67.5) return "W";
  return "NW";
}

function getTimeWeight(hour: number, amenityType: string): number {
  const nightlife = ["bar", "pub", "nightclub", "biergarten", "beer_garden"];
  const dining = ["restaurant", "fast_food", "food_court", "ice_cream"];
  const entertainment = ["cinema", "theatre", "amusement_arcade", "bowling_alley"];
  const shopping = ["mall", "supermarket", "department_store", "marketplace"];

  if (nightlife.includes(amenityType)) {
    if (hour >= 20 || hour < 2) return 2.5;
    if (hour >= 17 && hour < 20) return 1.8;
    if (hour >= 14 && hour < 17) return 1.0;
    return 0.3;
  }

  if (dining.includes(amenityType)) {
    if ((hour >= 11 && hour < 14) || (hour >= 18 && hour < 21)) return 2.0;
    if ((hour >= 7 && hour < 11) || (hour >= 14 && hour < 18)) return 1.2;
    if (hour >= 21 && hour < 23) return 1.0;
    return 0.3;
  }

  if (entertainment.includes(amenityType)) {
    if (hour >= 18 && hour < 23) return 2.0;
    if (hour >= 14 && hour < 18) return 1.5;
    if (hour >= 10 && hour < 14) return 1.0;
    return 0.3;
  }

  if (shopping.includes(amenityType)) {
    if (hour >= 10 && hour < 20) return 1.5;
    if (hour >= 8 && hour < 10) return 1.0;
    return 0.3;
  }

  return 1.0;
}

function categorizeVenueType(tags: Record<string, string>): string {
  const amenity = tags.amenity || "";
  const shop = tags.shop || "";
  const leisure = tags.leisure || "";
  const tourism = tags.tourism || "";

  if (["bar", "pub", "nightclub", "biergarten", "beer_garden"].includes(amenity)) return "nightlife";
  if (["restaurant", "fast_food", "food_court"].includes(amenity)) return "dining";
  if (["cafe", "ice_cream"].includes(amenity)) return "cafe";
  if (["cinema", "theatre"].includes(amenity) || LEISURE_TYPES.includes(leisure)) return "entertainment";
  if (SHOP_TYPES.includes(shop) || amenity === "marketplace") return "shopping";
  if (TOURISM_TYPES.includes(tourism)) return "tourism";
  return "other";
}

function getBusynessLevel(score: number, maxScore: number): "low" | "moderate" | "busy" | "very_busy" {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.7) return "very_busy";
  if (ratio >= 0.4) return "busy";
  if (ratio >= 0.2) return "moderate";
  return "low";
}

async function fetchPOIs(lat: number, lng: number, radiusMiles: number): Promise<OverpassPOI[]> {
  const radiusMeters = Math.min(milesToMeters(radiusMiles), 40000);

  const amenityFilter = AMENITY_TYPES.join("|");
  const shopFilter = SHOP_TYPES.join("|");
  const leisureFilter = LEISURE_TYPES.join("|");
  const tourismFilter = TOURISM_TYPES.join("|");

  const query = `
[out:json][timeout:15];
(
  node["amenity"~"${amenityFilter}"](around:${radiusMeters},${lat},${lng});
  node["shop"~"${shopFilter}"](around:${radiusMeters},${lat},${lng});
  node["leisure"~"${leisureFilter}"](around:${radiusMeters},${lat},${lng});
  node["tourism"~"${tourismFilter}"](around:${radiusMeters},${lat},${lng});
  way["shop"="mall"](around:${radiusMeters},${lat},${lng});
);
out center body;
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  let response: globalThis.Response;
  try {
    response = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Overpass API timeout");
    }
    throw new Error(`Overpass API connection error: ${err.message}`);
  }
  clearTimeout(timeout);

  if (response.status === 429) {
    throw new Error("Overpass API rate limited");
  }
  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.elements || []).map((el: any) => ({
    lat: el.lat || el.center?.lat,
    lon: el.lon || el.center?.lon,
    tags: el.tags || {},
  })).filter((poi: OverpassPOI) => Number.isFinite(poi.lat) && Number.isFinite(poi.lon));
}

function clusterPOIs(pois: OverpassPOI[], userLat: number, userLng: number, currentHour: number): BusyAreaCluster[] {
  const grid = new Map<string, OverpassPOI[]>();

  for (const poi of pois) {
    const gridX = Math.floor(poi.lat / GRID_SIZE_DEGREES);
    const gridY = Math.floor(poi.lon / GRID_SIZE_DEGREES);
    const key = `${gridX}:${gridY}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(poi);
  }

  const clusters: BusyAreaCluster[] = [];

  for (const [key, clusterPois] of grid) {
    if (clusterPois.length < 2) continue;

    let totalLat = 0;
    let totalLon = 0;
    const venueTypes: Record<string, number> = {};
    let totalScore = 0;
    const venueNames: string[] = [];

    for (const poi of clusterPois) {
      totalLat += poi.lat;
      totalLon += poi.lon;

      const category = categorizeVenueType(poi.tags);
      venueTypes[category] = (venueTypes[category] || 0) + 1;

      const amenity = poi.tags.amenity || poi.tags.shop || poi.tags.leisure || poi.tags.tourism || "";
      totalScore += getTimeWeight(currentHour, amenity);

      if (poi.tags.name && venueNames.length < 3) {
        venueNames.push(poi.tags.name);
      }
    }

    const centerLat = totalLat / clusterPois.length;
    const centerLon = totalLon / clusterPois.length;
    const distance = haversineDistance(userLat, userLng, centerLat, centerLon);
    const direction = getDirection(userLat, userLng, centerLat, centerLon);

    const dominantType = Object.entries(venueTypes).sort((a, b) => b[1] - a[1])[0];
    const typeLabels: Record<string, string> = {
      nightlife: "Nightlife District",
      dining: "Food Hub",
      cafe: "Cafe Area",
      entertainment: "Entertainment Zone",
      shopping: "Shopping Area",
      tourism: "Tourist Spot",
      other: "Activity Zone",
    };

    const distLabel = distance < 1 ? `${Math.round(distance * 5280)}ft` : `${distance.toFixed(1)}mi`;
    const areaName = venueNames.length > 0
      ? `${typeLabels[dominantType[0]] || "Activity Zone"} near ${venueNames[0]}`
      : `${typeLabels[dominantType[0]] || "Activity Zone"} ${distLabel} ${direction}`;

    clusters.push({
      id: key,
      name: areaName,
      lat: centerLat,
      lng: centerLon,
      venueCount: clusterPois.length,
      score: totalScore,
      distance,
      routeDistance: null,
      routeDuration: null,
      direction,
      venueTypes,
      topVenues: venueNames,
      busynessLevel: "low",
    });
  }

  const maxScore = Math.max(...clusters.map(c => c.score), 1);
  for (const cluster of clusters) {
    cluster.busynessLevel = getBusynessLevel(cluster.score, maxScore);
  }

  clusters.sort((a, b) => b.score - a.score);

  return clusters;
}

const OSRM_API = "https://router.project-osrm.org";

async function fetchRouteDistances(
  userLat: number,
  userLng: number,
  clusters: BusyAreaCluster[]
): Promise<BusyAreaCluster[]> {
  if (clusters.length === 0) return clusters;

  const batchSize = 50;
  const batches: BusyAreaCluster[][] = [];
  for (let i = 0; i < clusters.length; i += batchSize) {
    batches.push(clusters.slice(i, i + batchSize));
  }

  const results: BusyAreaCluster[] = [];

  for (const batch of batches) {
    const coords = [`${userLng},${userLat}`, ...batch.map(c => `${c.lng},${c.lat}`)].join(";");
    const url = `${OSRM_API}/table/v1/driving/${coords}?sources=0&annotations=distance,duration`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        console.log("OSRM table API HTTP error:", response.status);
        batch.forEach(c => results.push(c));
        continue;
      }

      const data = await response.json();

      if (data.code !== "Ok" || !data.distances?.[0] || !data.durations?.[0]) {
        console.log("OSRM table API non-Ok response:", data.code);
        batch.forEach(c => results.push(c));
        continue;
      }
      console.log(`OSRM: got route distances for ${batch.length} clusters`);

      const distances = data.distances[0];
      const durations = data.durations[0];

      batch.forEach((cluster, i) => {
        const routeDistMeters = distances[i + 1];
        const routeDurSeconds = durations[i + 1];

        results.push({
          ...cluster,
          routeDistance: routeDistMeters != null ? routeDistMeters / 1609.344 : null,
          routeDuration: routeDurSeconds != null ? Math.round(routeDurSeconds / 60) : null,
        });
      });
    } catch (err: any) {
      console.log("OSRM fetch error:", err.name === "AbortError" ? "timeout" : err.message);
      batch.forEach(c => results.push(c));
    } finally {
      clearTimeout(timeout);
    }
  }

  return results;
}

const cache = new Map<string, { data: BusyAreaCluster[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(lat: number, lng: number, radius: number): string {
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  return `${roundedLat}:${roundedLng}:${radius}`;
}

export async function getBusyAreas(lat: number, lng: number, radiusMiles: number): Promise<BusyAreaCluster[]> {
  const cacheKey = getCacheKey(lat, lng, radiusMiles);
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    const currentHour = new Date().getHours();
    const reclustered = cached.data.map(cluster => {
      let totalScore = 0;
      for (const [type, count] of Object.entries(cluster.venueTypes)) {
        const amenityMap: Record<string, string> = {
          nightlife: "bar",
          dining: "restaurant",
          cafe: "cafe",
          entertainment: "cinema",
          shopping: "mall",
          tourism: "attraction",
        };
        totalScore += getTimeWeight(currentHour, amenityMap[type] || "") * count;
      }
      return { ...cluster, score: totalScore, busynessLevel: "low" as const };
    });

    const maxScore = Math.max(...reclustered.map(c => c.score), 1);
    const withLevels = reclustered.map(cluster => ({
      ...cluster,
      busynessLevel: getBusynessLevel(cluster.score, maxScore),
    }));
    withLevels.sort((a, b) => b.score - a.score);
    return withLevels;
  }

  const currentHour = new Date().getHours();
  const fetchRadius = Math.ceil(radiusMiles * 1.4);
  const pois = await fetchPOIs(lat, lng, fetchRadius);
  const allClusters = clusterPOIs(pois, lat, lng, currentHour);

  const preFiltered = allClusters.filter(c => c.distance <= fetchRadius);
  const capped = preFiltered.slice(0, 50);

  const clustersWithRoutes = await fetchRouteDistances(lat, lng, capped);

  const withinRadius = clustersWithRoutes.filter(c => {
    if (c.routeDistance != null) {
      return c.routeDistance <= radiusMiles;
    }
    return c.distance <= radiusMiles * 0.7;
  });
  const finalCapped = withinRadius.slice(0, 30);

  cache.set(cacheKey, { data: finalCapped, timestamp: Date.now() });

  if (cache.size > 100) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  return finalCapped;
}
