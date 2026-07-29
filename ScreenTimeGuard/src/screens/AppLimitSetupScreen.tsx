import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TextInput, Alert } from 'react-native';
import { ScreenTime, UsageEntry, LockEntry } from '../native/ScreenTimeBridge';
import { getAppLabel, getAppIconColor } from '../services/appMetadataService';

interface AppRow {
  packageName: string;
  label: string;
  color: string;
  limitMinutes: string;
  enabled: boolean;
}

export default function AppLimitSetupScreen() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [permissionsOk, setPermissionsOk] = useState(false);

  useEffect(() => {
    checkPermissions();
    loadApps();
  }, []);

  const checkPermissions = async () => {
    const usage = await ScreenTime.hasUsagePermission();
    const accessibility = await ScreenTime.isAccessibilityServiceEnabled();
    setPermissionsOk(usage && accessibility);
  };

  const loadApps = async () => {
    const usage: UsageEntry[] = await ScreenTime.getTodayUsageStats();
    const locked: Record<string, LockEntry> = await ScreenTime.getLockedPackages();

    const merged: AppRow[] = usage
      .filter((u) => u.totalTimeInForeground > 60000)
      .map((u) => {
        const lock = locked[u.packageName];
        return {
          packageName: u.packageName,
          label: getAppLabel(u.packageName),
          color: getAppIconColor(u.packageName),
          limitMinutes: lock ? String(Math.round(lock.dailyLimitMs / 60000)) : '60',
          enabled: !!lock,
        };
      });

    setRows(merged);
  };

  const toggleApp = async (row: AppRow, enabled: boolean) => {
    if (enabled) {
      const minutes = parseInt(row.limitMinutes, 10) || 60;
      await ScreenTime.setAppLimit(row.packageName, minutes * 60000);
    } else {
      await ScreenTime.removeAppLimit(row.packageName);
    }
    setRows((prev) =>
      prev.map((r) => (r.packageName === row.packageName ? { ...r, enabled } : r))
    );
  };

  const updateLimit = (row: AppRow, minutes: string) => {
    setRows((prev) =>
      prev.map((r) => (r.packageName === row.packageName ? { ...r, limitMinutes: minutes } : r))
    );
  };

  const commitLimit = async (row: AppRow) => {
    if (!row.enabled) return;
    const minutes = parseInt(row.limitMinutes, 10);
    if (!minutes || minutes <= 0) {
      Alert.alert('Enter a valid number of minutes.');
      return;
    }
    await ScreenTime.setAppLimit(row.packageName, minutes * 60000);
  };

  if (!permissionsOk) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Two permissions needed</Text>
        <Text style={styles.permissionBody}>
          To track usage and lock apps, grant Usage Access and Accessibility permissions.
        </Text>
        <Text style={styles.permissionLink} onPress={() => ScreenTime.openUsageAccessSettings()}>
          → Open Usage Access Settings
        </Text>
        <Text
          style={styles.permissionLink}
          onPress={() => ScreenTime.openAccessibilitySettings()}
        >
          → Open Accessibility Settings
        </Text>
        <Text style={styles.permissionLink} onPress={checkPermissions}>
          ↻ I've granted both, check again
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={rows}
      keyExtractor={(item) => item.packageName}
      ListHeaderComponent={<Text style={styles.header}>Set daily limits</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.appName}>{item.label}</Text>
          <TextInput
            style={styles.minutesInput}
            value={item.limitMinutes}
            onChangeText={(v) => updateLimit(item, v)}
            onEndEditing={() => commitLimit(item)}
            keyboardType="number-pad"
            editable={item.enabled}
          />
          <Text style={styles.minutesLabel}>min</Text>
          <Switch value={item.enabled} onValueChange={(v) => toggleApp(item, v)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14', padding: 16 },
  header: { fontSize: 24, fontWeight: '700', color: '#fff', marginVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#26262F',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  appName: { color: '#fff', fontSize: 15, flex: 1 },
  minutesInput: {
    color: '#fff',
    borderColor: '#33333D',
    borderWidth: 1,
    borderRadius: 8,
    width: 56,
    textAlign: 'center',
    marginRight: 6,
    paddingVertical: 4,
  },
  minutesLabel: { color: '#9A9AA5', marginRight: 14 },
  permissionContainer: { flex: 1, backgroundColor: '#0F0F14', padding: 24, justifyContent: 'center' },
  permissionTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  permissionBody: { color: '#9A9AA5', fontSize: 15, marginBottom: 24, lineHeight: 22 },
  permissionLink: { color: '#4ECDC4', fontSize: 16, marginBottom: 16, fontWeight: '600' },
});
