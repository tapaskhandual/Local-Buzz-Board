# Local Buzz - Hyper-Local Social Networking App

## Overview
Local Buzz is an open-source hyper-local social networking app where users post messages visible only to nearby users. Messages auto-delete after 24 hours. Includes a Business Promotions tab requiring subscription and a community moderation system with strict safety guardrails.

## Architecture
- **Frontend**: Expo/React Native (Android-focused, cross-platform compatible)
- **Backend**: Express.js REST API (port 5000, deployable to Render)
- **Database**: PostgreSQL via Drizzle ORM (Neon PostgreSQL)
- **Auth**: Username/password with bcrypt hashing, JWT tokens stored in AsyncStorage
- **Ads**: Google AdMob via react-native-google-mobile-ads (native builds only, no-op on web)
- **Subscriptions**: RevenueCat via react-native-purchases (native builds only, fallback on web)

## Project Structure
```
app/                    # Expo Router screens
  (tabs)/               # Tab-based navigation
    _layout.tsx         # Tab bar configuration
    index.tsx           # Local feed tab
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
  storage.ts            # Database operations (Drizzle ORM)
  db.ts                 # Database connection
  templates/landing-page.html  # Static landing page
shared/
  schema.ts             # Drizzle schema + Zod validators
```

## Key Features
- **Location-based feed**: Messages filtered by Haversine distance (free: 5mi, premium: 25mi)
- **Auto-expiry**: Messages expire after 24 hours; hourly server cleanup job
- **Business promotions**: Separate tab requiring subscription
- **Moderation**: Role hierarchy (owner > admin > moderator > user), soft-hide only, audit trail, rate limiting
- **AdMob**: Banner ads on feed/business tabs, interstitial after posting (native builds only)
- **RevenueCat subscriptions**: Real IAP with server-side verification

## Database Tables
users, messages, businessProfiles, businessPosts, reactions, reports, moderationLogs, subscriptions

## Color Scheme
- Primary background: #1a1a2e (dark navy)
- Accent: #e94560 (coral red)
- Surface: #16213e

## Running (Development)
- `npm run server:dev` — Start backend on port 5000
- `npm run expo:dev` — Start Expo dev server on port 8081

## Deployment Architecture (Production)
- **Database**: Neon PostgreSQL — set DATABASE_URL to Neon connection string
- **Backend**: Render Web Service — uses render.yaml for config, builds with esbuild
- **Mobile App**: Google Play Store via EAS Build — uses eas.json for config

## Environment Variables
### Backend (Render)
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — Secret key for JWT token signing
- `PORT` — Server port (default: 5000)
- `ALLOWED_ORIGINS` — Comma-separated allowed CORS origins
- `NODE_ENV` — "production" for deployment
- `REVENUECAT_API_SECRET` — RevenueCat secret API key (for server-side verification)

### Frontend (Expo / EAS Build)
- `EXPO_PUBLIC_API_URL` — Full URL to the Render backend (e.g., https://local-buzz-board.onrender.com)
- `EXPO_PUBLIC_REVENUECAT_KEY` — RevenueCat public API key (goog_xxx)
- `EXPO_PUBLIC_DOMAIN` — Legacy fallback, still works for Replit dev

## Ad Unit IDs (Production)
- AdMob Android App ID: ca-app-pub-8601548769874186~1744612186
- Banner: ca-app-pub-8601548769874186/2793113749
- Interstitial: ca-app-pub-8601548769874186/6133117597
- App Open: ca-app-pub-8601548769874186/7314483118
- Native Advanced: ca-app-pub-8601548769874186/4106195413

## Notes
- AdMob requires EAS native build; renders as no-op in Expo Go / web preview
- RevenueCat requires EAS native build; falls back to mock activation on web
- Server-side subscription verification: when REVENUECAT_API_SECRET is set, the server validates purchases against RevenueCat API before activating
- Platform-specific files (.native.tsx / .web.tsx) prevent native-only modules from crashing web bundling
- render.yaml is provided for one-click Render deployment (Blueprint)
- eas.json is configured for dev, preview, and production Android builds
