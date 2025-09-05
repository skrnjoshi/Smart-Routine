import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen({
  navigation,
  theme,
  toggleTheme,
  isDarkMode,
}) {
  const [alarms, setAlarms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalAlarms: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
  });

  const styles = createStyles(theme);

  const loadData = useCallback(async () => {
    try {
      const [storedAlarms, storedTasks] = await Promise.all([
        AsyncStorage.getItem("alarms"),
        AsyncStorage.getItem("tasks"),
      ]);

      const alarmsData = storedAlarms ? JSON.parse(storedAlarms) : [];
      const tasksData = storedTasks ? JSON.parse(storedTasks) : [];

      // Filter only active alarms that are not deleted
      const activeAlarms = alarmsData.filter(
        (alarm) => alarm.enabled && !alarm.deleted
      );
      setAlarms(activeAlarms);
      setTasks(tasksData);

      setStats({
        totalAlarms: activeAlarms.length,
        totalTasks: tasksData.length,
        completedTasks: tasksData.filter((task) => task.completed).length,
        pendingTasks: tasksData.filter((task) => !task.completed).length,
      });
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }, []);

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    loadData();

    const unsubscribe = navigation.addListener("focus", loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const StatCard = ({ title, value, subtitle, onPress, icon }) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={20} color={theme.colors.accent} />
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const QuickAction = ({ title, icon, onPress }) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Ionicons name={icon} size={24} color={theme.colors.accent} />
      <Text style={styles.quickActionText}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.subtitle}>Ready to start your day?</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard
              title="Active Alarms"
              value={stats.totalAlarms}
              icon="alarm-outline"
              onPress={() => navigation.navigate("Alarms")}
            />
            <StatCard
              title="Total Tasks"
              value={stats.totalTasks}
              subtitle={`${stats.completedTasks} completed`}
              icon="list-outline"
              onPress={() => navigation.navigate("To-Dos")}
            />
          </View>

          <View style={styles.statsRow}>
            <StatCard
              title="Completed"
              value={stats.completedTasks}
              icon="checkmark-circle-outline"
              onPress={() => navigation.navigate("To-Dos")}
            />
            <StatCard
              title="Pending"
              value={stats.pendingTasks}
              icon="time-outline"
              onPress={() => navigation.navigate("To-Dos")}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickAction
              title="Add Alarm"
              icon="alarm-outline"
              onPress={() => navigation.navigate("Alarms")}
            />
            <QuickAction
              title="Add Task"
              icon="add-circle-outline"
              onPress={() => navigation.navigate("To-Dos")}
            />
            <QuickAction
              title="Calendar"
              icon="calendar-outline"
              onPress={() => navigation.navigate("Calendar")}
            />
            <QuickAction
              title="Settings"
              icon="settings-outline"
              onPress={() => navigation.navigate("Settings")}
            />
          </View>
        </View>

        {/* Recent Items Section */}
        {(alarms.length > 0 ||
          tasks.filter((t) => !t.completed).length > 0) && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={styles.recentContainer}>
              {alarms.slice(0, 2).map((alarm) => (
                <View key={alarm.id} style={styles.recentItem}>
                  <Ionicons
                    name="alarm-outline"
                    size={16}
                    color={theme.colors.accent}
                  />
                  <View style={styles.recentContent}>
                    <Text style={styles.recentTitle}>{alarm.name}</Text>
                    <Text style={styles.recentSubtitle}>
                      {new Date(alarm.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: theme.colors.accent },
                    ]}
                  />
                </View>
              ))}

              {tasks
                .filter((t) => !t.completed)
                .slice(0, 2)
                .map((task) => (
                  <View key={task.id} style={styles.recentItem}>
                    <Ionicons
                      name="list-outline"
                      size={16}
                      color={theme.colors.textSecondary}
                    />
                    <View style={styles.recentContent}>
                      <Text style={styles.recentTitle}>{task.text}</Text>
                      <Text style={styles.recentSubtitle}>{task.category}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: theme.colors.textSecondary },
                      ]}
                    />
                  </View>
                ))}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
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
    scrollContent: {
      paddingBottom: 120, // more than tab bar height
    },
    header: {
      padding: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
    },
    greeting: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.sizes.title,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    subtitle: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      fontFamily: theme.typography.fontFamily,
    },
    statsContainer: {
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    statsRow: {
      flexDirection: "row",
      marginBottom: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    statHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.xs,
    },
    statValue: {
      fontSize: theme.typography.sizes.heading,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    statTitle: {
      fontSize: theme.typography.sizes.caption,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily,
    },
    statSubtitle: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.xs / 2,
      fontFamily: theme.typography.fontFamily,
    },
    section: {
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    quickActionsSection: {
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.xl, // Extra space after Quick Actions
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingBottom: theme.spacing.lg,
    },
    recentSection: {
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing.md,
    },
    recentContainer: {
      // Container for recent items to prevent leakage
    },
    sectionTitle: {
      fontSize: theme.typography.sizes.subheading,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      fontFamily: theme.typography.fontFamily,
    },
    quickActionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between", // keeps items aligned nicely
      gap: theme.spacing.sm,
    },

    quickAction: {
      width: "48%", // instead of flex:1 + minWidth
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 100, // slightly bigger for good touch target
    },
    quickActionText: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      marginTop: theme.spacing.sm,
      textAlign: "center",
      fontFamily: theme.typography.fontFamily,
    },
    recentItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
    },
    recentContent: {
      flex: 1,
      marginLeft: theme.spacing.sm,
    },
    recentTitle: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    recentSubtitle: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs / 2,
      fontFamily: theme.typography.fontFamily,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    bottomSpacer: {
      height: 80, // Space for tab bar and extra padding
      backgroundColor: "transparent",
    },
  });
