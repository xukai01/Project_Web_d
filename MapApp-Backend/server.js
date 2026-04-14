const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ DATABASE CONNECTION
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

db.connect((err) => {
  if (err) {
    console.log("❌ DB connection failed:", err);
  } else {
    console.log("✅ Connected to Railway MySQL");
  }
});
// 1. Enable CORS for frontend
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());


const db = require('./db');


// 2. Setup MySQL Database Connection
// We are using a pool for production readiness
// const db = mysql.createPool({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// });





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
// 1. DYNAMIC CATEGORY ROUTE (Unified)
// ==========================================
app.get('/api/categories/:categoryName', async (req, res) => {
  try {
    const categoryName = req.params.categoryName.toLowerCase();

    // The Exception ('Professors')
    if (categoryName === 'professors') {
      const professorQuery = `
        SELECT 
            u.full_name, 
            u.email,
            p.designation, 
            d.dept_name,
            p.is_available
        FROM professor_profiles p 
        JOIN users u ON p.user_id = u.user_id 
        LEFT JOIN departments d ON p.dept_id = d.dept_id 
        WHERE u.user_type = 'professor'
      `;
      const [rows] = await db.query(professorQuery);
      return res.json(rows);
    }

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

    const locationTypes = categoryMap[categoryName];

    // If the category is not fully supported or misspelled, return 400 Bad Request
    if (!locationTypes) {
      return res.status(400).json({ error: 'Bad Request: Invalid category mapping.' });
    }

    // The SQL Query with spatial data and self-join
    const locationQuery = `
      SELECT 
        c.location_id,
        c.location_name,
        c.description,
        c.location_type,
        c.parent_location_id,
        ST_AsGeoJSON(c.boundary) AS geojson,
        c.latitude,
        c.longitude,
        p.location_name AS parent_location_name
      FROM campus_locations c
      LEFT JOIN campus_locations p ON c.parent_location_id = p.location_id
      WHERE c.location_type IN (?)
    `;

    const [rows] = await db.query(locationQuery, [locationTypes]);
    res.json(rows);

  } catch (error) {
    console.error('Database Error in GET /api/categories/:categoryName ->', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// const authRoutes = require('./routes/auth');
// app.use('/api/auth', authRoutes);
// ==========================================
// 3. ADMIN LOCATIONS ROUTE
// ==========================================
app.post('/api/locations', async (req, res) => {
  try {
    let { 
      location_name, description, location_type, 
      parent_location_id, floor_number, boundary, latitude, longitude 
    } = req.body;

    // Validate Required Fields
    if (!location_name || !location_type || !boundary) {
      return res.status(400).json({ error: 'Missing required fields: location_name, location_type, or boundary' });
    }

    // Sanitize optional inputs
    description = description || null;
    parent_location_id = parent_location_id || null;
    floor_number = floor_number === '' || floor_number === undefined ? null : Number(floor_number);
    latitude = latitude || null;
    longitude = longitude || null;

    // SQL Injection safe parameterized query using ST_GeomFromText for the polygon
    // Note: ST_GeomFromText(?, 4326) sets the spatial reference to match the column configuration
    const query = `
      INSERT INTO campus_locations 
        (location_name, description, location_type, parent_location_id, floor_number, boundary, latitude, longitude) 
      VALUES 
        (?, ?, ?, ?, ?, ST_GeomFromText(?, 4326), ?, ?)
    `;

    const [result] = await db.query(query, [
      location_name, description, location_type, 
      parent_location_id, floor_number, boundary, latitude, longitude
    ]);

    res.status(200).json({ 
      message: 'Location added successfully', 
      location_id: result.insertId 
    });

  } catch (error) {
    console.error('Database Error in POST /api/locations ->', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// ==========================================
// 4. SEARCH ROUTE
// ==========================================
app.get('/api/search', async (req, res) => {
  try {
    const keyword = req.query.q;
    if (!keyword) {
      return res.json([]);
    }

    const searchQuery = `
      SELECT 
        location_id, 
        location_name, 
        description, 
        location_type, 
        COALESCE(latitude, ST_X(ST_Centroid(ST_SRID(boundary, 0)))) AS latitude, 
        COALESCE(longitude, ST_Y(ST_Centroid(ST_SRID(boundary, 0)))) AS longitude 
      FROM campus_locations 
      WHERE 
        location_name LIKE ? OR 
        description LIKE ? OR 
        location_type LIKE ?
      LIMIT 10
    `;
    const searchString = `%${keyword}%`;
    const [rows] = await db.query(searchQuery, [searchString, searchString, searchString]);
    
    res.json(rows);
  } catch (error) {
    console.error('Database Error in GET /api/search ->', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const profileRoutes = require('./routes/profile');
app.use('/api/profile', profileRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
