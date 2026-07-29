import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { ScreenTime, UsageEntry } from '../native/ScreenTimeBridge';
import { getAppLabel, getAppIconColor } from '../services/appMetadataService';

const MS_PER_MIN = 60000;

export default function ScreenTimeChartScreen() {
  const [usage, setUsage] = useState<UsageEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const hasPermission = await ScreenTime.hasUsagePermission();
    if (!hasPermission) {
      ScreenTime.openUsageAccessSettings();
      return;
    }
    const stats = await ScreenTime.getTodayUsageStats();
    // Sort by time descending, drop noise under 1 minute.
    const sorted = stats
      .filter((s) => s.totalTimeInForeground > MS_PER_MIN)
      .sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground);
    setUsage(sorted);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const totalMs = usage.reduce((sum, u) => sum + u.totalTimeInForeground, 0);

  const pieData = usage.slice(0, 8).map((u) => ({
    value: Math.round(u.totalTimeInForeground / MS_PER_MIN),
    color: getAppIconColor(u.packageName),
    text: getAppLabel(u.packageName),
  }));

  const barData = usage.slice(0, 8).map((u) => ({
    value: Math.round(u.totalTimeInForeground / MS_PER_MIN),
    label: getAppLabel(u.packageName).slice(0, 6),
    frontColor: getAppIconColor(u.packageName),
  }));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.header}>Today's Screen Time</Text>
      <Text style={styles.totalLabel}>
        {(totalMs / (MS_PER_MIN * 60)).toFixed(1)}h across {usage.length} apps
      </Text>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>By app (share of total)</Text>
        <PieChart
          data={pieData}
          donut
          radius={110}
          innerRadius={65}
          centerLabelComponent={() => (
            <Text style={styles.centerLabel}>
              {(totalMs / (MS_PER_MIN * 60)).toFixed(1)}h
            </Text>
          )}
        />
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Minutes per app</Text>
        <BarChart
          data={barData}
          barWidth={28}
          spacing={20}
          roundedTop
          yAxisThickness={0}
          xAxisThickness={1}
          noOfSections={4}
          isAnimated
        />
      </View>

      <View style={styles.list}>
        {usage.map((u) => (
          <View key={u.packageName} style={styles.listRow}>
            <View
              style={[styles.dot, { backgroundColor: getAppIconColor(u.packageName) }]}
            />
            <Text style={styles.listAppName}>{getAppLabel(u.packageName)}</Text>
            <Text style={styles.listTime}>
              {Math.round(u.totalTimeInForeground / MS_PER_MIN)} min
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14', padding: 16 },
  header: { fontSize: 26, fontWeight: '700', color: '#fff', marginTop: 12 },
  totalLabel: { fontSize: 14, color: '#9A9AA5', marginBottom: 20 },
  chartCard: {
    backgroundColor: '#1A1A22',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  chartTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12, alignSelf: 'flex-start' },
  centerLabel: { color: '#fff', fontSize: 18, fontWeight: '700' },
  list: { marginTop: 4, marginBottom: 40 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomColor: '#26262F',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  listAppName: { color: '#fff', fontSize: 15, flex: 1 },
  listTime: { color: '#9A9AA5', fontSize: 14 },
});
