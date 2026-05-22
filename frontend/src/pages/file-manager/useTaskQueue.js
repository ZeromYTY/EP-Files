import { useState } from 'react';

export default function useTaskQueue() {
  const [tasks, setTasks] = useState([]);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  const addTask = (id, name, title, subText, status, progress = 0) => {
    setTasks((prev) => [...prev, { id, name, title, subText, status, progress }]);
  };

  const updateTask = (id, updatedFields) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updatedFields } : task)));
  };

  const removeTaskWithTimer = (id) => {
    setTimeout(() => setTasks((prev) => prev.filter((task) => task.id !== id)), 5000);
  };

  return {
    tasks,
    setTasks,
    addTask,
    updateTask,
    removeTaskWithTimer,
    isWidgetMinimized,
    setIsWidgetMinimized,
  };
}
