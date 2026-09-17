import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter, useSegments } from "expo-router";

import { UserMe } from "../api/auth";
import { useAuthStore } from "../store/auth";

export type AppRoute =
  | "/(auth)/welcome"
  | "/(auth)/blocked"
  | "/(onboarding)/dob"
  | "/(onboarding)/consent"
  | "/(onboarding)/profile"
  | "/(app)/tabs";

export interface RouteGuardState {
  isAuthenticated: boolean;
  user: UserMe | null;
}

export function determineRoute(state: RouteGuardState): AppRoute {
  if (!state.isAuthenticated || !state.user) {
    return "/(auth)/welcome";
  }

  const { status, has_dob, needs_consent } = state.user;

  if (status === "suspended" || status === "deleted") {
    return "/(auth)/blocked";
  }

  if (status === "pending_profile") {
    if (!has_dob) {
      return "/(onboarding)/dob";
    }
    if (needs_consent) {
      return "/(onboarding)/consent";
    }
    return "/(onboarding)/profile";
  }

  if (status === "active") {
    return "/(app)/tabs";
  }

  return "/(auth)/welcome";
}

interface RouteGuardProps {
  children: React.ReactNode;
}

export function RouteGuard({ children }: RouteGuardProps): React.JSX.Element {
  const { isAuthenticated, user, isLoading, initAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const target = determineRoute({ isAuthenticated, user });
    const segs = segments as string[];
    const currentGroup = segs[0] as string | undefined;

    // Check whether current location already matches the target group
    const isAtAuth = currentGroup === "(auth)";
    const isAtOnboarding = currentGroup === "(onboarding)";
    const isAtApp = currentGroup === "(app)";

    let shouldNavigate = false;

    if (target.startsWith("/(auth)") && !isAtAuth) {
      shouldNavigate = true;
    } else if (target.startsWith("/(onboarding)")) {
      if (!isAtOnboarding) {
        shouldNavigate = true;
      } else {
        // Within onboarding, ensure we are on the specific screen required
        const currentScreen = segs[1] as string | undefined;
        const targetScreen = target.split("/")[2];
        if (currentScreen !== targetScreen) {
          shouldNavigate = true;
        }
      }
    } else if (target.startsWith("/(app)") && !isAtApp) {
      shouldNavigate = true;
    }

    if (shouldNavigate) {
      router.replace(target as never);
    }
  }, [isAuthenticated, user, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer} testID="route-guard-loading">
        <ActivityIndicator size="large" color="#E94057" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F1117",
  },
});
