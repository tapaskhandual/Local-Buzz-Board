# Local Buzz - Hyper-Local Social Networking App

## Overview
Local Buzz is an open-source hyper-local social networking app where users post messages visible only to nearby users. Messages auto-delete after 24 hours. Includes a Business Promotions tab requiring subscription and a community moderation system with strict safety guardrails.

## Architecture
- **Frontend**: Expo/React Native (Android-focused, cross-platform compatible)
- **Backend**: Express.js REST API (port 5000, deployable to Render)
- **Database**: PostgreSQL via Drizzle ORM (Supabase-ready)
- **Auth**: Username/password with bcrypt hashing, JWT tokens stored in AsyncStorage
- **Ads**: Google AdMob via react-native-google-mobile-ads (native builds only, no-op on web)

## Project Structure
```
app/                    # Expo Router screens
  (tabs)/               # Tab-based navigation
    _layout.tsx         # Tab bar configuration
    index.tsx           # Local feed tab
    business.tsx        # Business promotions tab
    settings.tsx        # Profile & settings tab
  _layout.tsx           # Root layout with providers
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
  api.ts                # Authenticated API helpers
  auth-context.tsx      # Auth state provider
  location-context.tsx  # Location permissions + GPS
  query-client.ts       # React Query client config
server/
  index.ts              # Express server entry
  routes.ts             # All API routes
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

## Database Tables
users, messages, businessProfiles, businessPosts, reactions, reports, moderationLogs, subscriptions

## Color Scheme
- Primary background: #1a1a2e (dark navy)
- Accent: #e94560 (coral red)
- Surface: #16213e

## Running
- `npm run server:dev` — Start backend on port 5000
- `npm run expo:dev` — Start Expo dev server on port 8081

## Ad Unit IDs (Production)
- Banner: ca-app-pub-8601548769874186/4837679381
- Interstitial: ca-app-pub-8601548769874186/7531650124
- App Open: ca-app-pub-8601548769874186/7858953180
- Native Advanced: ca-app-pub-8601548769874186/8844731796

## Deployment Target
- Database: Supabase (PostgreSQL)
- Backend: Render (VPS)
- App: Google Play Store (EAS Build)

## Notes
- AdMob requires EAS native build; renders as no-op in Expo Go / web preview
- Subscriptions are currently mocked via API; real RevenueCat/Google Play IAP to be added for production
- The `react-native-google-mobile-ads` plugin in app.json only runs during native builds
- Platform-specific files (.native.tsx / .web.tsx) prevent native-only modules from crashing web bundling
