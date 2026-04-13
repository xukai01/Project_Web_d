const db = require('./db.js');
(async () => {
    const [rows] = await db.query("SELECT location_name, ST_AsText(boundary) as bnd, ST_Y(ST_Centroid(ST_SRID(boundary, 0))) as lat, ST_X(ST_Centroid(ST_SRID(boundary, 0))) as lng FROM campus_locations WHERE location_type = 'building'");
    console.log(rows);
    process.exit(0);
})();
