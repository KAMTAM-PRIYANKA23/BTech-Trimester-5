import { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle, ListTodo } from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:5000/api/tasks";

function App() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTasks = async () => {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("Could not fetch tasks");
      const data = await response.json();
      setTasks(data);
      setError("");
    } catch (err) {
      setError("Unable to connect to the backend. Please check the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTask }),
      });

      if (!response.ok) throw new Error("Could not add task");

      setNewTask("");
      await fetchTasks();
    } catch (err) {
      setError("Unable to add task. Please try again.");
    }
  };

  const toggleTask = async (id, completed) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });

      if (!response.ok) throw new Error("Could not update task");
      await fetchTasks();
    } catch (err) {
      setError("Unable to update task. Please try again.");
    }
  };

  const deleteTask = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Could not delete task");
      await fetchTasks();
    } catch (err) {
      setError("Unable to delete task. Please try again.");
    }
  };

  const completedCount = tasks.filter(
    (task) => task.completed === true || task.completed === 1
  ).length;

  return (
    <div className="app-container">
      <main className="task-card">
        <div className="header">
          <div className="logo">
            <ListTodo size={25} />
            <span>TaskFlow</span>
          </div>
          <span className="status">Your productivity space</span>
        </div>

        <section className="intro">
          <p className="eyebrow">STAY ORGANIZED</p>
          <h1>Manage your tasks.</h1>
          <p className="subtitle">
            Small steps every day lead to big results.
          </p>
        </section>

        <section className="stats">
          <div className="stat-box">
            <span className="stat-number">{tasks.length}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{completedCount}</span>
            <span className="stat-label">Completed</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">{tasks.length - completedCount}</span>
            <span className="stat-label">Remaining</span>
          </div>
        </section>

        <form className="task-form" onSubmit={addTask}>
          <input
            type="text"
            placeholder="What needs to be done?"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
          />
          <button type="submit">
            <Plus size={19} />
            Add Task
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}

        <section className="task-section">
          <h2>My Tasks</h2>

          {loading ? (
            <p className="empty-message">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="empty-message">
              No tasks yet. Add your first task!
            </p>
          ) : (
            <div className="task-list">
              {tasks.map((task) => {
                const isCompleted =
                  task.completed === true || task.completed === 1;

                return (
                  <div className="task-item" key={task.id}>
                    <button
                      className="complete-button"
                      onClick={() => toggleTask(task.id, isCompleted)}
                      type="button"
                      aria-label="Toggle task completion"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="completed-icon" />
                      ) : (
                        <Circle />
                      )}
                    </button>

                    <span className={isCompleted ? "task-title done" : "task-title"}>
                      {task.title}
                    </span>

                    <button
                      className="delete-button"
                      onClick={() => deleteTask(task.id)}
                      type="button"
                      aria-label="Delete task"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer>Built with React and Node.js</footer>
      </main>
    </div>
  );
}

export default App;