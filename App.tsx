import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ScreenTimeChartScreen from './src/screens/ScreenTimeChartScreen';
import AppLimitSetupScreen from './src/screens/AppLimitSetupScreen';

export type RootStackParamList = {
  ScreenTimeChart: undefined;
  AppLimitSetup: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="ScreenTimeChart"
        screenOptions={{
          headerStyle: { backgroundColor: '#0F0F14' },
          headerTintColor: '#fff',
        }}
      >
        <Stack.Screen
          name="ScreenTimeChart"
          component={ScreenTimeChartScreen}
          options={{ title: 'Screen Time' }}
        />
        <Stack.Screen
          name="AppLimitSetup"
          component={AppLimitSetupScreen}
          options={{ title: 'Set Limits' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
