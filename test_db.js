const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mapapp'
  });

  const [rows] = await db.query(`
    SELECT location_id, location_name, 
           ST_AsText(boundary) as boundary, 
           ST_Y(ST_Centroid(boundary)) as lat_centroid,
           ST_X(ST_Centroid(boundary)) as lng_centroid
    FROM campus_locations 
    WHERE location_type = 'building'
  `);
  
  console.log(rows);
  await db.end();
})();
