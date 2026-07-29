package com.screentimeguard.modules

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.*
import org.json.JSONObject

/**
 * Stores lock state in a SharedPreferences file that both the JS side
 * and the always-running AccessibilityService can read/write.
 * Keeping this in native SharedPreferences (not AsyncStorage) means the
 * AccessibilityService can check it instantly with no JS bridge round-trip,
 * which matters because it has to react the instant a blocked app opens.
 */
class AppLockModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AppLockModule"

    companion object {
        const val PREFS_NAME = "screentime_guard_prefs"
        const val KEY_LOCKED_PACKAGES = "locked_packages_json"
        // locked_packages_json shape:
        // { "com.instagram.android": { "dailyLimitMs": 3600000, "usedMs": 0, "lockedUntilEndOfDay": false, "unlockApprovedAt": 0 } }
    }

    private fun prefs() = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    @ReactMethod
    fun setAppLimit(packageName: String, dailyLimitMs: Double, promise: Promise) {
        try {
            val json = JSONObject(prefs().getString(KEY_LOCKED_PACKAGES, "{}") ?: "{}")
            val entry = if (json.has(packageName)) json.getJSONObject(packageName) else JSONObject()
            entry.put("dailyLimitMs", dailyLimitMs)
            if (!entry.has("usedMs")) entry.put("usedMs", 0)
            entry.put("lockedUntilEndOfDay", false)
            entry.put("unlockApprovedAt", 0)
            json.put(packageName, entry)
            prefs().edit().putString(KEY_LOCKED_PACKAGES, json.toString()).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_APP_LIMIT_FAILED", e)
        }
    }

    @ReactMethod
    fun removeAppLimit(packageName: String, promise: Promise) {
        try {
            val json = JSONObject(prefs().getString(KEY_LOCKED_PACKAGES, "{}") ?: "{}")
            json.remove(packageName)
            prefs().edit().putString(KEY_LOCKED_PACKAGES, json.toString()).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("REMOVE_APP_LIMIT_FAILED", e)
        }
    }

    @ReactMethod
    fun getLockedPackages(promise: Promise) {
        promise.resolve(prefs().getString(KEY_LOCKED_PACKAGES, "{}"))
    }

    /**
     * Called after a friend approves an unlock request (via FCM handler / JS).
     * Gives the user a fresh window of access for the rest of the day.
     */
    @ReactMethod
    fun grantTemporaryUnlock(packageName: String, promise: Promise) {
        try {
            val json = JSONObject(prefs().getString(KEY_LOCKED_PACKAGES, "{}") ?: "{}")
            if (json.has(packageName)) {
                val entry = json.getJSONObject(packageName)
                entry.put("lockedUntilEndOfDay", false)
                entry.put("unlockApprovedAt", System.currentTimeMillis())
                json.put(packageName, entry)
                prefs().edit().putString(KEY_LOCKED_PACKAGES, json.toString()).apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("GRANT_UNLOCK_FAILED", e)
        }
    }

    /** Resets usedMs / lockedUntilEndOfDay for all apps — call this from a daily midnight alarm. */
    @ReactMethod
    fun resetDailyUsage(promise: Promise) {
        try {
            val json = JSONObject(prefs().getString(KEY_LOCKED_PACKAGES, "{}") ?: "{}")
            val keys = json.keys()
            while (keys.hasNext()) {
                val entry = json.getJSONObject(keys.next())
                entry.put("usedMs", 0)
                entry.put("lockedUntilEndOfDay", false)
            }
            prefs().edit().putString(KEY_LOCKED_PACKAGES, json.toString()).apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("RESET_FAILED", e)
        }
    }

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        val expectedComponent = reactContext.packageName + "/" +
            reactContext.packageName + ".modules.AppBlockAccessibilityService"
        val enabledServices = Settings.Secure.getString(
            reactContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        promise.resolve(enabledServices.contains(expectedComponent))
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun openOverlayPermissionSettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + reactContext.packageName)
        )
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }
}
