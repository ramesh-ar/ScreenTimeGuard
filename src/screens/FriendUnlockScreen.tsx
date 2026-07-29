import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import auth from '@react-native-firebase/auth';
import {
  createUnlockRequest,
  subscribeToRequest,
  getFriendsList,
} from '../services/friendUnlockService';
import { ScreenTime } from '../native/ScreenTimeBridge';
import { getAppLabel } from '../services/appMetadataService';

interface Props {
  packageName: string;
  onUnlocked: () => void;
}

export default function FriendUnlockScreen({ packageName, onUnlocked }: Props) {
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'approved' | 'denied'>('idle');

  useEffect(() => {
    const user = auth().currentUser;
    if (user) getFriendsList(user.uid).then(setFriends);
  }, []);

  useEffect(() => {
    if (!pendingRequestId) return;
    const unsubscribe = subscribeToRequest(pendingRequestId, async (request) => {
      if (request.status === 'approved') {
        setStatus('approved');
        await ScreenTime.grantTemporaryUnlock(packageName);
        onUnlocked();
      } else if (request.status === 'denied') {
        setStatus('denied');
      }
    });
    return unsubscribe;
  }, [pendingRequestId]);

  const askFriend = async (friendId: string) => {
    setStatus('waiting');
    const id = await createUnlockRequest(friendId, packageName, getAppLabel(packageName));
    setPendingRequestId(id);
  };

  if (status === 'waiting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.waitingText}>Waiting for your friend to respond…</Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedText}>Your friend said not yet. Try again later.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Ask a friend to unlock</Text>
      <Text style={styles.subtitle}>{getAppLabel(packageName)} is locked for the rest of today.</Text>
      <FlatList
        data={friends}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.friendRow} onPress={() => askFriend(item.id)}>
            <Text style={styles.friendName}>{item.name}</Text>
            <Text style={styles.friendAction}>Ask →</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No accountability friends added yet. Add one from Settings first.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F14', padding: 24 },
  header: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 20 },
  subtitle: { color: '#9A9AA5', fontSize: 15, marginTop: 8, marginBottom: 24 },
  friendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomColor: '#26262F',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  friendName: { color: '#fff', fontSize: 16 },
  friendAction: { color: '#4ECDC4', fontSize: 15, fontWeight: '600' },
  emptyText: { color: '#9A9AA5', textAlign: 'center', marginTop: 40 },
  center: { flex: 1, backgroundColor: '#0F0F14', justifyContent: 'center', alignItems: 'center' },
  waitingText: { color: '#9A9AA5', marginTop: 16, fontSize: 15 },
  deniedText: { color: '#FF6B6B', fontSize: 16 },
});
