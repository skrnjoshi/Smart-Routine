// Theme configuration for Smart Routine App
// Following the requirements: minimal colors, consistent spacing, system fonts

export const theme = {
  colors: {
    // Primary colors (black, white, one accent)
    background: "#FFFFFF",
    surface: "#FFFFFF",
    text: "#000000",
    textSecondary: "#666666",
    textTertiary: "#999999",
    accent: "#007AFF", // iOS blue as accent color
    border: "#E5E5E5",
    divider: "#F0F0F0",

    // Dark mode support
    dark: {
      background: "#000000",
      surface: "#1C1C1E",
      text: "#FFFFFF",
      textSecondary: "#AEAEB2",
      textTertiary: "#8E8E93",
      accent: "#0A84FF",
      border: "#38383A",
      divider: "#2C2C2E",
    },
  },

  spacing: {
    // 8px grid system
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },

  typography: {
    // System fonts only
    fontFamily: "System",
    sizes: {
      caption: 12,
      body: 16,
      subheading: 18,
      heading: 24,
      title: 32,
    },
    weights: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },

  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
  },
};

export const getTheme = (isDark = false) => {
  return {
    ...theme,
    colors: isDark ? theme.colors.dark : theme.colors,
  };
};
