import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "@react-navigation/native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AlarmScreen({ theme }) {
  const [alarms, setAlarms] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [alarmName, setAlarmName] = useState("");
  const [alarmDate, setAlarmDate] = useState(new Date());
  const [alarmTime, setAlarmTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState(null);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [soundType, setSoundType] = useState("default");
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // New alarm features
  const [repeatDays, setRepeatDays] = useState([]);
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);
  const [snoozeDuration, setSnoozeDuration] = useState(5); // minutes
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [volume, setVolume] = useState(0.8); // 0-1
  const [gradualIncrease, setGradualIncrease] = useState(false);
  const [oneTimeAlarm, setOneTimeAlarm] = useState(false);
  const [autoDelete, setAutoDelete] = useState(false);
  const [sound, setSound] = useState(null); // For preview
  const [isPlaying, setIsPlaying] = useState(false);

  const styles = createStyles(theme);
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Remove duplicate useEffect, keep only useFocusEffect
  useFocusEffect(
    useCallback(() => {
      loadAlarms();
    }, [])
  );

  useEffect(() => {
    // Configure notification categories
    Notifications.setNotificationCategoryAsync("alarm", [
      {
        identifier: "snooze",
        buttonTitle: "Snooze",
        options: { opensAppToForeground: false },
      },
      {
        identifier: "dismiss",
        buttonTitle: "Dismiss",
        options: { opensAppToForeground: false },
      },
    ]);

    // Configure audio mode for playing sounds
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });

    const subscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const data = notification.request.content.data;
        if (data && data.alarmId) {
          // Handle vibration
          if (data.vibrationEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          // Handle sound based on type
          if (data.soundType === "tts" && data.voiceMessage) {
            Speech.speak(data.voiceMessage, {
              language: "en",
              pitch: 1,
              rate: 0.8,
              volume: data.volume || 0.8,
            });
          } else if (data.soundType === "music" && data.musicUri) {
            try {
              const { sound } = await Audio.Sound.createAsync({
                uri: data.musicUri,
              });
              await sound.setVolumeAsync(data.volume || 0.8);
              await sound.playAsync();
            } catch (error) {
              console.log("Error playing custom music:", error);
            }
          } else if (data.soundType === "default") {
            // Play a repeating alarm sound
            try {
              // Use the downloaded alarm sound
              const { sound } = await Audio.Sound.createAsync(
                require("../assets/alarm.wav"),
                {
                  shouldPlay: true,
                  volume: data.volume || 1.0,
                  isLooping: true, // Keep playing until dismissed
                }
              );
              await sound.playAsync();

              // Store sound reference to stop it later
              global.currentAlarmSound = sound;

              // Auto-stop after 60 seconds if not dismissed
              setTimeout(async () => {
                if (global.currentAlarmSound) {
                  await global.currentAlarmSound.stopAsync();
                  await global.currentAlarmSound.unloadAsync();
                  global.currentAlarmSound = null;
                }
              }, 60000);
            } catch (error) {
              console.log("Error playing alarm sound:", error);
              // Fallback: create a simple beep pattern
              const playBeep = async () => {
                for (let i = 0; i < 10; i++) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  );
                  await new Promise((resolve) => setTimeout(resolve, 500));
                }
              };
              playBeep();
            }
          }

          // Handle auto-delete for one-time alarms
          if (data.autoDelete) {
            const updatedAlarms = alarms.filter(
              (alarm) => alarm.id !== data.alarmId
            );
            setAlarms(updatedAlarms);
            await saveAlarms(updatedAlarms);
          }
        }
      }
    );

    return () => subscription.remove();
  }, [alarms]);

  const loadAlarms = async () => {
    try {
      const storedAlarms = await AsyncStorage.getItem("alarms");
      if (storedAlarms) {
        try {
          const parsedAlarms = JSON.parse(storedAlarms);
          // Filter out deleted alarms and clean up expired one-time alarms
          const activeAlarms = parsedAlarms.filter((alarm) => {
            if (alarm.deleted) return false;

            // Auto-delete expired one-time alarms
            if (alarm.oneTime && new Date(alarm.time) < new Date()) {
              return false;
            }

            return true;
          });
          setAlarms(activeAlarms);

          // Save cleaned alarms back to storage
          if (activeAlarms.length !== parsedAlarms.length) {
            await AsyncStorage.setItem("alarms", JSON.stringify(activeAlarms));
          }
        } catch (parseError) {
          console.error("Error parsing alarms:", parseError);
          // Reset corrupted data
          await AsyncStorage.removeItem("alarms");
          setAlarms([]);
          Alert.alert(
            "Data Error",
            "Alarm data was corrupted and has been reset."
          );
        }
      }
    } catch (error) {
      console.error("Error loading alarms:", error);
      Alert.alert("Error", "Failed to load alarms");
    }
  };

  const saveAlarms = async (alarmsToSave) => {
    try {
      await AsyncStorage.setItem("alarms", JSON.stringify(alarmsToSave));
    } catch (error) {
      console.error("Error saving alarms:", error);
      Alert.alert("Error", "Failed to save alarms");
    }
  };

  const scheduleNotification = async (alarm) => {
    try {
      // Cancel existing notification if any
      if (alarm.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          alarm.notificationId
        );
      }

      const trigger = new Date(alarm.time);
      const now = new Date();

      // Handle one-time alarms
      if (alarm.oneTime) {
        if (trigger <= now) {
          Alert.alert(
            "Invalid Time",
            "One-time alarm must be set for a future time"
          );
          return null;
        }
      } else {
        // Handle repeating alarms
        if (trigger <= now) {
          trigger.setDate(trigger.getDate() + 1);
        }
      }

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ ALARM",
          body: alarm.name || "Wake up!",
          sound: true, // Enable sound
          priority: "max",
          categoryIdentifier: "alarm",
          data: {
            alarmId: alarm.id,
            soundType: alarm.soundType,
            voiceMessage: alarm.voiceMessage,
            musicUri: alarm.selectedMusic,
            vibrationEnabled: alarm.vibrationEnabled,
            volume: alarm.volume,
            snoozeEnabled: alarm.snoozeEnabled,
            snoozeDuration: alarm.snoozeDuration,
            autoDelete: alarm.autoDelete,
          },
        },
        trigger,
      });

      return identifier;
    } catch (error) {
      console.error("Error scheduling notification:", error);
      Alert.alert("Error", "Failed to schedule alarm notification");
      return null;
    }
  };

  const addAlarm = useCallback(async () => {
    if (!alarmName.trim()) {
      Alert.alert("Error", "Please enter an alarm name");
      return;
    }

    // Validate repeat days for non-one-time alarms
    if (!oneTimeAlarm && repeatDays.length === 0) {
      Alert.alert(
        "Error",
        "Please select at least one day for repeating alarms"
      );
      return;
    }

    // Combine date and time into single Date object
    const combinedDateTime = new Date(
      alarmDate.getFullYear(),
      alarmDate.getMonth(),
      alarmDate.getDate(),
      alarmTime.getHours(),
      alarmTime.getMinutes()
    );

    const newAlarm = {
      id: Date.now().toString(),
      name: alarmName,
      time: combinedDateTime.toISOString(),
      enabled: true,
      soundType,
      voiceMessage: soundType === "tts" ? voiceMessage : "",
      selectedMusic: soundType === "music" ? selectedMusic : null,
      deleted: false,
      // New features
      repeatDays: oneTimeAlarm ? [] : repeatDays,
      snoozeEnabled,
      snoozeDuration,
      vibrationEnabled,
      volume,
      gradualIncrease,
      oneTime: oneTimeAlarm,
      autoDelete,
      skipNext: false,
    };

    const notificationId = await scheduleNotification(newAlarm);
    if (notificationId) {
      newAlarm.notificationId = notificationId;

      // Haptic feedback for successful creation
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const updatedAlarms = [...alarms, newAlarm];
      setAlarms(updatedAlarms);
      await saveAlarms(updatedAlarms);

      resetForm();
    }
  }, [
    alarmName,
    alarmDate,
    alarmTime,
    soundType,
    voiceMessage,
    selectedMusic,
    alarms,
    repeatDays,
    snoozeEnabled,
    snoozeDuration,
    vibrationEnabled,
    volume,
    gradualIncrease,
    oneTimeAlarm,
    autoDelete,
  ]);
  const editAlarm = useCallback(async () => {
    if (!alarmName.trim()) {
      Alert.alert("Error", "Please enter an alarm name");
      return;
    }

    // Validate repeat days for non-one-time alarms
    if (!oneTimeAlarm && repeatDays.length === 0) {
      Alert.alert(
        "Error",
        "Please select at least one day for repeating alarms"
      );
      return;
    }

    if (editingAlarm.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(
        editingAlarm.notificationId
      );
    }

    // Combine date and time into single Date object
    const combinedDateTime = new Date(
      alarmDate.getFullYear(),
      alarmDate.getMonth(),
      alarmDate.getDate(),
      alarmTime.getHours(),
      alarmTime.getMinutes()
    );

    const updatedAlarm = {
      ...editingAlarm,
      name: alarmName,
      time: combinedDateTime.toISOString(),
      soundType,
      voiceMessage: soundType === "tts" ? voiceMessage : "",
      selectedMusic: soundType === "music" ? selectedMusic : null,
      // New features
      repeatDays: oneTimeAlarm ? [] : repeatDays,
      snoozeEnabled,
      snoozeDuration,
      vibrationEnabled,
      volume,
      gradualIncrease,
      oneTime: oneTimeAlarm,
      autoDelete,
      skipNext: false, // Reset skip next when editing
    };

    const notificationId = await scheduleNotification(updatedAlarm);
    if (notificationId) {
      updatedAlarm.notificationId = notificationId;

      // Haptic feedback for successful edit
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const updatedAlarms = alarms.map((alarm) =>
        alarm.id === editingAlarm.id ? updatedAlarm : alarm
      );
      setAlarms(updatedAlarms);
      await saveAlarms(updatedAlarms);

      resetForm();
    }
  }, [
    alarmName,
    alarmDate,
    alarmTime,
    soundType,
    voiceMessage,
    selectedMusic,
    editingAlarm,
    alarms,
    repeatDays,
    snoozeEnabled,
    snoozeDuration,
    vibrationEnabled,
    volume,
    gradualIncrease,
    oneTimeAlarm,
    autoDelete,
  ]);

  const deleteAlarm = useCallback(
    async (alarmId) => {
      const alarmToDelete = alarms.find((alarm) => alarm.id === alarmId);
      if (alarmToDelete?.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(
          alarmToDelete.notificationId
        );
      }

      const updatedAlarms = alarms.map((alarm) =>
        alarm.id === alarmId ? { ...alarm, deleted: true } : alarm
      );

      // Filter out deleted alarms from the display
      const activeAlarms = updatedAlarms.filter((alarm) => !alarm.deleted);
      setAlarms(activeAlarms);
      await saveAlarms(updatedAlarms); // Save all alarms including deleted ones
    },
    [alarms]
  );

  const toggleAlarm = useCallback(
    async (alarmId) => {
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const updatedAlarms = await Promise.all(
        alarms.map(async (alarm) => {
          if (alarm.id === alarmId) {
            const updatedAlarm = { ...alarm, enabled: !alarm.enabled };

            // Cancel existing notification
            if (updatedAlarm.notificationId) {
              await Notifications.cancelScheduledNotificationAsync(
                updatedAlarm.notificationId
              );
              updatedAlarm.notificationId = null;
            }

            // Schedule new notification if enabled
            if (updatedAlarm.enabled) {
              const notificationId = await scheduleNotification(updatedAlarm);
              if (notificationId) {
                updatedAlarm.notificationId = notificationId;
              }
            }

            return updatedAlarm;
          }
          return alarm;
        })
      );

      setAlarms(updatedAlarms);
      await saveAlarms(updatedAlarms);
    },
    [alarms]
  );

  const skipNextAlarm = useCallback(
    async (alarmId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const updatedAlarms = alarms.map((alarm) => {
        if (alarm.id === alarmId) {
          return { ...alarm, skipNext: !alarm.skipNext };
        }
        return alarm;
      });

      setAlarms(updatedAlarms);
      await saveAlarms(updatedAlarms);
    },
    [alarms]
  );

  const previewSound = useCallback(async () => {
    try {
      // Stop current sound if playing
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        return;
      }

      setIsPlaying(true);

      if (soundType === "tts" && voiceMessage.trim()) {
        Speech.speak(voiceMessage, {
          language: "en",
          pitch: 1,
          rate: 0.8,
          volume: volume,
          onDone: () => setIsPlaying(false),
          onStopped: () => setIsPlaying(false),
        });
      } else if (soundType === "music" && selectedMusic) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: selectedMusic },
          { volume, shouldPlay: true }
        );
        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
            setSound(null);
          }
        });
      } else {
        // Default sound preview (could be system notification sound)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Error previewing sound:", error);
      setIsPlaying(false);
      Alert.alert("Error", "Failed to preview sound");
    }
  }, [soundType, voiceMessage, selectedMusic, volume, sound]);

  const toggleRepeatDay = useCallback((day) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const resetForm = () => {
    setModalVisible(false);
    setAlarmName("");
    setAlarmDate(new Date());
    setAlarmTime(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setEditingAlarm(null);
    setSelectedMusic(null);
    setVoiceMessage("");
    setSoundType("default");

    // Reset new fields
    setRepeatDays([]);
    setSnoozeEnabled(true);
    setSnoozeDuration(5);
    setVibrationEnabled(true);
    setVolume(0.8);
    setGradualIncrease(false);
    setOneTimeAlarm(false);
    setAutoDelete(false);

    // Stop any playing sound
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setIsPlaying(false);
  };

  const openModal = (alarm = null) => {
    if (alarm) {
      setEditingAlarm(alarm);
      const alarmDateTime = new Date(alarm.time);
      setAlarmName(alarm.name);
      setAlarmDate(alarmDateTime);
      setAlarmTime(alarmDateTime);
      setSoundType(alarm.soundType || "default");
      setVoiceMessage(alarm.voiceMessage || "");
      setSelectedMusic(alarm.selectedMusic || null);

      // Load new fields with defaults for backward compatibility
      setRepeatDays(alarm.repeatDays || []);
      setSnoozeEnabled(alarm.snoozeEnabled ?? true);
      setSnoozeDuration(alarm.snoozeDuration || 5);
      setVibrationEnabled(alarm.vibrationEnabled ?? true);
      setVolume(alarm.volume || 0.8);
      setGradualIncrease(alarm.gradualIncrease || false);
      setOneTimeAlarm(alarm.oneTime || false);
      setAutoDelete(alarm.autoDelete || false);
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const selectMusic = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedMusic(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error selecting music:", error);
      Alert.alert("Error", "Failed to select music file");
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (selectedDate) {
      setAlarmDate(selectedDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (selectedTime) {
      setAlarmTime(selectedTime);
    }
  };

  const formatTime = (time) => {
    return new Date(time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderAlarmItem = useCallback(
    ({ item }) => (
      <View style={styles.alarmItem}>
        <View style={styles.alarmInfo}>
          <Text style={styles.alarmName}>{item.name}</Text>
          <Text
            style={[styles.alarmTime, item.skipNext && styles.skippedAlarm]}
          >
            {formatTime(item.time)}
          </Text>

          {/* Show repeat days */}
          {!item.oneTime && item.repeatDays && item.repeatDays.length > 0 && (
            <Text style={styles.alarmDetails}>
              Repeats: {item.repeatDays.join(", ")}
            </Text>
          )}

          {/* Show one-time indicator */}
          {item.oneTime && (
            <Text style={styles.alarmDetails}>One-time alarm</Text>
          )}

          {/* Show sound type */}
          {item.soundType === "tts" && item.voiceMessage && (
            <Text style={styles.alarmDetails}>
              Voice: {item.voiceMessage.slice(0, 30)}...
            </Text>
          )}
          {item.soundType === "music" && item.selectedMusic && (
            <Text style={styles.alarmDetails}>Custom Music</Text>
          )}

          {/* Show additional settings */}
          <View style={styles.alarmFeatures}>
            {item.vibrationEnabled && (
              <View style={styles.featureTag}>
                <Ionicons
                  name="phone-portrait"
                  size={12}
                  color={theme.colors.accent}
                />
                <Text style={styles.featureText}>Vibrate</Text>
              </View>
            )}
            {item.snoozeEnabled && (
              <View style={styles.featureTag}>
                <Ionicons name="time" size={12} color={theme.colors.accent} />
                <Text style={styles.featureText}>
                  {item.snoozeDuration}m snooze
                </Text>
              </View>
            )}
            {item.gradualIncrease && (
              <View style={styles.featureTag}>
                <Ionicons
                  name="trending-up"
                  size={12}
                  color={theme.colors.accent}
                />
                <Text style={styles.featureText}>Gradual</Text>
              </View>
            )}
          </View>

          {item.skipNext && (
            <Text style={styles.skipNextIndicator}>
              ⏭️ Next alarm will be skipped
            </Text>
          )}
        </View>

        <View style={styles.alarmControls}>
          {/* Skip next button for repeating alarms */}
          {!item.oneTime && (
            <TouchableOpacity
              style={[
                styles.skipButton,
                item.skipNext && styles.skipButtonActive,
              ]}
              onPress={() => skipNextAlarm(item.id)}
            >
              <Ionicons
                name={
                  item.skipNext
                    ? "play-skip-forward"
                    : "play-skip-forward-outline"
                }
                size={18}
                color={item.skipNext ? "#fff" : theme.colors.accent}
              />
            </TouchableOpacity>
          )}

          <Switch
            value={item.enabled}
            onValueChange={() => toggleAlarm(item.id)}
            trackColor={{
              false: theme.colors.border,
              true: theme.colors.accent,
            }}
            thumbColor={item.enabled ? "#fff" : "#f4f3f4"}
          />
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openModal(item)}
          >
            <Ionicons name="pencil" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteAlarm(item.id)}
          >
            <Ionicons name="trash" size={20} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [theme, skipNextAlarm, toggleAlarm, openModal, deleteAlarm]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alarms</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={alarms}
        renderItem={renderAlarmItem}
        keyExtractor={(item) => item.id}
        style={styles.alarmList}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        windowSize={10}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetForm}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAlarm ? "Edit Alarm" : "Create Alarm"}
            </Text>
            <TouchableOpacity onPress={editingAlarm ? editAlarm : addAlarm}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formGroup}>
              <Text style={styles.label}>Alarm Name</Text>
              <TextInput
                style={styles.input}
                value={alarmName}
                onChangeText={setAlarmName}
                placeholder="Enter alarm name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {alarmDate.toLocaleDateString()}
                </Text>
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={theme.colors.accent}
                />
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={alarmDate}
                mode="date"
                onChange={onDateChange}
                style={styles.timePicker}
              />
            )}

            {Platform.OS === "ios" && showDatePicker && (
              <TouchableOpacity
                style={styles.timePickerDone}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.timePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Time</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {formatTime(alarmTime)}
                </Text>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={theme.colors.accent}
                />
              </TouchableOpacity>
            </View>

            {showTimePicker && (
              <DateTimePicker
                value={alarmTime}
                mode="time"
                is24Hour={false}
                onChange={onTimeChange}
                style={styles.timePicker}
              />
            )}

            {Platform.OS === "ios" && showTimePicker && (
              <TouchableOpacity
                style={styles.timePickerDone}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={styles.timePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}

            {/* Alarm Type Section */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Alarm Type</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>One-time alarm</Text>
                <Switch
                  value={oneTimeAlarm}
                  onValueChange={setOneTimeAlarm}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.accent,
                  }}
                  thumbColor={oneTimeAlarm ? "#fff" : "#f4f3f4"}
                />
              </View>
              {oneTimeAlarm && (
                <Text style={styles.helpText}>
                  This alarm will only ring once and be automatically deleted
                </Text>
              )}
            </View>

            {/* Repeat Days Section - only show for repeating alarms */}
            {!oneTimeAlarm && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Repeat Days</Text>
                <View style={styles.weekdaysContainer}>
                  {weekdays.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.weekdayButton,
                        repeatDays.includes(day) &&
                          styles.weekdayButtonSelected,
                      ]}
                      onPress={() => toggleRepeatDay(day)}
                    >
                      <Text
                        style={[
                          styles.weekdayText,
                          repeatDays.includes(day) &&
                            styles.weekdayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {repeatDays.length === 0 && (
                  <Text style={styles.errorText}>
                    Please select at least one day
                  </Text>
                )}
              </View>
            )}

            {/* Volume & Sound Settings */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Volume ({Math.round(volume * 100)}%)
              </Text>
              <View style={styles.sliderContainer}>
                <Ionicons
                  name="volume-low"
                  size={20}
                  color={theme.colors.textSecondary}
                />
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  value={volume}
                  onValueChange={setVolume}
                  minimumTrackTintColor={theme.colors.accent}
                  maximumTrackTintColor={theme.colors.border}
                  thumbStyle={{ backgroundColor: theme.colors.accent }}
                />
                <Ionicons
                  name="volume-high"
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Gradual volume increase</Text>
                <Switch
                  value={gradualIncrease}
                  onValueChange={setGradualIncrease}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.accent,
                  }}
                  thumbColor={gradualIncrease ? "#fff" : "#f4f3f4"}
                />
              </View>
            </View>

            {/* Snooze Settings */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Snooze Settings</Text>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Enable snooze</Text>
                <Switch
                  value={snoozeEnabled}
                  onValueChange={setSnoozeEnabled}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.accent,
                  }}
                  thumbColor={snoozeEnabled ? "#fff" : "#f4f3f4"}
                />
              </View>

              {snoozeEnabled && (
                <View style={styles.durationContainer}>
                  <Text style={styles.durationLabel}>
                    Snooze duration: {snoozeDuration} minutes
                  </Text>
                  <View style={styles.durationButtons}>
                    {[5, 10, 15, 30].map((duration) => (
                      <TouchableOpacity
                        key={duration}
                        style={[
                          styles.durationButton,
                          snoozeDuration === duration &&
                            styles.durationButtonSelected,
                        ]}
                        onPress={() => setSnoozeDuration(duration)}
                      >
                        <Text
                          style={[
                            styles.durationButtonText,
                            snoozeDuration === duration &&
                              styles.durationButtonTextSelected,
                          ]}
                        >
                          {duration}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Vibration & Other Settings */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Additional Settings</Text>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Vibration</Text>
                <Switch
                  value={vibrationEnabled}
                  onValueChange={setVibrationEnabled}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.accent,
                  }}
                  thumbColor={vibrationEnabled ? "#fff" : "#f4f3f4"}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Auto-delete after ringing
                </Text>
                <Switch
                  value={autoDelete}
                  onValueChange={setAutoDelete}
                  trackColor={{
                    false: theme.colors.border,
                    true: theme.colors.accent,
                  }}
                  thumbColor={autoDelete ? "#fff" : "#f4f3f4"}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.sectionHeader}>
                <Text style={styles.label}>Sound Options</Text>
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={previewSound}
                  disabled={soundType === "tts" && !voiceMessage.trim()}
                >
                  <Ionicons
                    name={isPlaying ? "stop" : "play"}
                    size={18}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.previewButtonText}>
                    {isPlaying ? "Stop" : "Preview"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.soundOption,
                  soundType === "default" && styles.soundOptionSelected,
                ]}
                onPress={() => setSoundType("default")}
              >
                <View style={styles.soundOptionContent}>
                  <Ionicons
                    name="notifications"
                    size={20}
                    color={theme.colors.text}
                  />
                  <Text style={styles.soundOptionText}>Default Sound</Text>
                </View>
                {soundType === "default" && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.colors.accent}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.soundOption,
                  soundType === "tts" && styles.soundOptionSelected,
                ]}
                onPress={() => setSoundType("tts")}
              >
                <View style={styles.soundOptionContent}>
                  <Ionicons
                    name="chatbubble"
                    size={20}
                    color={theme.colors.text}
                  />
                  <Text style={styles.soundOptionText}>Voice Message</Text>
                </View>
                {soundType === "tts" && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.colors.accent}
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.soundOption,
                  soundType === "music" && styles.soundOptionSelected,
                ]}
                onPress={() => setSoundType("music")}
              >
                <View style={styles.soundOptionContent}>
                  <Ionicons
                    name="musical-notes"
                    size={20}
                    color={theme.colors.text}
                  />
                  <Text style={styles.soundOptionText}>Custom Music</Text>
                </View>
                {soundType === "music" && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.colors.accent}
                  />
                )}
              </TouchableOpacity>
            </View>

            {soundType === "tts" && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Voice Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={voiceMessage}
                  onChangeText={setVoiceMessage}
                  placeholder="Enter message to be spoken"
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            {soundType === "music" && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Music File</Text>
                <TouchableOpacity
                  style={styles.musicButton}
                  onPress={selectMusic}
                >
                  <Ionicons
                    name="musical-notes"
                    size={20}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.musicButtonText}>
                    {selectedMusic ? "Music Selected" : "Select Music File"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: theme.typography.sizes.title,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    addButton: {
      backgroundColor: theme.colors.accent,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    alarmList: {
      flex: 1,
      padding: theme.spacing.md,
    },
    alarmItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    alarmInfo: {
      flex: 1,
    },
    alarmName: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      marginBottom: theme.spacing.xs / 2,
    },
    alarmTime: {
      fontSize: theme.typography.sizes.heading,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.accent,
      fontFamily: theme.typography.fontFamily,
      marginBottom: theme.spacing.xs / 2,
    },
    alarmDetails: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily,
    },
    alarmControls: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    editButton: {
      padding: theme.spacing.xs,
    },
    deleteButton: {
      padding: theme.spacing.xs,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: theme.typography.sizes.heading,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    cancelButton: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily,
    },
    saveButton: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.accent,
      fontWeight: theme.typography.weights.medium,
      fontFamily: theme.typography.fontFamily,
    },
    modalContent: {
      flex: 1,
      padding: theme.spacing.md,
    },
    formGroup: {
      marginBottom: theme.spacing.lg,
    },
    label: {
      fontSize: theme.typography.sizes.body,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      marginBottom: theme.spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.spacing.sm,
      padding: theme.spacing.md,
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      backgroundColor: theme.colors.surface,
    },
    textArea: {
      height: 80,
      textAlignVertical: "top",
    },
    timeButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    timeButtonText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    timePicker: {
      backgroundColor: theme.colors.surface,
      marginVertical: theme.spacing.sm,
    },
    timePickerDone: {
      alignSelf: "flex-end",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    timePickerDoneText: {
      color: "#fff",
      fontWeight: theme.typography.weights.medium,
      fontFamily: theme.typography.fontFamily,
    },
    soundOption: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.spacing.sm,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    soundOptionSelected: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent + "10",
    },
    soundOptionContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    soundOptionText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    musicButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.sm,
    },
    musicButtonText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },

    // New styles for enhanced alarm features
    skippedAlarm: {
      textDecorationLine: "line-through",
      color: theme.colors.textSecondary,
    },
    alarmFeatures: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    featureTag: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.accent + "20",
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs / 2,
      borderRadius: theme.spacing.xs,
      gap: theme.spacing.xs / 2,
    },
    featureText: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.accent,
      fontFamily: theme.typography.fontFamily,
    },
    skipNextIndicator: {
      fontSize: theme.typography.sizes.caption,
      color: "#ff9500",
      fontFamily: theme.typography.fontFamily,
      marginTop: theme.spacing.xs / 2,
    },
    skipButton: {
      padding: theme.spacing.xs,
      borderRadius: theme.spacing.xs,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    skipButtonActive: {
      backgroundColor: theme.colors.accent,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    switchLabel: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      flex: 1,
    },
    helpText: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily,
      marginTop: theme.spacing.xs,
      fontStyle: "italic",
    },
    errorText: {
      fontSize: theme.typography.sizes.caption,
      color: "#ff4444",
      fontFamily: theme.typography.fontFamily,
      marginTop: theme.spacing.xs,
    },
    weekdaysContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: theme.spacing.sm,
    },
    weekdayButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    weekdayButtonSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    weekdayText: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      fontWeight: theme.typography.weights.medium,
    },
    weekdayTextSelected: {
      color: "#fff",
    },
    sliderContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    slider: {
      flex: 1,
      height: 40,
    },
    durationContainer: {
      marginTop: theme.spacing.sm,
    },
    durationLabel: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      marginBottom: theme.spacing.sm,
    },
    durationButtons: {
      flexDirection: "row",
      gap: theme.spacing.sm,
    },
    durationButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    durationButtonSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    durationButtonText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    durationButtonTextSelected: {
      color: "#fff",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.sm,
    },
    previewButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.spacing.sm,
      backgroundColor: theme.colors.accent + "20",
    },
    previewButtonText: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.accent,
      fontFamily: theme.typography.fontFamily,
      fontWeight: theme.typography.weights.medium,
    },
  });
