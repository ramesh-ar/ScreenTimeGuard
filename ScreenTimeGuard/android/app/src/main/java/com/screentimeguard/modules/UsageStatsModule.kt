package com.screentimeguard.modules

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.*
import java.util.*

/**
 * Bridges Android's UsageStatsManager to JS.
 * Requires the user to manually grant PACKAGE_USAGE_STATS in
 * Settings > Special app access > Usage access (cannot be requested via a runtime dialog).
 */
class UsageStatsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "UsageStatsModule"

    /** Checks whether the special "usage access" permission has been granted. */
    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName
            )
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.reject("USAGE_PERMISSION_CHECK_FAILED", e)
        }
    }

    /** Deep-links the user straight to the usage access settings screen. */
    @ReactMethod
    fun openUsageAccessSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
    }

    /**
     * Returns per-package foreground usage (ms) for [startMillis, endMillis).
     * Result: [{ packageName, totalTimeInForeground, lastTimeUsed }]
     */
    @ReactMethod
    fun getUsageStats(startMillis: Double, endMillis: Double, promise: Promise) {
        try {
            val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startMillis.toLong(),
                endMillis.toLong()
            )

            // Aggregate by package — queryUsageStats can return multiple buckets per app.
            val aggregated = HashMap<String, WritableMap>()
            for (usageStat in stats) {
                if (usageStat.totalTimeInForeground <= 0) continue
                val pkg = usageStat.packageName
                val existing = aggregated[pkg]
                val existingTime = existing?.getDouble("totalTimeInForeground") ?: 0.0
                val map = Arguments.createMap()
                map.putString("packageName", pkg)
                map.putDouble(
                    "totalTimeInForeground",
                    existingTime + usageStat.totalTimeInForeground
                )
                map.putDouble("lastTimeUsed", usageStat.lastTimeUsed.toDouble())
                aggregated[pkg] = map
            }

            val result = Arguments.createArray()
            for (entry in aggregated.values) result.pushMap(entry)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("GET_USAGE_STATS_FAILED", e)
        }
    }

    /** Convenience: today's usage from local midnight until now. */
    @ReactMethod
    fun getTodayUsageStats(promise: Promise) {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        getUsageStats(cal.timeInMillis.toDouble(), System.currentTimeMillis().toDouble(), promise)
    }
}
