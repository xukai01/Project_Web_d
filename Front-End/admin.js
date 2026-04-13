(function initAdminMode() {
    // 1. Setup UI Elements
    const adminFab = document.createElement('button');
    adminFab.className = 'admin-create-fab';
    adminFab.innerHTML = '<i class="fa-solid fa-plus"></i> <span style="font-family: inherit; font-weight: bold; font-size: 1rem; margin-left: 8px;">Map Campus</span>';
    adminFab.title = 'Add New Location';
    
    const mainCol = document.getElementById('main-application-column') || document.body;
    mainCol.appendChild(adminFab);

    const form = document.getElementById('admin-location-form');
    const boundaryField = document.getElementById('admin-boundary');

    adminFab.addEventListener('click', () => {
        const panel = document.getElementById('side-panel-admin');
        if (panel) {
            panel.classList.add('sp-open');
        }
        document.body.classList.add('admin-draw-mode');
        adminFab.style.display = 'none';
    });

    const closeBtn = document.querySelector('#side-panel-admin .sp-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.body.classList.remove('admin-draw-mode');
            adminFab.style.display = 'flex';
        });
    }

    // 2. Mapbox Draw SDK Integration
    let draw;

    const initMapHooks = setInterval(() => {
        // Wait for both the map instance and the MapboxDraw library to be ready
        if (window.myMap && window.myMap.loaded() && typeof MapboxDraw !== 'undefined') {
            clearInterval(initMapHooks);
            setupDrawingLayer(window.myMap);
        }
    }, 500);

    function setupDrawingLayer(map) {
        // Initialize the Official Drawing Kit
        draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                trash: true
            },
            defaultMode: 'draw_polygon'
        });

        // Add drawing controls to the map UI (Positioned Top Left)
        map.addControl(draw, 'top-left');

        // Hook into Mapbox Draw Events to capture polygon state
        map.on('draw.create', updateBoundaryText);
        map.on('draw.update', updateBoundaryText);
        map.on('draw.delete', updateBoundaryText);
    }

    function updateBoundaryText() {
        if (!draw) return;
        const data = draw.getAll();
        
        if (data.features.length === 0) {
            boundaryField.value = '';
            return;
        }

        // We only care about the latest polygon drawn
        const feature = data.features[data.features.length - 1];

        // Format into WKT (Well Known Text): POLYGON((...))
        if(feature.geometry.type === 'Polygon') {
            const rings = feature.geometry.coordinates;
            // WKT format requires each ring to be joined: (lon lat, lon lat...)
            const wktRings = rings.map(ring => {
                const points = ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ');
                return `(${points})`;
            }).join(', ');

            boundaryField.value = `POLYGON(${wktRings})`;
        } else {
            boundaryField.value = "Error: Please draw a closed Polygon, not a line or point.";
        }
    }

    // 3. Form Submission API Integration
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!boundaryField.value.startsWith('POLYGON((')) {
            alert('Boundary must be a valid WKT POLYGON (Use the map tool)');
            return;
        }

        const payload = {
            location_name: document.getElementById('admin-loc-name').value,
            location_type: document.getElementById('admin-loc-type').value,
            parent_location_id: document.getElementById('parent-location-select').value || null,
            description: document.getElementById('description-input').value || null,
            floor_number: document.getElementById('admin-floor-no').value || null,
            boundary: boundaryField.value
        };

        try {
            const btn = form.querySelector('.admin-submit-btn');
            const originalText = btn.textContent;
            btn.textContent = "Saving...";
            btn.disabled = true;

            // Use localhost to avoid local network IP changes causing timeouts
            const API_BASE_URL = 'http://localhost:5000';
            
            const res = await fetch(`${API_BASE_URL}/api/locations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            
            if (res.ok) {
                alert('Success: Campus Location saved!');
                form.reset();
                if(draw) draw.deleteAll(); // Clear standard drawing kit bounds
                window.closePanels(); // Dismiss side panel
                document.body.classList.remove('admin-draw-mode');
                adminFab.style.display = 'flex';
            } else {
                alert('Error: ' + (data.error || 'Failed to save to database.'));
            }

            btn.textContent = originalText;
            btn.disabled = false;
        } catch (error) {
            console.error(error);
            alert('A network error occurred connecting to the backend.');
        }
    });

})();
