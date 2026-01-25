import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { COLORS } from '@/constants';
import { initializeFirebase } from '@/lib/firebase';
import { AuthProvider } from '@/contexts/AuthContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'WorldConflict': require('../assets/fonts/WorldConflict.ttf'),
        });
        setFontsLoaded(true);
      } catch (err) {
        console.error('Font loading error:', err);
        setFontsLoaded(true); // Continue without custom font
      }
    }

    // Initialize Firebase on app start - always sync to cloud
    initializeFirebase()
      .then((db) => {
        if (db) {
          console.log('Firebase connected - cloud sync enabled');
        } else {
          console.warn('Firebase initialization failed - running in local mode');
        }
      })
      .catch((err) => {
        console.error('Firebase init error:', err);
      });

    loadFonts();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.surface,
          },
          headerTintColor: COLORS.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: COLORS.background,
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="auth"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="lock"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="purpose"
          options={{
            title: 'Case Purpose',
            presentation: 'modal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="case" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ headerShown: false }} />
        <Stack.Screen name="import-roster" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
