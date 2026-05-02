require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100
});
app.use('/api/', limiter);

// CORS configuration - Allow multiple origins
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000').split(',');
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// Data validation
const validateTodo = (req, res, next) => {
  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
  }
  if (title.length > 200) {
    return res.status(400).json({ error: 'Title cannot exceed 200 characters' });
  }
  next();
};

// Data file path
const DATA_FILE = path.join(__dirname, process.env.DATA_DIR || 'data', 'todos.json');
const dataDir = path.join(__dirname, process.env.DATA_DIR || 'data');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data file
const initializeDataFile = () => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initialData = {
        todos: [
          { id: 1, title: 'Sample Todo 1', completed: 0, created_at: new Date().toISOString() },
          { id: 2, title: 'Sample Todo 2', completed: 1, created_at: new Date().toISOString() }
        ],
        nextId: 3
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
      console.log('Created todos.json with sample data');
    }
  } catch (error) {
    console.error('Error initializing data file:', error);
    process.exit(1);
  }
};

initializeDataFile();

// Helper functions
const readData = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    throw new Error('Failed to read data');
  }
};

const writeData = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data file:', error);
    throw new Error('Failed to write data');
  }
};

// API Routes
app.get('/api/todos', (req, res) => {
  try {
    const data = readData();
    const todos = data.todos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(todos);
  } catch (err) {
    console.error('Error fetching todos:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/todos', validateTodo, (req, res) => {
  const { title } = req.body;
  
  try {
    const data = readData();
    const newTodo = {
      id: data.nextId,
      title: title.trim(),
      completed: 0,
      created_at: new Date().toISOString()
    };
    data.todos.push(newTodo);
    data.nextId++;
    writeData(data);
    res.status(201).json(newTodo);
  } catch (err) {
    console.error('Error adding todo:', err);
    res.status(500).json({ error: 'Failed to add todo' });
  }
});

app.put('/api/todos/:id', (req, res) => {
  const { completed } = req.body;
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid todo ID' });
  }
  
  if (completed === undefined || (completed !== 0 && completed !== 1)) {
    return res.status(400).json({ error: 'Valid completed status (0 or 1) is required' });
  }
  
  try {
    const data = readData();
    const todoIndex = data.todos.findIndex(t => t.id === id);
    
    if (todoIndex === -1) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    data.todos[todoIndex].completed = completed;
    writeData(data);
    res.json(data.todos[todoIndex]);
  } catch (err) {
    console.error('Error updating todo:', err);
    res.status(500).json({ error: 'Failed to update todo' });
  }
});

app.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid todo ID' });
  }
  
  try {
    const data = readData();
    const todoIndex = data.todos.findIndex(t => t.id === id);
    
    if (todoIndex === -1) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    
    data.todos.splice(todoIndex, 1);
    writeData(data);
    res.json({ message: 'Deleted successfully', id: id });
  } catch (err) {
    console.error('Error deleting todo:', err);
    res.status(500).json({ error: 'Failed to delete todo' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running in ${NODE_ENV} mode on http://localhost:${PORT}`);
  console.log(`✅ Allowed CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`✅ API endpoints available at http://localhost:${PORT}/api`);
  console.log(`✅ Data stored in: ${DATA_FILE}`);
});