import React from 'react';
import { StatusBar, TouchableOpacity, Text } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppLimitSetupScreen from './src/screens/AppLimitSetupScreen';
import ScreenTimeChartScreen from './src/screens/ScreenTimeChartScreen';
import FriendUnlockScreen from './src/screens/FriendUnlockScreen';

export type RootStackParamList = {
  Limits: undefined;
  Chart: undefined;
  FriendUnlock: { packageName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Handles the `screentimeguard://unlock-request?package=<pkg>` deep link that
// LockScreenActivity opens when the user taps "Ask a friend to unlock".
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['screentimeguard://'],
  config: {
    screens: {
      Limits: 'limits',
      Chart: 'chart',
      FriendUnlock: {
        path: 'unlock-request',
        parse: {
          packageName: (packageName: string) => packageName,
        },
      },
    },
  },
};

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0F0F14" />
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#0F0F14' },
            headerTintColor: '#fff',
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="Limits"
            component={AppLimitSetupScreen}
            options={({ navigation }) => ({
              title: 'App Limits',
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Chart')}>
                  <Text style={{ color: '#4ECDC4', fontWeight: '600' }}>Chart</Text>
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen
            name="Chart"
            component={ScreenTimeChartScreen}
            options={{ title: 'Screen Time' }}
          />
          <Stack.Screen
            name="FriendUnlock"
            options={{ title: 'Ask a Friend' }}
          >
            {({ route, navigation }) => (
              <FriendUnlockScreen
                packageName={route.params.packageName}
                onUnlocked={() => navigation.goBack()}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
