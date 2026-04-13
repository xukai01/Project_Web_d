document.addEventListener("DOMContentLoaded", () => {

    // 1. Initialize the Ola Maps SDK
    const olaMaps = new OlaMaps({
        apiKey: '5W9Ss6Rd7OFwQ4ehIXshZCcci0sDpngDos1MOYe3'
    });

    // 2. Configure map settings (Defaulting to NIT Kurukshetra)
    const myMap = olaMaps.init({
        style: 'https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json',
        container: 'map',
        center: [76.9700, 29.3900], // NIT Kurukshetra coordinates (Lng, Lat)
        zoom: 16
    });

    // Expose map globally for admin extensions
    window.myMap = myMap;

    // Configurable Constraint Variables
    const MIN_ZOOM_LEVEL = 14;      // Controls how far out the user can zoom
    const MAX_BOUNDS_OFFSET = 0.03; // Radius in degrees (~3.3km) the user can drag away from their location

    // Global state for recenter functionality
    let currentUserLocation = [76.9700, 29.3900]; // Default to NIT Kurukshetra

    // 3. User Geolocation Logic (Deferred until map style is 100% loaded)
    myMap.on('load', () => {

        // --- MAP CLEANUP (Hide noisy POIs like shops while keeping cities/villages) ---
        // Dynamically grab all rendering layers from the Ola Maps engine
        const layers = myMap.getStyle().layers;
        layers.forEach(layer => {
            // Usually, specific businesses and generic places fall under 'poi' or 'point_of_interest' naming conventions
            const layerId = layer.id.toLowerCase();
            if (layerId.includes('poi') || layerId.includes('shop') || layerId.includes('transit_stop') || layerId.includes('amenity')) {
                myMap.setLayoutProperty(layer.id, 'visibility', 'none');
            }
        });

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLng = Number(position.coords.longitude);
                    const userLat = Number(position.coords.latitude);

                    if (!userLng || !userLat) {
                        console.warn("Invalid GPS coordinates received.");
                        return;
                    }

                    // Save location so Recenter button works globally
                    currentUserLocation = [userLng, userLat];

                    // Set strict map zooming limits around current view
                    myMap.setMinZoom(MIN_ZOOM_LEVEL);

                    // Restrict scrolling explicitly around the current user coordinates
                    const swBound = [userLng - MAX_BOUNDS_OFFSET, userLat - MAX_BOUNDS_OFFSET];
                    const neBound = [userLng + MAX_BOUNDS_OFFSET, userLat + MAX_BOUNDS_OFFSET];
                    myMap.setMaxBounds([swBound, neBound]);

                    // Fly the viewport seamlessly to the user coordinates
                    myMap.flyTo({
                        center: [userLng, userLat],
                        zoom: 16,
                        essential: true
                    });

                    // Add a default colored marker to avoid potential custom DOM element parse errors in Ola SDK
                    const marker = olaMaps.addMarker({ color: '#3b82f6' })
                        .setLngLat([userLng, userLat])
                        .addTo(myMap);
                },
                (error) => {
                    console.warn("Location check failed or was denied. Falling back to NIT Kurukshetra.", error);
                    // Set boundaries relative to NIT Kurukshetra fallback
                    myMap.setMinZoom(MIN_ZOOM_LEVEL);
                    const swBound = [76.9700 - MAX_BOUNDS_OFFSET, 29.3900 - MAX_BOUNDS_OFFSET];
                    const neBound = [76.9700 + MAX_BOUNDS_OFFSET, 29.3900 + MAX_BOUNDS_OFFSET];
                    myMap.setMaxBounds([swBound, neBound]);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000 
                }
            );
        } else {
            console.warn("Browser does not support navigator.geolocation.");
        }
    });

    // 4. Connect Recenter FAB Button
    const recenterBtn = document.querySelector('.recenter-btn');
    if (recenterBtn) {
        recenterBtn.addEventListener('click', () => {
            myMap.flyTo({
                center: currentUserLocation,
                zoom: 16,
                essential: true,
                duration: 1200 // smooth transition duration
            });
        });
    }
});
