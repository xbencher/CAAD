import React from "react";
import { Stack } from "expo-router";

export default function AppLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0F1117" },
      }}
    />
  );
}
