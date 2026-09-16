import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { apiClient, normalizeError } from "../src/api/client";
import { useTheme } from "../src/theme";

interface HealthResponse {
  status: string;
}

async function fetchHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>("/health");
  return response.data;
}

export default function HealthScreen() {
  const { colors, typography } = useTheme();
  const { data, error, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
  });

  let content: string;
  if (isPending) {
    content = "checking...";
  } else if (error) {
    content = `error: ${normalizeError(error).message}`;
  } else {
    content = data.status;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.heading, { color: colors.text }]}>Health</Text>
      <Text testID="health-status" style={[typography.body, { color: colors.textMuted }]}>
        {content}
      </Text>
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
