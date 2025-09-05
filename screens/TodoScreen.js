import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function TodoScreen({ theme }) {
  const [tasks, setTasks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Personal");
  const [filter, setFilter] = useState("all"); // all, pending, completed

  const styles = createStyles(theme);

  const categories = ["Personal", "Work", "Health", "Shopping", "Other"];

  const loadTasks = useCallback(async () => {
    try {
      const storedTasks = await AsyncStorage.getItem("tasks");
      if (storedTasks) {
        setTasks(JSON.parse(storedTasks));
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  }, []);

  const saveTasks = useCallback(async (updatedTasks) => {
    try {
      await AsyncStorage.setItem("tasks", JSON.stringify(updatedTasks));
      setTasks(updatedTasks);
    } catch (error) {
      console.error("Error saving tasks:", error);
    }
  }, []);

  const addTask = useCallback(async () => {
    if (newTaskText.trim() === "") return;

    const newTask = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      category: selectedCategory,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const updatedTasks = [...tasks, newTask];
    await saveTasks(updatedTasks);

    setNewTaskText("");
    setShowAddModal(false);
  }, [newTaskText, selectedCategory, tasks, saveTasks]);

  const toggleTask = useCallback(
    async (taskId) => {
      const updatedTasks = tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      );
      await saveTasks(updatedTasks);
    },
    [tasks, saveTasks]
  );

  const deleteTask = useCallback(
    (taskId) => {
      Alert.alert("Delete Task", "Are you sure you want to delete this task?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updatedTasks = tasks.filter((task) => task.id !== taskId);
            await saveTasks(updatedTasks);
          },
        },
      ]);
    },
    [tasks, saveTasks]
  );

  const getFilteredTasks = useCallback(() => {
    switch (filter) {
      case "pending":
        return tasks.filter((task) => !task.completed);
      case "completed":
        return tasks.filter((task) => task.completed);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  const getStats = useCallback(() => {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    const pending = total - completed;
    return { total, completed, pending };
  }, [tasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Reload tasks when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const renderTaskItem = ({ item }) => (
    <View style={styles.taskItem}>
      <TouchableOpacity
        style={[
          styles.taskCheckbox,
          item.completed && styles.taskCheckboxCompleted,
        ]}
        onPress={() => toggleTask(item.id)}
      >
        {item.completed && (
          <Ionicons
            name="checkmark"
            size={16}
            color={theme.colors.background}
          />
        )}
      </TouchableOpacity>

      <View style={styles.taskContent}>
        <Text
          style={[styles.taskText, item.completed && styles.taskTextCompleted]}
        >
          {item.text}
        </Text>
        <Text style={styles.taskCategory}>{item.category}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteTask(item.id)}
      >
        <Ionicons
          name="trash-outline"
          size={20}
          color={theme.colors.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );

  const renderCategoryButton = (category) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.categoryButton,
        selectedCategory === category && styles.categoryButtonSelected,
      ]}
      onPress={() => setSelectedCategory(category)}
    >
      <Text
        style={[
          styles.categoryButtonText,
          selectedCategory === category && styles.categoryButtonTextSelected,
        ]}
      >
        {category}
      </Text>
    </TouchableOpacity>
  );

  const renderFilterButton = (filterType, label) => (
    <TouchableOpacity
      key={filterType}
      style={[
        styles.filterButton,
        filter === filterType && styles.filterButtonSelected,
      ]}
      onPress={() => setFilter(filterType)}
    >
      <Text
        style={[
          styles.filterButtonText,
          filter === filterType && styles.filterButtonTextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const stats = getStats();
  const filteredTasks = getFilteredTasks();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Stats */}
      <View style={styles.header}>
        <Text style={styles.title}>To-Dos</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.completed}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {renderFilterButton("all", "All")}
        {renderFilterButton("pending", "Pending")}
        {renderFilterButton("completed", "Completed")}
      </View>

      {/* Tasks List */}
      <FlatList
        data={filteredTasks}
        renderItem={renderTaskItem}
        keyExtractor={(item) => item.id}
        style={styles.tasksList}
        contentContainerStyle={styles.tasksListContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={10}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="list-outline"
              size={64}
              color={theme.colors.textTertiary}
            />
            <Text style={styles.emptyText}>
              {filter === "completed"
                ? "No completed tasks"
                : filter === "pending"
                ? "No pending tasks"
                : "No tasks yet"}
            </Text>
            <Text style={styles.emptySubtext}>
              {filter === "all"
                ? "Tap the + button to add your first task"
                : ""}
            </Text>
          </View>
        }
      />

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={24} color={theme.colors.background} />
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Task</Text>
            <TouchableOpacity onPress={addTask}>
              <Text style={styles.modalAddButton}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              style={styles.taskInput}
              placeholder="What needs to be done?"
              placeholderTextColor={theme.colors.textTertiary}
              value={newTaskText}
              onChangeText={setNewTaskText}
              autoFocus
              multiline
            />

            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryContainer}>
              {categories.map(renderCategoryButton)}
            </View>
          </View>
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
      padding: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: theme.typography.sizes.title,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
      marginBottom: theme.spacing.md,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statItem: {
      alignItems: "center",
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
      marginTop: theme.spacing.xs / 2,
      fontFamily: theme.typography.fontFamily,
    },
    filterContainer: {
      flexDirection: "row",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    filterButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    filterButtonSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterButtonText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    filterButtonTextSelected: {
      color: theme.colors.background,
      fontWeight: theme.typography.weights.medium,
    },
    tasksList: {
      flex: 1,
    },
    tasksListContent: {
      padding: theme.spacing.lg,
      paddingBottom: 100,
    },
    taskItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.sm,
    },
    taskCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.spacing.md,
    },
    taskCheckboxCompleted: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    taskContent: {
      flex: 1,
    },
    taskText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    taskTextCompleted: {
      textDecorationLine: "line-through",
      color: theme.colors.textSecondary,
    },
    taskCategory: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.xs / 2,
      fontFamily: theme.typography.fontFamily,
    },
    deleteButton: {
      padding: theme.spacing.sm,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.spacing.xl * 2,
    },
    emptyText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.lg,
      fontFamily: theme.typography.fontFamily,
    },
    emptySubtext: {
      fontSize: theme.typography.sizes.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.sm,
      textAlign: "center",
      fontFamily: theme.typography.fontFamily,
    },
    addButton: {
      position: "absolute",
      right: theme.spacing.lg,
      bottom: theme.spacing.lg + 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.colors.accent,
      alignItems: "center",
      justifyContent: "center",
      elevation: 4,
      shadowColor: theme.colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: theme.typography.sizes.heading,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    modalCancelButton: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.textSecondary,
      fontFamily: theme.typography.fontFamily,
    },
    modalAddButton: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.accent,
      fontWeight: theme.typography.weights.medium,
      fontFamily: theme.typography.fontFamily,
    },
    modalContent: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    taskInput: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 80,
      textAlignVertical: "top",
      fontFamily: theme.typography.fontFamily,
      marginBottom: theme.spacing.lg,
    },
    categoryLabel: {
      fontSize: theme.typography.sizes.subheading,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      marginBottom: theme.spacing.md,
      fontFamily: theme.typography.fontFamily,
    },
    categoryContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    categoryButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    categoryButtonSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    categoryButtonText: {
      fontSize: theme.typography.sizes.body,
      color: theme.colors.text,
      fontFamily: theme.typography.fontFamily,
    },
    categoryButtonTextSelected: {
      color: theme.colors.background,
      fontWeight: theme.typography.weights.medium,
    },
  });
