import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DAY_CELL_WIDTH = SCREEN_WIDTH / 7 - 2; // 7 columns minus margin

export default function CalendarScreen({ theme }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventTime, setNewEventTime] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showYearModal, setShowYearModal] = useState(false);

  const styles = createStyles(theme);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const years = Array.from({ length: 101 }, (_, i) => 1970 + i);

  // --- Load and save events ---
  const loadEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const storedEvents = await AsyncStorage.getItem("events");
      if (storedEvents) {
        const parsedEvents = JSON.parse(storedEvents);
        const validEvents = parsedEvents.filter(
          (e) => e.id && e.title && e.date
        );
        setEvents(validEvents);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveEvents = useCallback(async (updatedEvents) => {
    try {
      await AsyncStorage.setItem("events", JSON.stringify(updatedEvents));
      setEvents(updatedEvents);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save event");
    }
  }, []);

  const validateEventInput = useCallback(() => {
    if (!newEventTitle.trim()) {
      Alert.alert("Invalid Input", "Event title cannot be empty");
      return false;
    }
    if (newEventTitle.trim().length > 100) {
      Alert.alert("Invalid Input", "Event title is too long (max 100 chars)");
      return false;
    }
    return true;
  }, [newEventTitle]);

  const addOrUpdateEvent = useCallback(async () => {
    if (!validateEventInput()) return;

    try {
      if (editingEvent) {
        const updatedEvents = events.map((event) =>
          event.id === editingEvent.id
            ? {
                ...event,
                title: newEventTitle.trim(),
                time: newEventTime.trim(),
                updatedAt: new Date().toISOString(),
              }
            : event
        );
        await saveEvents(updatedEvents);
      } else {
        const newEvent = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: newEventTitle.trim(),
          time: newEventTime.trim(),
          date: selectedDate.toISOString().split("T")[0],
          createdAt: new Date().toISOString(),
        };
        await saveEvents([...events, newEvent]);
      }
      resetModal();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save event");
    }
  }, [
    editingEvent,
    events,
    newEventTitle,
    newEventTime,
    saveEvents,
    selectedDate,
    validateEventInput,
  ]);

  const deleteEvent = useCallback(
    (eventId, eventTitle) => {
      Alert.alert(
        "Delete Event",
        `Are you sure you want to delete "${eventTitle}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                const updatedEvents = events.filter((e) => e.id !== eventId);
                await saveEvents(updatedEvents);
              } catch (error) {
                console.error(error);
                Alert.alert("Error", "Failed to delete event");
              }
            },
          },
        ]
      );
    },
    [events, saveEvents]
  );

  const editEvent = useCallback((event) => {
    setEditingEvent(event);
    setNewEventTitle(event.title);
    setNewEventTime(event.time || "");
    setSelectedDate(new Date(event.date));
    setShowAddModal(true);
  }, []);

  const resetModal = useCallback(() => {
    setNewEventTitle("");
    setNewEventTime("");
    setEditingEvent(null);
    setShowAddModal(false);
  }, []);

  // --- Calendar utils ---
  const getDaysInMonth = useCallback(
    (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    []
  );
  const getFirstDayOfMonth = useCallback(
    (d) => new Date(d.getFullYear(), d.getMonth(), 1).getDay(),
    []
  );
  const getEventsForDate = useCallback(
    (date) => {
      const dateStr = date.toISOString().split("T")[0];
      return events
        .filter((e) => e.date === dateStr)
        .sort((a, b) => {
          if (a.time && b.time) return a.time.localeCompare(b.time);
          if (a.time && !b.time) return -1;
          if (!a.time && b.time) return 1;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });
    },
    [events]
  );

  const isToday = useCallback(
    (d) => d.toDateString() === new Date().toDateString(),
    []
  );
  const isSameDate = useCallback(
    (d1, d2) => d1.toDateString() === d2.toDateString(),
    []
  );
  const formatDate = useCallback(
    (d) =>
      d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  );

  const navigateMonth = useCallback((dir) => {
    setCurrentDate((prev) => {
      const n = new Date(prev);
      n.setMonth(prev.getMonth() + dir);
      return n;
    });
  }, []);
  const goToToday = useCallback(() => {
    const t = new Date();
    setCurrentDate(t);
    setSelectedDate(t);
  }, []);

  const generateCalendarDays = useCallback(() => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    for (let i = 0; i < firstDay; i++)
      days.push({ isEmpty: true, key: `empty-${i}` });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        d
      );
      const dayEvents = getEventsForDate(date);
      days.push({
        day: d,
        date,
        events: dayEvents,
        isToday: isToday(date),
        isSelected: isSameDate(date, selectedDate),
        key: `day-${d}`,
      });
    }
    return days;
  }, [
    currentDate,
    selectedDate,
    getEventsForDate,
    isToday,
    isSameDate,
    getDaysInMonth,
    getFirstDayOfMonth,
  ]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // --- Renderers ---
  const renderCalendarDay = ({ item }) => {
    if (item.isEmpty)
      return (
        <View style={[styles.calendarDayEmpty, { width: DAY_CELL_WIDTH }]} />
      );
    const eventCount = item.events.length;
    return (
      <TouchableOpacity
        style={[
          styles.calendarDay,
          item.isToday && styles.calendarDayToday,
          item.isSelected && styles.calendarDaySelected,
          { width: DAY_CELL_WIDTH },
        ]}
        onPress={() => setSelectedDate(item.date)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.calendarDayText,
            item.isToday && styles.calendarDayTextToday,
            item.isSelected && styles.calendarDayTextSelected,
          ]}
        >
          {item.day}
        </Text>
        {eventCount > 0 && (
          <View style={styles.eventIndicatorContainer}>
            {eventCount > 3 ? (
              <View style={styles.eventCount}>
                <Text style={styles.eventCountText}>{eventCount}</Text>
              </View>
            ) : (
              <View style={styles.eventIndicator} />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEventItem = ({ item }) => (
    <TouchableOpacity
      style={styles.eventItem}
      onPress={() => editEvent(item)}
      activeOpacity={0.7}
    >
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.time && <Text style={styles.eventTime}>{item.time}</Text>}
      </View>
      <TouchableOpacity
        style={styles.deleteEventButton}
        onPress={() => deleteEvent(item.id, item.title)}
      >
        <Ionicons
          name="trash-outline"
          size={18}
          color={theme.colors.error || theme.colors.textTertiary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const calendarDays = generateCalendarDays();
  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.monthNavigation}>
          <TouchableOpacity onPress={() => navigateMonth(-1)}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowYearModal(true)}>
            <Text style={styles.monthYearText}>
              {months[currentDate.getMonth()]} {currentDate.getFullYear()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateMonth(1)}>
            <Ionicons
              name="chevron-forward"
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Weekdays */}
      <View style={styles.weekDaysContainer}>
        {weekDays.map((d, i) => (
          <View key={i} style={styles.weekDay}>
            <Text style={styles.weekDayText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarContainer}>
        <FlatList
          data={calendarDays}
          renderItem={renderCalendarDay}
          keyExtractor={(item) => item.key}
          numColumns={7}
          scrollEnabled={false}
        />
      </View>

      {/* Selected Date Events */}
      <View style={styles.selectedDateSection}>
        <View style={styles.selectedDateHeader}>
          <Text style={styles.selectedDateTitle} numberOfLines={2}>
            {formatDate(selectedDate)}
          </Text>
          <TouchableOpacity
            style={styles.addEventButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={20} color={theme.colors.background} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={selectedDateEvents}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.noEventsContainer}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={theme.colors.textTertiary}
              />
              <Text style={styles.noEventsText}>No events for this day</Text>
              <Text style={styles.noEventsSubtext}>Tap + to add an event</Text>
            </View>
          }
        />
      </View>

      {/* Add/Edit Event Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        onRequestClose={resetModal}
        presentationStyle="pageSheet"
      >
        <SafeAreaView
          style={styles.modalContainer}
          edges={["top", "bottom", "left", "right"]}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetModal}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingEvent ? "Edit Event" : "Add Event"}
            </Text>
            <TouchableOpacity onPress={addOrUpdateEvent}>
              <Text style={styles.modalAddButton}>
                {editingEvent ? "Update" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Event Title *</Text>
            <TextInput
              style={styles.eventInput}
              placeholder="What's happening?"
              placeholderTextColor={theme.colors.textTertiary}
              value={newEventTitle}
              onChangeText={setNewEventTitle}
              maxLength={100}
              multiline
            />
            <Text style={styles.inputLabel}>Time (Optional)</Text>
            <TextInput
              style={styles.eventInput}
              placeholder="e.g., 2:00 PM or All day"
              placeholderTextColor={theme.colors.textTertiary}
              value={newEventTime}
              onChangeText={setNewEventTime}
              maxLength={50}
            />
            <Text style={styles.selectedDateText}>
              Date: {formatDate(selectedDate)}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Year Picker Modal */}
      <Modal
        visible={showYearModal}
        animationType="slide"
        onRequestClose={() => setShowYearModal(false)}
      >
        <SafeAreaView
          style={[styles.modalContainer, { justifyContent: "center" }]}
          edges={["top", "bottom", "left", "right"]}
        >
          <Text
            style={[
              styles.modalTitle,
              { alignSelf: "center", marginBottom: 20 },
            ]}
          >
            Select Year
          </Text>
          <ScrollView contentContainerStyle={{ alignItems: "center" }}>
            {years.map((year, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  padding: 12,
                  backgroundColor:
                    year === currentDate.getFullYear()
                      ? theme.colors.accent + "50"
                      : "transparent",
                  marginVertical: 2,
                  borderRadius: 8,
                  width: 120,
                  alignItems: "center",
                }}
                onPress={() => {
                  setCurrentDate(new Date(year, currentDate.getMonth(), 1));
                  setShowYearModal(false);
                }}
              >
                <Text
                  style={{
                    color:
                      year === currentDate.getFullYear()
                        ? theme.colors.accent
                        : theme.colors.text,
                    fontWeight: "bold",
                  }}
                >
                  {year}
                </Text>
              </TouchableOpacity>
            ))}
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
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: theme.typography.sizes.title,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    monthNavigation: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    monthYearText: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.text,
    },
    weekDaysContainer: {
      flexDirection: "row",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    weekDay: { flex: 1, alignItems: "center" },
    weekDayText: { color: theme.colors.textSecondary, fontWeight: "600" },
    calendarContainer: { minHeight: 300 },
    calendarDay: {
      height: DAY_CELL_WIDTH,
      justifyContent: "center",
      alignItems: "center",
      margin: 1,
      borderRadius: 6,
    },
    calendarDayEmpty: { height: DAY_CELL_WIDTH, margin: 1 },
    calendarDayToday: { borderWidth: 1, borderColor: theme.colors.accent },
    calendarDaySelected: { backgroundColor: theme.colors.accent },
    calendarDayText: { color: theme.colors.text },
    calendarDayTextToday: { fontWeight: "bold" },
    calendarDayTextSelected: { color: theme.colors.background },
    eventIndicatorContainer: { position: "absolute", bottom: 4 },
    eventIndicator: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.accent,
    },
    eventCount: {
      paddingHorizontal: 4,
      paddingVertical: 2,
      backgroundColor: theme.colors.accent,
      borderRadius: 4,
    },
    eventCountText: { color: theme.colors.background, fontSize: 10 },
    selectedDateSection: {
      flex: 1,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    selectedDateHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    selectedDateTitle: { fontWeight: "600", flex: 1, marginRight: 12 },
    addEventButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    eventItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 8,
    },
    eventContent: { flex: 1, marginRight: 8 },
    eventTitle: { fontWeight: "500", color: theme.colors.text },
    eventTime: { color: theme.colors.textSecondary, marginTop: 2 },
    deleteEventButton: { padding: 4 },
    noEventsContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 24,
    },
    noEventsText: { color: theme.colors.textSecondary, marginTop: 12 },
    noEventsSubtext: { color: theme.colors.textTertiary, marginTop: 4 },
    modalContainer: { flex: 1, backgroundColor: theme.colors.background },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: { fontWeight: "600", fontSize: 18, color: theme.colors.text },
    modalCancelButton: { color: theme.colors.textSecondary },
    modalAddButton: { color: theme.colors.accent, fontWeight: "600" },
    modalContent: { flex: 1, padding: 16 },
    inputLabel: {
      color: theme.colors.text,
      fontWeight: "600",
      marginBottom: 8,
    },
    eventInput: {
      backgroundColor: theme.colors.surface,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
      color: theme.colors.text,
    },
    selectedDateText: { color: theme.colors.textSecondary, marginTop: 16 },
  });
