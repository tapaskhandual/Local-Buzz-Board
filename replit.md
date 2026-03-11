# Local Buzz - Hyper-Local Social Networking App

## Overview
Local Buzz is an open-source hyper-local social networking app where users post messages visible only to nearby users. Messages auto-delete after 24 hours. Includes a Business Promotions tab requiring subscription and a community moderation system with strict safety guardrails.

## Architecture
- **Frontend**: Expo/React Native (Android-focused, cross-platform compatible)
- **Backend**: Express.js REST API (port 5000, serves landing page + API)
- **Database**: PostgreSQL via Drizzle ORM (Replit managed PostgreSQL)
- **Auth**: Username/password with bcrypt hashing, JWT tokens stored in AsyncStorage
- **Ads**: Google AdMob via react-native-google-mobile-ads (native builds only, no-op on web)
- **Subscriptions**: RevenueCat via react-native-purchases (native builds only, fallback on web)

## Project Structure
```
app/                    # Expo Router screens
  (tabs)/               # Tab-based navigation
    _layout.tsx         # Tab bar configuration
    index.tsx           # Local feed tab
    busy.tsx            # Busy Areas/Hotspots tab (Overpass API POI density)
    business.tsx        # Business promotions tab (RevenueCat purchase)
    settings.tsx        # Profile & settings tab (RevenueCat purchase)
  _layout.tsx           # Root layout with providers (AdMob init, PurchasesProvider)
  auth.tsx              # Login/register screen
  compose.tsx           # New message composer
  moderation.tsx        # Moderation panel (moderator+)
components/
  AdBanner.native.tsx   # AdMob banner (native only)
  AdBanner.web.tsx      # No-op for web
  AdInterstitial.native.ts  # AdMob interstitial (native only)
  AdInterstitial.web.ts     # No-op for web
  ErrorBoundary.tsx     # Error boundary wrapper
constants/
  ads.ts                # Ad unit IDs and helpers
  colors.ts             # Theme colors (dark navy + coral red)
lib/
  admob-init.ts         # AdMob SDK initialization
  api.ts                # Authenticated API helpers
  auth-context.tsx      # Auth state provider
  location-context.tsx  # Location permissions + GPS
  purchases-context.tsx # RevenueCat provider for in-app purchases
  query-client.ts       # React Query client config
server/
  index.ts              # Express server entry
  routes.ts             # All API routes (includes /api/health, RevenueCat verification)
  busy-areas.ts         # Overpass API integration for busy areas/hotspots
  storage.ts            # Database operations (Drizzle ORM)
  db.ts                 # Database connection
  templates/landing-page.html  # Static landing page
shared/
  schema.ts             # Drizzle schema + Zod validators
scripts/
  build.js              # Expo static build script (for production/Expo Go QR)
```

## Key Features
- **Location-based feed**: Messages filtered by Haversine distance (free: 5mi, premium: 25mi)
- **Auto-expiry**: Messages expire after 24 hours; hourly server cleanup job
- **Replies**: Users can reply to posts; replies auto-delete with parent (24hr). Reply count shown on cards; expandable inline thread view.
- **Reaction tracking**: Users see their own reaction highlighted (tinted) on each post; reactions toggle between types.
- **Business promotions**: Separate tab requiring subscription
- **Moderation**: Role hierarchy (owner > admin > moderator > user), soft-hide only, audit trail, rate limiting
- **Busy Areas/Hotspots**: Real-time city hotspot detection using OpenStreetMap POI density (Overpass API, free, no key) with time-of-day busyness scoring. Map view + ranked list. Free: 5mi, Premium: 25mi. Tapping a hotspot opens device maps app. Time-of-day context banner explains scoring. Real driving distances and estimated drive times via OSRM (free, no key).
- **AdMob**: Banner ads on feed/business tabs, interstitial after posting (native builds only)
- **RevenueCat subscriptions**: Real IAP with server-side verification; graceful fallback messaging in Expo Go
- **Password visibility toggle**: Show/hide password on login/signup screen

## Database Tables
users, messages (parentId for replies, replyCount), businessProfiles, businessPosts, reactions, reports, moderationLogs, subscriptions

## Color Scheme
- Primary background: #1a1a2e (dark navy)
- Accent: #e94560 (coral red)
- Surface: #16213e

## Running on Replit
- **Start Backend** workflow: `npm run server:dev` — starts backend on port 5000 (webview)
- **Start Frontend** workflow: `npm run expo:dev` — starts Expo dev server (console, for Expo Go)
- The backend serves the landing page with QR code at the root URL

## Deployment Architecture (Production — Render)
- **Database**: Neon PostgreSQL (ap-southeast-1 region)
- **Backend**: Render Web Service — uses render.yaml, builds with esbuild, runs `npm run server:prod`
- **Env vars on Render**: DATABASE_URL (Neon connection string), JWT_SECRET, NODE_ENV=production, PORT=5000
- **Mobile App**: Google Play Store via EAS Build — uses eas.json for config

## Environment Variables
### Secrets (already configured)
- `DATABASE_URL` — Replit managed PostgreSQL connection string
- `SESSION_SECRET` — Used as JWT signing secret (server reads JWT_SECRET || SESSION_SECRET)
- `REPLIT_DEV_DOMAIN` — Set by Replit automatically
- `REPLIT_DOMAINS` — Set by Replit automatically

### Env Vars (shared)
- `EXPO_PUBLIC_REVENUECAT_KEY` — RevenueCat public API key
- `REVENUECAT_API_SECRET` — RevenueCat secret API key

## Ad Unit IDs (Production)
- AdMob Android App ID: ca-app-pub-8601548769874186~1744612186
- Banner: ca-app-pub-8601548769874186/2793113749
- Interstitial: ca-app-pub-8601548769874186/6133117597
- App Open: ca-app-pub-8601548769874186/7314483118
- Native Advanced: ca-app-pub-8601548769874186/4106195413

## Keyboard Handling
All screens with text inputs use `KeyboardAvoidingView` (behavior="padding") + `ScrollView` to prevent the keyboard from covering inputs:
- `app/auth.tsx`: Full-screen login/signup form
- `app/compose.tsx`: New post composer
- `app/(tabs)/business.tsx`: Register Business and New Promotion modals
- `app/(tabs)/index.tsx`: Reply modal
- Android: `softwareKeyboardLayoutMode: "pan"` set in app.json for better modal keyboard handling

## Notes
- AdMob requires EAS native build; renders as no-op in Expo Go / web preview
- RevenueCat requires EAS native build; falls back to mock activation on web
- Server-side subscription verification: when REVENUECAT_API_SECRET is set, the server validates purchases against RevenueCat API before activating
- Platform-specific files (.native.tsx / .web.tsx) prevent native-only modules from crashing web bundling
- eas.json is configured for dev, preview, and production Android builds
- JWT auth uses SESSION_SECRET as fallback (no need to set separate JWT_SECRET)
