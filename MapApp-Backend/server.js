const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Enable CORS for frontend
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// 2. Setup MySQL Database Connection
// We are using a pool for production readiness
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test the database connection upon launch
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('Successfully connected to the MySQL database.');
    connection.release();
  } catch (err) {
    console.error('CRITICAL: Failed to connect to the database:', err.message);
  }
})();

// 3. Basic Health Check Route (Required by Prompt)
app.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'Server is running',
      database: 'Connected'
    });
  } catch (err) {
    return res.status(500).json({
      status: 'Server is running',
      database: 'Disconnected',
      error: err.message
    });
  }
});

// Existing routes preserved for MapApp Frontend
app.get('/api/status', (req, res) => {
  res.json({ message: 'Server is alive!' });
});

app.get('/api/categories', (req, res) => {
  const categories = [
    { id: 1, name: 'Hostels', icon: 'fa-bed' },
    { id: 2, name: 'Computer Labs', icon: 'fa-desktop' },
    { id: 3, name: 'Professors', icon: 'fa-chalkboard-user' }
  ];
  res.json(categories);
});



// ==========================================
// 1. DYNAMIC CATEGORY ROUTE
// ==========================================
app.get('/api/categories/:categoryName', async (req, res) => {
  try {
    const { categoryName } = req.params;

    // Map frontend strings to exact database ENUMs
    const categoryMap = {
      'buildings': ['building'],
      'hostels': ['hostel'],
      'labs': ['lab'],
      'markets': ['shop'],
      'classrooms': ['classroom'],
      'washrooms': ['washroom'],
      'auditoriums': ['auditorium'],
      'offices': ['office'],
      'services': ['library', 'health_center', 'atm', 'gate', 'parking']
    };

    const locationTypes = categoryMap[categoryName.toLowerCase()];

    // If the category is not fully supported or misspelled, return 400 Bad Request
    if (!locationTypes) {
      return res.status(400).json({ error: 'Bad Request: Invalid category mapping.' });
    }

    // The mysql2 driver securely handles arrays passed into 'IN (?)' statements
    const query = 'SELECT * FROM campus_locations WHERE location_type IN (?)';
    const [rows] = await db.query(query, [locationTypes]);

    res.json(rows);
  } catch (error) {
    console.error('Database Error in GET /api/categories/:categoryName ->', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 2. SMART PROFESSORS ROUTE
// ==========================================
app.get('/api/professors', async (req, res) => {
  try {
    const query = `
            SELECT 
                u.full_name, 
                p.designation, 
                d.dept_name, 
                b.building_name, 
                b.latitude, 
                b.longitude 
            FROM professor_profiles p 
            JOIN users u ON p.user_id = u.user_id 
            LEFT JOIN departments d ON p.dept_id = d.dept_id 
            LEFT JOIN buildings b ON d.building_id = b.building_id 
            WHERE p.is_available = 1
        `;

    // No parameters needed since we are strictly filtering by 'is_available = 1'
    const [rows] = await db.query(query);

    res.json(rows);
  } catch (error) {
    console.error('Database Error in GET /api/professors ->', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
