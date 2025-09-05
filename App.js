import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Appearance,
  Platform,
  StatusBar as RNStatusBar,
  useColorScheme,
} from "react-native";

// Screens
import AlarmScreen from "./screens/AlarmScreen";
import CalendarScreen from "./screens/CalendarScreen";
import HomeScreen from "./screens/HomeScreen";
import SettingsScreen from "./screens/SettingsScreen";
import TodoScreen from "./screens/TodoScreen";
import { getTheme } from "./theme";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();

export default function App() {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === "dark");
  const theme = getTheme(isDarkMode);

  useEffect(() => {
    // Listen to system color scheme changes
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      // Only auto-update if user hasn't manually set a preference
      AsyncStorage.getItem("darkMode").then((savedTheme) => {
        if (savedTheme === null) {
          setIsDarkMode(colorScheme === "dark");
        }
      });
    });

    // Request notification permissions on app start
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        console.log("Notification permissions not granted");
      }
    };

    // Load theme preference
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("darkMode");
        if (savedTheme !== null) {
          setIsDarkMode(JSON.parse(savedTheme));
        } else {
          // Use system preference if no saved preference
          setIsDarkMode(systemColorScheme === "dark");
        }
      } catch (error) {
        console.log("Error loading theme preference:", error);
      }
    };

    requestPermissions();
    loadThemePreference();

    return () => subscription?.remove();
  }, [systemColorScheme]);

  const toggleTheme = async (newValue) => {
    setIsDarkMode(newValue);
    try {
      await AsyncStorage.setItem("darkMode", JSON.stringify(newValue));
    } catch (error) {
      console.log("Error saving theme preference:", error);
    }
  };

  return (
    <>
      <StatusBar
        style={isDarkMode ? "light" : "dark"}
        backgroundColor={
          Platform.OS === "android" ? theme.colors.background : undefined
        }
      />
      {Platform.OS === "ios" && (
        <RNStatusBar
          backgroundColor={theme.colors.background}
          barStyle={isDarkMode ? "light-content" : "dark-content"}
        />
      )}
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerStyle: {
              backgroundColor: theme.colors.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            },
            headerTintColor: theme.colors.text,
            headerTitleStyle: {
              fontWeight: theme.typography.weights.semibold,
              fontSize: theme.typography.sizes.subheading,
              fontFamily: theme.typography.fontFamily,
            },
            tabBarStyle: {
              backgroundColor: theme.colors.background,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              height: 64,
              paddingBottom: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
            },
            tabBarLabelStyle: {
              fontSize: theme.typography.sizes.caption,
              fontWeight: theme.typography.weights.medium,
              fontFamily: theme.typography.fontFamily,
              marginTop: 4,
            },
            tabBarActiveTintColor: theme.colors.accent,
            tabBarInactiveTintColor: theme.colors.textTertiary,
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === "Home") {
                iconName = focused ? "home" : "home-outline";
              } else if (route.name === "Alarms") {
                iconName = focused ? "time" : "time-outline";
              } else if (route.name === "To-Dos") {
                iconName = focused ? "list" : "list-outline";
              } else if (route.name === "Calendar") {
                iconName = focused ? "calendar" : "calendar-outline";
              } else if (route.name === "Settings") {
                iconName = focused ? "settings" : "settings-outline";
              }

              return <Ionicons name={iconName} size={24} color={color} />;
            },
          })}
        >
          <Tab.Screen
            name="Home"
            options={{
              title: "Smart Routine",
              headerShown: false,
            }}
          >
            {(props) => (
              <HomeScreen
                {...props}
                theme={theme}
                toggleTheme={toggleTheme}
                isDarkMode={isDarkMode}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Alarms" options={{ title: "Alarms" }}>
            {(props) => <AlarmScreen {...props} theme={theme} />}
          </Tab.Screen>
          <Tab.Screen name="To-Dos" options={{ title: "Tasks" }}>
            {(props) => <TodoScreen {...props} theme={theme} />}
          </Tab.Screen>
          <Tab.Screen name="Calendar" options={{ title: "Calendar" }}>
            {(props) => <CalendarScreen {...props} theme={theme} />}
          </Tab.Screen>
          <Tab.Screen
            name="Settings"
            options={{ title: "Settings", headerShown: false }}
          >
            {(props) => (
              <SettingsScreen
                {...props}
                theme={theme}
                toggleTheme={toggleTheme}
                isDarkMode={isDarkMode}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}
