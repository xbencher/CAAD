import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuthStore } from "../../src/store/auth";

export default function BlockedScreen(): React.JSX.Element {
  const { logout } = useAuthStore();

  return (
    <View style={styles.container} testID="blocked-screen">
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🚫</Text>
        </View>
        <Text style={styles.title}>Account Unavailable</Text>
        <Text style={styles.message}>
          Your Proxi account has been suspended or deactivated in accordance with our Community
          Guidelines and safety rules.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => logout()}
        testID="blocked-logout-button"
      >
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
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
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2B1A1E",
    borderWidth: 1,
    borderColor: "#FF4D4F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "#8E94A5",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  button: {
    backgroundColor: "#1A1E2B",
    borderWidth: 1,
    borderColor: "#2B3245",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
