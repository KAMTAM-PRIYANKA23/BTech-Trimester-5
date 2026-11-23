require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "Cloud CI/CD Project Backend is running!",
        status: "Success",
        database: "MySQL"
    });
});

// Get all tasks
app.get("/api/tasks", async (req, res) => {
    try {
        const [tasks] = await pool.execute(
            "SELECT * FROM tasks ORDER BY created_at DESC, id DESC"
        );

        res.json(tasks.map(task => ({
            ...task,
            completed: Boolean(task.completed)
        })));
    } catch (error) {
        console.error("Fetch error:", error);
        res.status(500).json({ message: "Failed to fetch tasks" });
    }
});

// Add a task
app.post("/api/tasks", async (req, res) => {
    try {
        const { title } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: "Task title is required"
            });
        }

        const [result] = await pool.execute(
            "INSERT INTO tasks (title) VALUES (?)",
            [title.trim()]
        );

        const [rows] = await pool.execute(
            "SELECT * FROM tasks WHERE id = ?",
            [result.insertId]
        );

        res.status(201).json({
            ...rows[0],
            completed: Boolean(rows[0].completed)
        });
    } catch (error) {
        console.error("Insert error:", error);
        res.status(500).json({ message: "Failed to add task" });
    }
});

// Update task completion
app.put("/api/tasks/:id", async (req, res) => {
    try {
        const taskId = Number(req.params.id);
        const { completed } = req.body;

        if (!Number.isInteger(taskId) || taskId <= 0) {
            return res.status(400).json({ message: "Invalid task ID" });
        }

        if (typeof completed !== "boolean") {
            return res.status(400).json({
                message: "Completed must be true or false"
            });
        }

        const [result] = await pool.execute(
            "UPDATE tasks SET completed = ? WHERE id = ?",
            [completed, taskId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        const [rows] = await pool.execute(
            "SELECT * FROM tasks WHERE id = ?",
            [taskId]
        );

        res.json({
            message: "Task updated successfully",
            task: {
                ...rows[0],
                completed: Boolean(rows[0].completed)
            }
        });
    } catch (error) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Failed to update task" });
    }
});

// Delete a task
app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const taskId = Number(req.params.id);

        if (!Number.isInteger(taskId) || taskId <= 0) {
            return res.status(400).json({ message: "Invalid task ID" });
        }

        const [result] = await pool.execute(
            "DELETE FROM tasks WHERE id = ?",
            [taskId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ message: "Failed to delete task" });
    }
});

// Start server after checking database connection
async function startServer() {
    try {
        const connection = await pool.getConnection();
        console.log("MySQL database connected successfully!");
        connection.release();

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("MySQL connection failed:", error.message);
        process.exit(1);
    }
}

startServer();
