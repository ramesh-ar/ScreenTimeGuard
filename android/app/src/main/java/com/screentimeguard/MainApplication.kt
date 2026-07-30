package com.screentimeguard

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.screentimeguard.modules.ScreenTimeGuardPackage

/**
 * EXAMPLE ONLY — merge the highlighted bits into the MainApplication.kt
 * that `npx react-native init` already generated for you. The important
 * line is inside getPackages(): add(ScreenTimeGuardPackage()).
 */
class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // <-- add our native module package here
              add(ScreenTimeGuardPackage())
            }

        override fun getJSMainModuleName(): String = "index"
        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = true
      }

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      load()
    }
  }
}
