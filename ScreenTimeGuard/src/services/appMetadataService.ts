/**
 * Maps package names to display labels and a stable color so the same app
 * always renders the same chart color across sessions. Extend
 * KNOWN_APP_LABELS as needed, or replace with a native call to
 * PackageManager.getApplicationLabel for a fully generic solution
 * (see UsageStatsModule — could add a getAppLabel native method there).
 */

const KNOWN_APP_LABELS: Record<string, string> = {
  'com.instagram.android': 'Instagram',
  'com.zhiliaoapp.musically': 'TikTok',
  'com.google.android.youtube': 'YouTube',
  'com.whatsapp': 'WhatsApp',
  'com.twitter.android': 'X',
  'com.facebook.katana': 'Facebook',
  'com.snapchat.android': 'Snapchat',
  'com.reddit.frontpage': 'Reddit',
};

const PALETTE = [
  '#FF6B6B', '#4ECDC4', '#FFD93D', '#6C5CE7',
  '#00B894', '#E17055', '#0984E3', '#FD79A8',
  '#A29BFE', '#00CEC9',
];

export function getAppLabel(packageName: string): string {
  return KNOWN_APP_LABELS[packageName] ?? packageName.split('.').pop() ?? packageName;
}

/** Deterministic color per package so charts stay visually consistent across renders. */
export function getAppIconColor(packageName: string): string {
  let hash = 0;
  for (let i = 0; i < packageName.length; i++) {
    hash = (hash << 5) - hash + packageName.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
