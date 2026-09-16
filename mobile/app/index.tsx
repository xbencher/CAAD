import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../src/theme";

export default function HomeScreen() {
  const { colors, spacing, typography } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.title, { color: colors.text }]}>Proxi</Text>
      {__DEV__ && (
        <Link href="/health" style={[typography.body, { color: colors.primary, marginTop: spacing.md }]}>
          Health check
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
