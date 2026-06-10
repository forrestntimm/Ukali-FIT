export const theme = {
  colors: {
    background: "#0D1117",
    surface: "#161B22",
    surfaceElevated: "#1F2630",
    surfaceTranslucent: "rgba(22, 27, 34, 0.84)",
    surfaceElevatedTranslucent: "rgba(31, 38, 48, 0.84)",
    adminSurfaceTranslucent: "rgba(22, 27, 34, 0.88)",
    adminSurfaceElevatedTranslucent: "rgba(31, 38, 48, 0.88)",
    border: "#2D333B",
    textPrimary: "#E6EDF3",
    textSecondary: "#9DA7B3",
    accent: "#5EA1FF",
    accentMuted: "#223449",
    accentMutedTranslucent: "rgba(34, 52, 73, 0.82)",
    adminAccentMutedTranslucent: "rgba(34, 52, 73, 0.87)",
    success: "#3FB950",
    danger: "#F85149"
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24
  }
} as const;

export const shadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.2,
  shadowRadius: 16,
  elevation: 4
} as const;
