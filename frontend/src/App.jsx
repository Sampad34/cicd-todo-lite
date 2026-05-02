import { useState, useEffect } from "react";
import axios from "axios";

// Vite uses import.meta.env instead of process.env
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function App() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let intervalId;

    // Define fetchTodos inside useEffect
    const fetchTodos = async () => {
      if (!isMounted) return;

      try {
        const response = await axios.get(`${API_URL}/todos`);
        if (isMounted) {
          setTodos(response.data);
          setError("");
        }
      } catch (error) {
        console.error("Error fetching todos:", error);
        if (isMounted) {
          if (error.code === "ERR_NETWORK") {
            setError(
              "Cannot connect to backend. Please make sure the backend server is running on port 5000",
            );
          } else {
            setError(error.response?.data?.error || "Failed to load todos");
          }
        }
      }
    };

    // Initial fetch
    fetchTodos();

    // Auto-refresh ONLY for external changes (SQLite Browser)
    if (autoRefresh) {
      intervalId = setInterval(() => {
        if (isMounted) {
          fetchTodos();
        }
      }, 10000); // 10 seconds
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh]);

  const addTodo = async (e) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) return;

    setError("");
    setLoading(true);

    try {
      await axios.post(`${API_URL}/todos`, { title: trimmedValue });
      setInputValue("");

      // Fetch updated todos
      const response = await axios.get(`${API_URL}/todos`);
      setTodos(response.data);
    } catch (error) {
      console.error("Error adding todo:", error);
      setError(error.response?.data?.error || "Failed to add todo");
    } finally {
      setLoading(false);
    }
  };

  const toggleTodo = async (id, currentStatus) => {
    const newStatus = currentStatus === 1 ? 0 : 1;

    // Optimistic update for better UX
    const originalTodos = [...todos];
    setTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, completed: newStatus } : todo,
      ),
    );

    try {
      await axios.put(`${API_URL}/todos/${id}`, { completed: newStatus });

      // Sync with server
      const response = await axios.get(`${API_URL}/todos`);
      setTodos(response.data);
    } catch (error) {
      // Revert on error
      setTodos(originalTodos);
      console.error("Error updating todo:", error);
      setError(error.response?.data?.error || "Failed to update todo");
    }
  };

  const deleteTodo = async (id) => {
    if (!window.confirm("Are you sure you want to delete this todo?")) {
      return;
    }

    // Optimistic update
    const originalTodos = [...todos];
    setTodos(todos.filter((todo) => todo.id !== id));

    try {
      await axios.delete(`${API_URL}/todos/${id}`);

      // Sync with server
      const response = await axios.get(`${API_URL}/todos`);
      setTodos(response.data);
    } catch (error) {
      // Revert on error
      setTodos(originalTodos);
      console.error("Error deleting todo:", error);
      setError(error.response?.data?.error || "Failed to delete todo");
    }
  };

  const refreshTodos = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/todos`);
      setTodos(response.data);
      setError("");
    } catch (error) {
      console.error("Error fetching todos:", error);
      setError("Failed to load todos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 py-12">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-800">
              Todo App v2.0 - CI/CD Test
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  autoRefresh
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 text-gray-700"
                }`}
              >
                {autoRefresh ? "Live Sync ON" : "Live Sync OFF"}
              </button>
              <button
                onClick={refreshTodos}
                disabled={loading}
                className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Manual refresh - useful when auto-sync is off or to see external changes"
              >
                {loading ? "⟳" : "🔄"} Sync Now
              </button>
            </div>
          </div>

          {autoRefresh && (
            <div className="mb-2 text-xs text-green-600 text-right">
              🔄 Auto-syncing with database every 10 seconds
            </div>
          )}

          <div className="mb-2 text-xs text-gray-500 text-right">
            💡 Changes from UI are instant | External changes appear within 10
            seconds
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading && todos.length === 0 && (
            <div className="mb-4 p-3 bg-blue-100 text-blue-700 rounded-lg text-sm">
              Loading todos...
            </div>
          )}

          <form onSubmit={addTodo} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Add a new todo..."
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </form>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {todos.length > 0
              ? todos.map((todo) => (
                  <div
                    key={todo.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={todo.completed === 1}
                        onChange={() => toggleTodo(todo.id, todo.completed)}
                        disabled={loading}
                        className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 disabled:opacity-50"
                      />
                      <span
                        className={`${todo.completed === 1 ? "line-through text-gray-400" : "text-gray-700"} flex-1 break-words`}
                      >
                        {todo.title}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      disabled={loading}
                      className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-2"
                    >
                      Delete
                    </button>
                  </div>
                ))
              : !loading && (
                  <p className="text-center text-gray-500 py-4">
                    No todos yet. Add one above!
                  </p>
                )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
