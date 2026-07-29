package com.screentimeguard.modules

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

/**
 * Full-screen activity shown on top of a blocked app. Deliberately native
 * (not a JS/RN screen) so it launches instantly with no JS-bridge warmup —
 * that matters because the AccessibilityService must intercept the blocked
 * app before the user gets any real interaction with it.
 *
 * "Ask a friend to unlock" hands off to the main RN app (deep link) where
 * the actual Firebase request flow lives — see FriendUnlockScreen.tsx.
 */
class LockScreenActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val blockedPackage = intent.getStringExtra("blockedPackage") ?: ""

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF121212.toInt())
            setPadding(48, 200, 48, 48)
        }

        val title = TextView(this).apply {
            text = "Time's up for today"
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 24f
        }

        val appLabel = readableAppName(blockedPackage)
        val subtitle = TextView(this).apply {
            text = "$appLabel is locked until midnight. Ask a friend to unlock it early if you really need it."
            setTextColor(0xFFAAAAAA.toInt())
            textSize = 16f
            setPadding(0, 24, 0, 48)
        }

        val askFriendButton = Button(this).apply {
            text = "Ask a friend to unlock"
            setOnClickListener {
                val deepLink = Intent(Intent.ACTION_VIEW)
                deepLink.data = android.net.Uri.parse(
                    "screentimeguard://unlock-request?package=$blockedPackage"
                )
                deepLink.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(deepLink)
            }
        }

        val closeButton = Button(this).apply {
            text = "Go back home"
            setOnClickListener {
                val homeIntent = Intent(Intent.ACTION_MAIN)
                homeIntent.addCategory(Intent.CATEGORY_HOME)
                homeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(homeIntent)
                finish()
            }
        }

        root.addView(title)
        root.addView(subtitle)
        root.addView(askFriendButton)
        root.addView(closeButton)
        setContentView(root)
    }

    private fun readableAppName(pkg: String): String {
        return try {
            val pm = packageManager
            val info = pm.getApplicationInfo(pkg, 0)
            pm.getApplicationLabel(info).toString()
        } catch (e: Exception) {
            pkg
        }
    }

    /**
     * Poll-free approach: re-check lock state whenever this activity resumes
     * (e.g. user backgrounds the app to approve on another device, then
     * returns). If unlocked, finish immediately so the underlying app is
     * usable again.
     */
    override fun onResume() {
        super.onResume()
        val blockedPackage = intent.getStringExtra("blockedPackage") ?: return
        val prefs = getSharedPreferences(AppLockModule.PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONObject(prefs.getString(AppLockModule.KEY_LOCKED_PACKAGES, "{}") ?: "{}")
        if (json.has(blockedPackage)) {
            val entry = json.getJSONObject(blockedPackage)
            if (!entry.optBoolean("lockedUntilEndOfDay", false)) {
                finish()
            }
        }
    }

    // Disable back button so the user can't dismiss straight into the blocked app.
    override fun onBackPressed() {
        // no-op
    }
}
