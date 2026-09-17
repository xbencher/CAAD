import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RouteGuard } from "../src/components/RouteGuard";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RouteGuard>
          <Stack screenOptions={{ headerShown: false }} />
        </RouteGuard>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
