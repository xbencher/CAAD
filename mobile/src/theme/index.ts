import { useColorScheme } from "react-native";

import { darkColors, lightColors } from "./colors";
import { spacing } from "./spacing";
import { typography } from "./typography";

export { spacing, typography };

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? darkColors : lightColors;
  return { colors, spacing, typography, scheme: scheme ?? "light" };
}
