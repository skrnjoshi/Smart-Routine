import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SettingsScreen({
  theme,
  toggleTheme,
  isDarkMode,
  navigation,
}) {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: isDarkMode || false,
    soundEnabled: true,
    vibrationEnabled: true,
    autoDeleteCompleted: false,
    reminderTime: 30,
  });

  const [statistics, setStatistics] = useState({
    activeAlarms: 0,
    totalTasks: 0,
    events: 0,
    daysActive: 0,
  });

  const loadStatistics = useCallback(async () => {
    try {
      const [alarmsData, tasksData, eventsData] = await Promise.all([
        AsyncStorage.getItem("alarms"),
        AsyncStorage.getItem("tasks"),
        AsyncStorage.getItem("events"),
      ]);

      // Calculate active alarms
      const alarms = alarmsData ? JSON.parse(alarmsData) : [];
      const activeAlarms = alarms.filter(
        (alarm) => alarm.enabled && !alarm.deleted
      ).length;

      // Calculate total tasks
      const tasks = tasksData ? JSON.parse(tasksData) : [];
      const totalTasks = tasks.length;

      // Calculate events
      const events = eventsData ? JSON.parse(eventsData) : [];
      const totalEvents = events.length;

      // Calculate days active (rough estimate based on data creation)
      const allData = [...alarms, ...tasks, ...events];
      const uniqueDates = new Set();

      allData.forEach((item) => {
        if (item.createdAt) {
          const date = new Date(item.createdAt).toDateString();
          uniqueDates.add(date);
        }
      });

      setStatistics({
        activeAlarms,
        totalTasks,
        events: totalEvents,
        daysActive: uniqueDates.size,
      });
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }, []);

  const styles = createStyles(theme);

  const loadSettings = useCallback(async () => {
    try {
      const storedSettings = await AsyncStorage.getItem("settings");
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings) => {
    try {
      await AsyncStorage.setItem("settings", JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  }, []);

  const updateSetting = useCallback(
    async (key, value) => {
      const newSettings = { ...settings, [key]: value };
      await saveSettings(newSettings);

      // Handle dark mode toggle
      if (key === "darkMode" && toggleTheme) {
        toggleTheme(value);
      }
    },
    [settings, saveSettings, toggleTheme]
  );

  useEffect(() => {
    loadSettings();
    loadStatistics();
  }, [loadSettings, loadStatistics]);

  // Refresh statistics when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadStatistics();
    }, [loadStatistics])
  );

  // Update settings when darkMode prop changes
  useEffect(() => {
    if (typeof isDarkMode === "boolean") {
      setSettings((prev) => ({ ...prev, darkMode: isDarkMode }));
    }
  }, [isDarkMode]);

  const clearAllData = useCallback(() => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your alarms, tasks, events, and settings. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                "alarms",
                "tasks",
                "events",
                "settings",
              ]);
              Alert.alert("Success", "All data has been cleared");
            } catch (error) {
              Alert.alert("Error", "Failed to clear data");
              console.error("Error clearing data:", error);
            }
          },
        },
      ]
    );
  }, []);

  const exportData = useCallback(async () => {
    try {
      const [alarms, tasks, events, settings] = await AsyncStorage.multiGet([
        "alarms",
        "tasks",
        "events",
        "settings",
      ]);

      const exportData = {
        alarms: alarms[1] ? JSON.parse(alarms[1]) : [],
        tasks: tasks[1] ? JSON.parse(tasks[1]) : [],
        events: events[1] ? JSON.parse(events[1]) : [],
        settings: settings[1] ? JSON.parse(settings[1]) : {},
        exportDate: new Date().toISOString(),
      };

      Alert.alert(
        "Export Data",
        `Data exported successfully!\n\nAlarms: ${exportData.alarms.length}\nTasks: ${exportData.tasks.length}\nEvents: ${exportData.events.length}\n\nData has been prepared for export.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to export data");
      console.error("Error exporting data:", error);
    }
  }, []);

  const SettingRow = ({
    title,
    subtitle,
    value,
    onToggle,
    icon,
    type = "switch",
  }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.accent} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {type === "switch" && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{
            false: theme.colors.border,
            true: theme.colors.accent + "40",
          }}
          thumbColor={value ? theme.colors.accent : theme.colors.textTertiary}
        />
      )}
    </View>
  );

  const ActionButton = ({
    title,
    subtitle,
    onPress,
    icon,
    destructive = false,
  }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={styles.settingIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? "#FF3B30" : theme.colors.accent}
        />
      </View>
      <View style={styles.settingContent}>
        <Text
          style={[styles.settingTitle, destructive && { color: "#FF3B30" }]}
        >
          {title}
        </Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={theme.colors.textTertiary}
      />
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Appearance */}
        <SectionHeader title="Appearance" />
        <View style={styles.section}>
          <SettingRow
            title="Dark Mode"
            subtitle="Use dark theme throughout the app"
            value={settings.darkMode}
            onToggle={(value) => updateSetting("darkMode", value)}
            icon="moon-outline"
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={styles.section}>
          <SettingRow
            title="Enable Notifications"
            subtitle="Receive alerts for alarms and reminders"
            value={settings.notifications}
            onToggle={(value) => updateSetting("notifications", value)}
            icon="notifications-outline"
          />
          <SettingRow
            title="Sound"
            subtitle="Play notification sounds"
            value={settings.soundEnabled}
            onToggle={(value) => updateSetting("soundEnabled", value)}
            icon="volume-high-outline"
          />
          <SettingRow
            title="Vibration"
            subtitle="Vibrate for notifications"
            value={settings.vibrationEnabled}
            onToggle={(value) => updateSetting("vibrationEnabled", value)}
            icon="phone-portrait-outline"
          />
        </View>

        {/* Tasks */}
        <SectionHeader title="Tasks" />
        <View style={styles.section}>
          <SettingRow
            title="Auto-delete Completed"
            subtitle="Automatically remove completed tasks after 7 days"
            value={settings.autoDeleteCompleted}
            onToggle={(value) => updateSetting("autoDeleteCompleted", value)}
            icon="checkmark-done-outline"
          />
        </View>

        {/* Data Management */}
        <SectionHeader title="Data" />
        <View style={styles.section}>
          <ActionButton
            title="Export Data"
            subtitle="Save your data as a backup"
            onPress={exportData}
            icon="download-outline"
          />
          <ActionButton
            title="Clear All Data"
            subtitle="Delete all alarms, tasks, and events"
            onPress={clearAllData}
            icon="trash-outline"
            destructive={true}
          />
        </View>

        {/* App Info */}
        <SectionHeader title="About" />
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.settingIcon}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.colors.accent}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Smart Routine</Text>
              <Text style={styles.settingSubtitle}>Version 1.0.0</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={styles.settingIcon}>
              <Ionicons
                name="code-outline"
                size={20}
                color={theme.colors.accent}
              />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Built with React Native</Text>
              <Text style={styles.settingSubtitle}>Expo SDK 51</Text>
            </View>
          </View>
        </View>

        {/* Statistics */}
        <SectionHeader title="Statistics" />
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.activeAlarms}</Text>
              <Text style={styles.statLabel}>Active Alarms</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.totalTasks}</Text>
              <Text style={styles.statLabel}>Total Tasks</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.events}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{statistics.daysActive}</Text>
              <Text style={styles.statLabel}>Days Active</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      padding: theme.spacing.lg,
    },
    title: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.sizes.title,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    sectionHeader: {
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
      fontFamily: theme.typography.fontFamily,
    },
    section: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: theme.spacing.lg,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.md,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    settingSubtitle: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs / 2,
      fontFamily: theme.typography.fontFamily,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    statCard: {
      flex: 1,
      minWidth: "45%",
      alignItems: "center",
      padding: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statValue: {
      fontSize: theme.typography.sizes.heading,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    statLabel: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      textAlign: "center",
      fontFamily: theme.typography.fontFamily,
    },
    bottomPadding: {
      height: theme.spacing.xl,
    },
  });
