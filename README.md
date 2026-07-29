# ScreenTimeGuard

A React Native (Android) app that tracks per-app screen time, lets the user
set daily limits, locks an app for the rest of the day once the limit is
hit, and requires a friend's approval (via push notification) to unlock it
early.

## Architecture

```
android/app/src/main/java/com/screentimeguard/modules/
├── UsageStatsModule.kt          # Reads per-app usage via UsageStatsManager
├── AppLockModule.kt              # Reads/writes lock state (SharedPreferences)
├── ScreenTimeGuardPackage.kt      # Registers native modules with RN
├── AppBlockAccessibilityService.kt  # Watches foreground app, enforces limits
└── LockScreenActivity.kt         # Full-screen block UI, native (fast, no JS)

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

## Setup checklist

1. `npx react-native init` scaffold already assumed — drop these folders in.
2. Merge `AndroidManifest_SNIPPET.xml` into your real `AndroidManifest.xml`.
3. Register `ScreenTimeGuardPackage` in `MainApplication.kt`'s
   `getPackages()` list.
4. Add a `strings.xml` entry for `accessibility_service_description`.
5. `firebase init firestore functions messaging`, deploy `functions/index.js`.
6. Add battery-optimization-exemption prompts for OEMs (Xiaomi/Huawei/etc.)
   that aggressively kill background services — otherwise the
   AccessibilityService can get killed and stop enforcing limits.
7. **Play Store note:** apps requesting Accessibility Service access get
   extra review scrutiny. Your store listing needs a clear explanation
   (and ideally a demo video) of why it's needed, or it risks rejection.

## GitHub Actions: building a release APK

`.github/workflows/build-apk.yml` builds the app on every push to `main`
and uploads the APK as a workflow artifact. Pushing a tag like `v1.0.0`
additionally creates a GitHub Release with the APK attached.

To get **signed** release builds (recommended before sharing the APK):

1. Merge `android/app/build.gradle.signing-snippet` into your real
   `android/app/build.gradle` (see comments inside for the exact keytool
   command to generate a keystore).
2. In your GitHub repo: **Settings → Secrets and variables → Actions**, add:
   - `RELEASE_KEYSTORE_BASE64` — base64-encoded contents of your `.keystore` file
   - `RELEASE_STORE_PASSWORD`
   - `RELEASE_KEY_ALIAS`
   - `RELEASE_KEY_PASSWORD`
3. Push to `main` — check the **Actions** tab for the `screentimeguard-apk`
   artifact, or push a `v*` tag to get it attached to a Release instead.

If you skip the signing secrets, the workflow still runs `assembleRelease`
(always — this is what embeds the JS bundle) but signs it with Android's
auto-generated debug key instead of a production one. That APK is fully
installable and self-contained for testing; you just can't publish it to
the Play Store until you swap in a real keystore.

> **Why this matters:** an earlier version of this workflow fell back to
> `assembleDebug` when no keystore was configured. Debug-*type* builds don't
> bundle the JS into the APK — they expect a Metro dev server running on
> your machine — so installing one standalone gives a red "Unable to load
> script" screen. Always build the `release` type; only the *signing key*
> should change based on whether you've set up a production keystore.

## Known gaps to fill before shipping


- `AppBlockAccessibilityService`'s 5-second ticker is a simple polling
  approach; for production, consider listening to `TYPE_WINDOW_STATE_CHANGED`
  more precisely per-session rather than ticking constantly.
- No onboarding flow for "resetDailyUsage" — wire up an `AlarmManager` alarm
  at local midnight to call it, or trigger from a WorkManager periodic job.
- Friend/contact management (adding friends, mutual consent) isn't included
  — only the unlock-request mechanics assuming a `users/{id}/friends`
  subcollection already exists.
