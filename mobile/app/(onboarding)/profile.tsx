import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { useAuthStore } from "../../src/store/auth";

export default function ProfileStubScreen(): React.JSX.Element {
  const { logout } = useAuthStore();
  const router = useRouter();

  return (
    <View style={styles.container} testID="profile-stub-screen">
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>✨</Text>
        </View>
        <Text style={styles.title}>You&apos;re all set for CP-1!</Text>
        <Text style={styles.subtitle}>
          Authentication, age gate (BR-01), and versioned consents are verified.
        </Text>
        <Text style={styles.description}>
          Profile creation (photos, bio, intent) will be completed in Checkpoint 2.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/(app)/tabs")}
          testID="profile-continue-button"
        >
          <Text style={styles.buttonText}>Continue to App</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => logout()}
          testID="profile-logout-button"
        >
          <Text style={styles.secondaryButtonText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1117",
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingTop: 100,
    paddingBottom: 40,
  },
  content: {
    alignItems: "center",
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1E2B",
    borderWidth: 1,
    borderColor: "#E94057",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  badgeIcon: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#E94057",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: "#8E94A5",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  footer: {
    width: "100%",
  },
  button: {
    backgroundColor: "#E94057",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#8E94A5",
    fontSize: 14,
    fontWeight: "600",
  },
});
