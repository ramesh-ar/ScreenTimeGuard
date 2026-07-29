# ScreenTimeGuard

A React Native (Android) app that tracks per-app screen time, lets the user
set daily limits, locks an app for the rest of the day once the limit is
hit, and requires a friend's approval (via push notification) to unlock it
early.

## Architecture

```
android/                             # Full RN Android project (settings.gradle,
│                                     # build.gradle, MainActivity, manifest, etc.)
├── app/src/main/java/com/screentimeguard/
│   ├── MainApplication.kt
│   ├── MainActivity.kt
│   └── modules/
│       ├── UsageStatsModule.kt          # Reads per-app usage via UsageStatsManager
│       ├── AppLockModule.kt              # Reads/writes lock state (SharedPreferences)
│       ├── ScreenTimeGuardPackage.kt      # Registers native modules with RN
│       ├── AppBlockAccessibilityService.kt  # Watches foreground app, enforces limits
│       └── LockScreenActivity.kt         # Full-screen block UI, native (fast, no JS)
├── app/debug.keystore                 # Auto-generated debug signing key (see below)
└── app/proguard-rules.pro

App.tsx, index.js, app.json            # JS entry point + navigation
src/
├── native/ScreenTimeBridge.ts     # JS wrapper around native modules
├── services/
│   ├── appMetadataService.ts      # package name -> label/color
│   └── friendUnlockService.ts     # Firebase unlock-request flow
└── screens/
    ├── ScreenTimeChartScreen.tsx   # Pie + bar charts (react-native-gifted-charts)
    ├── AppLimitSetupScreen.tsx     # Pick apps + set daily limits
    └── FriendUnlockScreen.tsx      # Ask a friend to unlock, live status

functions/index.js                 # Firebase Cloud Function: sends FCM push
                                     # to the friend when a request is made
```

## Why it works this way

- **No public Android "block this app" API exists.** The only reliable
  approach (used by Opal, StayFree, One Sec, etc.) is an
  `AccessibilityService` that watches `TYPE_WINDOW_STATE_CHANGED` events and
  immediately launches a full-screen native Activity over the blocked app.
- **Usage data comes from `UsageStatsManager`**, gated behind the special
  "Usage access" permission — this can't be requested via a normal runtime
  dialog; the user must grant it manually in Settings, so the app deep-links
  them there (`openUsageAccessSettings()`).
- **Lock state lives in native SharedPreferences**, not AsyncStorage/JS
  state, so the always-running AccessibilityService can check "is this app
  locked?" instantly without a JS bridge round trip.
- **Friend unlock requires a backend** (Firebase here) since it's a
  cross-device approval flow: Firestore holds the request, a Cloud Function
  sends the FCM push, and the requester's device listens live for the
  approval to flip a flag the AccessibilityService respects.

## About the Gradle wrapper

This repo does **not** commit `gradlew`, `gradlew.bat`, or
`gradle-wrapper.jar` (the last one is a binary file). Instead, the CI
workflow provisions a real `gradle` binary via `gradle/actions/setup-gradle`
and runs `gradle wrapper --gradle-version 8.10.2` to generate all three
fresh on every run — see `.github/workflows/build-apk.yml`.

If you want to build **locally** (not just via CI), you'll need to do the
same once:
```bash
cd android
gradle wrapper --gradle-version 8.10.2   # requires Gradle installed locally,
                                           # or open the project in Android
                                           # Studio, which generates it for you
```

## GitHub Actions: building a release APK

`.github/workflows/build-apk.yml` builds the app on every push to `main`
and uploads the APK as a workflow artifact. Pushing a tag like `v1.0.0`
additionally creates a GitHub Release with the APK attached.

By default (no secrets configured), the workflow:
- Always runs `assembleRelease` (this is what embeds the JS bundle —
  never `assembleDebug`, which expects Metro running and shows an
  "Unable to load script" error when sideloaded standalone)
- Signs the APK with the committed `android/app/debug.keystore` (safe to
  commit — it's not a production secret, just a throwaway dev key)

To switch to a **real production signing key** before publishing anywhere:

1. Generate a keystore:
   ```bash
   keytool -genkeypair -v -storetype PKCS12 \
     -keystore release.keystore -alias screentimeguard \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. In your GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - `RELEASE_KEYSTORE_BASE64` — base64-encoded contents of `release.keystore`
   - `RELEASE_STORE_PASSWORD`
   - `RELEASE_KEY_ALIAS`
   - `RELEASE_KEY_PASSWORD`
3. Push to `main` — the workflow automatically switches to the production
   keystore once it detects the secret is set.

## Setup checklist (if adapting/extending this project)

1. Add app icons at `android/app/src/main/res/drawable/ic_launcher.xml`
   (currently a simple placeholder vector — swap for real branding).
2. Run `npm install` locally once and commit the resulting
   `package-lock.json` — then re-add `cache: 'npm'` to the workflow's
   "Set up Node.js" step for faster CI runs.
3. Add a `google-services.json` (Firebase config) at `android/app/` —
   required for `@react-native-firebase/*` to initialize. Not committed
   here since it's project-specific; get it from your Firebase console.
4. `firebase init firestore functions messaging`, deploy `functions/index.js`.
5. Add battery-optimization-exemption prompts for OEMs (Xiaomi/Huawei/etc.)
   that aggressively kill background services — otherwise the
   AccessibilityService can get killed and stop enforcing limits.
6. **Play Store note:** apps requesting Accessibility Service access get
   extra review scrutiny. Your store listing needs a clear explanation
   (and ideally a demo video) of why it's needed, or it risks rejection.

## Known gaps to fill before shipping

- `AppBlockAccessibilityService`'s 5-second ticker is a simple polling
  approach; for production, consider listening to `TYPE_WINDOW_STATE_CHANGED`
  more precisely per-session rather than ticking constantly.
- No onboarding flow for "resetDailyUsage" — wire up an `AlarmManager` alarm
  at local midnight to call it, or trigger from a WorkManager periodic job.
- Friend/contact management (adding friends, mutual consent) isn't included
  — only the unlock-request mechanics assuming a `users/{id}/friends`
  subcollection already exists.
- `FriendUnlockScreen` isn't wired into `App.tsx`'s navigation stack yet —
  it expects a `packageName` prop, typically passed when handling the
  `screentimeguard://unlock-request?package=...` deep link.
- `google-services.json` / Firebase project setup isn't included (see
  Setup checklist above).
