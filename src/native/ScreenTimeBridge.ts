import { NativeModules } from 'react-native';

const { UsageStatsModule, AppLockModule } = NativeModules;

export interface UsageEntry {
  packageName: string;
  totalTimeInForeground: number; // ms
  lastTimeUsed: number; // epoch ms
}

export interface LockEntry {
  dailyLimitMs: number;
  usedMs: number;
  lockedUntilEndOfDay: boolean;
  unlockApprovedAt: number;
}

export const ScreenTime = {
  // --- Permissions -----------------------------------------------------
  hasUsagePermission: (): Promise<boolean> => UsageStatsModule.hasUsagePermission(),
  openUsageAccessSettings: (): void => UsageStatsModule.openUsageAccessSettings(),

  isAccessibilityServiceEnabled: (): Promise<boolean> =>
    AppLockModule.isAccessibilityServiceEnabled(),
  openAccessibilitySettings: (): void => AppLockModule.openAccessibilitySettings(),
  openOverlayPermissionSettings: (): void => AppLockModule.openOverlayPermissionSettings(),

  // --- Usage stats -------------------------------------------------------
  getTodayUsageStats: (): Promise<UsageEntry[]> => UsageStatsModule.getTodayUsageStats(),
  getUsageStats: (startMs: number, endMs: number): Promise<UsageEntry[]> =>
    UsageStatsModule.getUsageStats(startMs, endMs),

  // --- App locking ---------------------------------------------------
  setAppLimit: (packageName: string, dailyLimitMs: number): Promise<boolean> =>
    AppLockModule.setAppLimit(packageName, dailyLimitMs),
  removeAppLimit: (packageName: string): Promise<boolean> =>
    AppLockModule.removeAppLimit(packageName),
  getLockedPackages: async (): Promise<Record<string, LockEntry>> => {
    const raw: string = await AppLockModule.getLockedPackages();
    return JSON.parse(raw);
  },
  grantTemporaryUnlock: (packageName: string): Promise<boolean> =>
    AppLockModule.grantTemporaryUnlock(packageName),
  resetDailyUsage: (): Promise<boolean> => AppLockModule.resetDailyUsage(),
};
