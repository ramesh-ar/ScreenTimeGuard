package com.screentimeguard.modules

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject

/**
 * Runs continuously in the background (once the user grants the Accessibility
 * permission). Every time the foreground app changes, we check whether that
 * package is locked. If it is, we immediately launch LockScreenActivity on
 * top of it so the user never gets meaningful interaction time with the
 * blocked app before being redirected.
 *
 * This is the same mechanism apps like Opal / StayFree / One Sec use, since
 * there is no public "block this app" API on Android — interception is the
 * only reliable approach without a device-owner/MDM profile.
 */
class AppBlockAccessibilityService : AccessibilityService() {

    private var lastCheckedPackage: String? = null
    private val usageTicker = Handler(Looper.getMainLooper())
    private var currentForegroundPackage: String? = null
    private var lastTickTime = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()
        lastTickTime = System.currentTimeMillis()
        startUsageTicker()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val pkg = event?.packageName?.toString() ?: return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        if (pkg == packageName) return // ignore our own app/lock screen
        if (pkg == lastCheckedPackage) return
        lastCheckedPackage = pkg
        currentForegroundPackage = pkg

        checkAndMaybeBlock(pkg)
    }

    private fun checkAndMaybeBlock(pkg: String) {
        val prefs = getSharedPreferences(AppLockModule.PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONObject(prefs.getString(AppLockModule.KEY_LOCKED_PACKAGES, "{}") ?: "{}")
        if (!json.has(pkg)) return

        val entry = json.getJSONObject(pkg)
        val lockedUntilEndOfDay = entry.optBoolean("lockedUntilEndOfDay", false)
        val dailyLimitMs = entry.optDouble("dailyLimitMs", -1.0)
        val usedMs = entry.optDouble("usedMs", 0.0)

        val shouldBlock = lockedUntilEndOfDay || (dailyLimitMs >= 0 && usedMs >= dailyLimitMs)

        if (shouldBlock) {
            if (!lockedUntilEndOfDay) {
                entry.put("lockedUntilEndOfDay", true)
                json.put(pkg, entry)
                prefs.edit().putString(AppLockModule.KEY_LOCKED_PACKAGES, json.toString()).apply()
            }
            launchLockScreen(pkg)
        }
    }

    private fun launchLockScreen(blockedPackage: String) {
        val intent = Intent(this, LockScreenActivity::class.java)
        intent.putExtra("blockedPackage", blockedPackage)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        startActivity(intent)
    }

    /**
     * Every 5s, add elapsed time to the currently foregrounded tracked app's
     * usedMs counter. This is coarser than UsageStatsManager but lets us
     * block mid-session the moment the limit is crossed, rather than only
     * on the next app switch.
     */
    private fun startUsageTicker() {
        usageTicker.postDelayed(object : Runnable {
            override fun run() {
                val now = System.currentTimeMillis()
                val elapsed = now - lastTickTime
                lastTickTime = now

                val pkg = currentForegroundPackage
                if (pkg != null && pkg != packageName) {
                    val prefs = getSharedPreferences(AppLockModule.PREFS_NAME, Context.MODE_PRIVATE)
                    val json = JSONObject(prefs.getString(AppLockModule.KEY_LOCKED_PACKAGES, "{}") ?: "{}")
                    if (json.has(pkg)) {
                        val entry = json.getJSONObject(pkg)
                        val usedMs = entry.optDouble("usedMs", 0.0) + elapsed
                        entry.put("usedMs", usedMs)
                        json.put(pkg, entry)
                        prefs.edit().putString(AppLockModule.KEY_LOCKED_PACKAGES, json.toString()).apply()
                        checkAndMaybeBlock(pkg)
                    }
                }
                usageTicker.postDelayed(this, 5000)
            }
        }, 5000)
    }

    override fun onInterrupt() {}
}
