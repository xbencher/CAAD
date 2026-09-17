import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useAuthStore } from "../../../src/store/auth";

export default function MainTabsScreen(): React.JSX.Element {
  const { user, logout } = useAuthStore();

  return (
    <View style={styles.container} testID="main-tabs-screen">
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PROXI LIVE</Text>
        </View>
        <Text style={styles.title}>Discovery & Venues</Text>
        <Text style={styles.subtitle}>
          Welcome to Proxi! Your account is verified and ready.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>ACCOUNT STATUS</Text>
        <Text style={styles.cardValue}>{user?.status ?? "active"}</Text>
        <Text style={styles.cardInfo}>
          Age gate passed • Consents up to date • Session authenticated
        </Text>
      </View>

      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderIcon}>📍</Text>
        <Text style={styles.placeholderTitle}>Venue Presence</Text>
        <Text style={styles.placeholderText}>
          Check into partnered cafes and venues to discover who is around you.
          (Coming in Checkpoint 3)
        </Text>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => logout()}
        testID="app-logout-button"
      >
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1117",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  header: {
    marginBottom: 24,
  },
  badge: {
    backgroundColor: "rgba(233, 64, 87, 0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E94057",
    marginBottom: 12,
  },
  badgeText: {
    color: "#E94057",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E94A5",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#1A1E2B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2B3245",
    padding: 20,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8E94A5",
    letterSpacing: 1,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#52C41A",
    textTransform: "capitalize",
    marginBottom: 6,
  },
  cardInfo: {
    fontSize: 12,
    color: "#8E94A5",
    lineHeight: 18,
  },
  placeholderCard: {
    backgroundColor: "#141722",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2230",
    borderStyle: "dashed",
    padding: 24,
    alignItems: "center",
    marginBottom: "auto",
  },
  placeholderIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: "#5C6378",
    textAlign: "center",
    lineHeight: 18,
  },
  logoutButton: {
    backgroundColor: "#1A1E2B",
    borderWidth: 1,
    borderColor: "#2B3245",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
