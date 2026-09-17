import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

export default function WelcomeScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <View style={styles.container} testID="welcome-screen">
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>📍</Text>
        </View>
        <Text style={styles.title}>Proxi</Text>
        <Text style={styles.subtitle}>Safety-first social discovery for India</Text>
        <Text style={styles.description}>
          Discover who is around you at your favorite cafes, clubs, and cultural venues.
          Verified, safe, and discreet.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/(auth)/phone")}
          testID="welcome-get-started-button"
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms and verify you are 18 or older.
        </Text>
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
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    alignItems: "center",
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1E2230",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E94057",
  },
  logoIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#E94057",
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
    marginBottom: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  disclaimer: {
    color: "#5C6378",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
