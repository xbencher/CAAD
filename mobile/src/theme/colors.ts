export const lightColors = {
  background: "#FFFFFF",
  surface: "#F5F5F7",
  text: "#111114",
  textMuted: "#6B6B76",
  primary: "#FF4066",
  border: "#E3E3E8",
  success: "#1E9E5A",
  danger: "#D5392E",
} as const;

export const darkColors = {
  background: "#111114",
  surface: "#1C1C21",
  text: "#F5F5F7",
  textMuted: "#9A9AA6",
  primary: "#FF6B8A",
  border: "#2A2A31",
  success: "#3FBE7F",
  danger: "#F0645A",
} as const;

export type ColorTokens = typeof lightColors;
