import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* This points to app/index.tsx (Login) */}
        <Stack.Screen name="index" />
        
        {/* This points to app/dashboard.tsx (Dashboard) */}
        <Stack.Screen name="dashboard" />
      </Stack>
    </>
  );
}