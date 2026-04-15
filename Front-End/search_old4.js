// import fs from 'fs';
// Extend Window interface for custom properties
/**
 * @typedef {Object} WindowExtension
 * @property {any} myMap
 * @property {number[]} currentLocation
 * @property {any} destinationMarker
 * @property {any} maplibregl
 */

/** @type {Window & {myMap: any, currentLocation: number[], destinationMarker: any, maplibregl: any}} */
const window_extended = window;

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('main-search-input');
    const searchResults = document.getElementById('search-results');
    const API_BASE_URL = 'https://projectcode-production.up.railway.app'; // Match other files
    const OLA_MAPS_API_KEY = '5W9Ss6Rd7OFwQ4ehIXshZCcci0sDpngDos1MOYe3'; // from map.js

    // Debounce wrapper
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // 1. Search DB Logic
    const handleSearch = async (e) => {
        const query = e.target.value.trim();

        if (query.length === 0) {
            searchResults.style.display = 'none';
            searchResults.innerHTML = '';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
            const results = await response.json();
            // fs.writeFileSync('search_results.json', JSON.stringify(results, null, 2)); // Debug: log search results to file
            console.log("Search results:", results); // Debug log
            searchResults.innerHTML = '';
            
            if (results.length === 0) {
                const li = document.createElement('li');
                li.innerHTML = '<span class="search-result-title">No locations found</span>';
                li.style.cursor = 'default';
                searchResults.appendChild(li);
            } else {
                results.forEach(loc => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="search-result-title"><i class="fa-solid fa-location-dot" style="margin-right: 8px;"></i>${loc.location_name}</span>
                        <span class="search-result-subtitle">${loc.location_type || 'Campus Location'}</span>
                    `;
                    
                    li.addEventListener('click', () => {
                        searchInput.value = loc.location_name;
                        searchResults.style.display = 'none';

                        drawRouteToTarget(loc.longitude, loc.latitude, loc);
                    });
                    
                    searchResults.appendChild(li);
                });
            }
            searchResults.style.display = 'block';

        } catch (error) {
            console.error("Search API failed:", error);
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const firstResult = searchResults.querySelector('li');

        if (firstResult) {
            firstResult.click(); // triggers route
        }
    }
});

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (searchInput && searchResults && !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Simple decoder for standard encoded polylines
    function decodePolyline(str, precision) {
        let index = 0, lat = 0, lng = 0, coordinates = [], shift, result, byte;
        let factor = Math.pow(10, precision || 5);
        while (index < str.length) {
            byte = null; shift = 0; result = 0;
            do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
            let latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
            shift = result = 0;
            do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
            let longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += latitude_change; lng += longitude_change;
            coordinates.push([lng / factor, lat / factor]);
        }
        return coordinates;
    }

    function getMarkerIcon(loc) {
        const type = (loc.location_type || '').toLowerCase();
        const name = (loc.location_name || '').toLowerCase();

        if (type.includes('building') || name.includes('block')) {
            return '/assets/icons/https://imgs.search.brave.com/NZ_EWeat6nplfdM7pNRa476cWO61GMcNjXFeX-W4utc/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZy/ZWVwaWsuY29tLzI1/Ni8xMTY1MS8xMTY1/MTU5OC5wbmc';
        }

        if (type.includes('health') || name.includes('clinic') || name.includes('hospital')) {
            return 'https://imgs.search.brave.com/EfNNetxUmO_PMlkm1EyrtT--zXMOQFrvNyp_NEYx3iU/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS81/MTIvNDAwMy80MDAz/ODMzLnBuZw';
        }

        if (type.includes('hostel')) {
            return 'https://imgs.search.brave.com/Yhh-lVymS2SmzRMVnOyh2HToF0Cb049sUaj6IWZ7WPI/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wMjEv/NDIxLzU1MS9zbWFs/bC9ob3N0ZWwtaWNv/bi1mcmVlLXZlY3Rv/ci5qcGc';
        }

        if (type.includes('library')) {
            return 'https://imgs.search.brave.com/BRI4n00z8Q1E0Tw_LUwq-9bqHYNyq0DD9DfaXU4bz3s/rs:fit:0:180:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS8x/MjgvMTY2OS8xNjY5/NjUyLnBuZw';
        }

        if (type.includes('parking')) {
            return 'https://imgs.search.brave.com/Nm0dQthtYf5rJCg1K-4t3peuZakEw-gyJRwP-1Sa10Q/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS81/MTIvMjM1LzIzNTgw/OS5wbmc';
        }

        if (type.includes('professor') || type.includes('faculty')) {
            return 'https://imgs.search.brave.com/H9wKd1tYtYcm2NnAgQh1k8ZJ2ASmakMWowMsGTwEztA/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS81/MTIvMTMzOC8xMzM4/MDQxLnBuZw';
        }

        if (type.includes('market') || type.includes('shop')) {
            return 'https://imgs.search.brave.com/3tk4Kkit9dQtSekpIQfFX5A3zr03p00E0puFPsehaXE/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS81/MTIvNDQzNy80NDM3/NjU0LnBuZw';
        }

        if (type.includes('washroom') || type.includes('toilet')) {
            return 'https://imgs.search.brave.com/prCvgfqYGzRSmvSvJlXpbQUk8vLTuRrUFaqoQfLcCR4/rs:fit:0:180:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS8x/MjgvNDkwNi80OTA2/NTEzLnBuZw';
        }

        if (type.includes('atm') || type.includes('bank')) {
            return 'https://imgs.search.brave.com/4Wnp3X8vexBh6Dmuh1ryDxZOS3iB5_Wt1Y0qpQW_s7c/rs:fit:0:180:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS8x/MjgvNjEzOS82MTM5/NzA2LnBuZw';
        }

        if (type.includes('class')|| type.includes('lab') ) {
            return 'https://imgs.search.brave.com/QR6isfACJ63OPSU1krSnIVs2qVnA1TpjcGelVaIU97A/rs:fit:0:180:1:0/g:ce/aHR0cHM6Ly9jZG4t/aWNvbnMtcG5nLmZs/YXRpY29uLmNvbS8x/MjgvMTY4MTEvMTY4/MTE1NDEucG5n';
        }

        if(type.includes('auditorium') || type.includes('hall')) {
            return 'https://imgs.search.brave.com/Kf9VySHDYNBy--7OQWUAEv9sukvqmGArv3P0veyPClY/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9zdGF0/aWMudmVjdGVlenku/Y29tL3N5c3RlbS9y/ZXNvdXJjZXMvdGh1/bWJuYWlscy8wNTcv/MDc2LzM5Ni9zbWFs/bC9tb2Rlcm4tYXVk/aXRvcml1bS1pY29u/LWZvci10aGVhdHJp/Y2FsLXBlcmZvcm1h/bmNlcy12ZWN0b3Iu/anBn';
        }
        return 'https://imgs.search.brave.com/_i4LiUUAUxNwS4H6ieozEVL0XZa8V3P5Ej0By1VcEyY/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4u/aWNvbnNjb3V0LmNv/bS9pY29uL3ByZW1p/dW0vcG5nLTI1Ni10/aHVtYi9lcnJvci1z/aWduLWljb24tc3Zn/LWRvd25sb2FkLXBu/Zy0xMzUwNDE4Mi5w/bmc_Zj13ZWJwJnc9/MTI4'; // fallback
    }

    // 2. Map Routing / Navigation Logic
    async function drawRouteToTarget(destLng, destLat, loc) {
        if (!window_extended.myMap) {
            console.error("Map is not initialized globally (window.myMap).");
            return;
        }
        if (!destLng || !destLat) {
            alert("This location does not have precise GPS coordinates to route to.");
            return;
        }
        
        let originLnt, originLat;
        if (window.currentLocation && window.currentLocation.length === 2) {
            [originLnt, originLat] = window.currentLocation;
        } else {
            console.error("User location is not globally tracked yet.");
            alert("Still acquiring GPS signal. Please wait or check your permissions.");
            return;
        }

        const origin = `${originLat},${originLnt}`; // Ola Maps API natively uses lat,lng format
        const destination = `${destLat},${destLng}`;
        
        try {
            const url = `https://api.olamaps.io/routing/v1/directions?origin=${origin}&destination=${destination}&api_key=${OLA_MAPS_API_KEY}`;
            const res = await fetch(url, {
                method: "POST" // Specifying POST per Ola Map SDK general guidelines, fetching directions avoids thick param stacks
            }); 
            
            // Wait, standard HTTP for Ola Maps Directions API is POST according to explicit Ola Docs for /routing/v1/directions
            const data = await res.json();
            
            let coordinates = [];
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                if (typeof route.overview_polyline === 'string') {
                    coordinates = decodePolyline(route.overview_polyline, 5);
                } else if (route.geometry) {
                    if (typeof route.geometry === 'string') {
                        coordinates = decodePolyline(route.geometry, 6);
                    } else if (route.geometry.coordinates) {
                        coordinates = route.geometry.coordinates; // Pure GeoJSON
                    }
                } else if (route.overview_polyline && route.overview_polyline.points) {
                    coordinates = decodePolyline(route.overview_polyline.points, 5); 
                }
            }
            
            if (coordinates.length === 0) {
                console.warn("Could not parse route geometry. Drawing straight line as fallback.");
                coordinates = [[originLnt, originLat], [destLng, destLat]];
            }

            // ================================
            // 🔥 DOTTED LINE (user → road)
            // ================================
            // 🔥 CURVED PATH (adds a midpoint for smooth effect)
const snappedRoadPoint = coordinates[0];




// create slight curve using midpoint offset
const midLng = (originLnt + snappedRoadPoint[0]) / 2;
const midLat = (originLat + snappedRoadPoint[1]) / 2 + 0.00005; // tweak curve strength here

const dottedGeoJSON = {
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: [
            [originLnt, originLat],
            [midLng, midLat],        // 👈 curve point
            snappedRoadPoint
        ]
    }
};

            // Remove old dotted line if exists
            if (window_extended.myMap.getSource('dotted-src')) {
                window_extended.myMap.removeLayer('dotted-layer');
                window_extended.myMap.removeSource('dotted-src');
            }

            // Add dotted line
            window_extended.myMap.addSource('dotted-src', {
                type: 'geojson',
                data: dottedGeoJSON
            });

            window_extended.myMap.addLayer({
                id: 'dotted-layer',
                type: 'line',
                source: 'dotted-src',
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round'
                },
                paint: {
                    'line-color': '#2563eb',
                    'line-width': 4,
                    'line-dasharray': [0.5, 2]
                }
            });


            const geoJsonData = {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                }
            };

            // Render route path
            if (window_extended.myMap.getSource('route-src')) {
                window_extended.myMap.getSource('route-src').setData(geoJsonData);
            } else {
                window_extended.myMap.addSource('route-src', {
                    type: 'geojson',
                    data: geoJsonData
                });

                window_extended.myMap.addLayer({
                    id: 'route-layer',
                    type: 'line',
                    source: 'route-src',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#2563eb', // Distinctive vivid blue color
                        'line-width': 6,
                        'line-opacity': 0.85
                    }
                });
            }

           // ================================
// 🔥 DOTTED LINE (road → destination)
// ================================
const lastRoadPoint = coordinates[coordinates.length - 1];

// create slight curve near destination
const midLng2 = (destLng + lastRoadPoint[0]) / 2;
const midLat2 = (destLat + lastRoadPoint[1]) / 2 + 0.00005;

const dottedDestGeoJSON = {
    type: 'Feature',
    geometry: {
        type: 'LineString',
        coordinates: [
            lastRoadPoint,
            [midLng2, midLat2],   // 👈 curve
            [destLng, destLat]
        ]
    }
};

// Remove old destination dotted if exists
if (window_extended.myMap.getSource('dotted-dest-src')) {
    window_extended.myMap.removeLayer('dotted-dest-layer');
    window_extended.myMap.removeSource('dotted-dest-src');
}

// Add destination dotted line
window_extended.myMap.addSource('dotted-dest-src', {
    type: 'geojson',
    data: dottedDestGeoJSON
});

window_extended.myMap.addLayer({
    id: 'dotted-dest-layer',
    type: 'line',
    source: 'dotted-dest-src',
    layout: {
        'line-cap': 'round',
        'line-join': 'round'
    },
    paint: {
        'line-color': '#2563eb',
        'line-width': 4,
        'line-dasharray': [0.5, 2]
    }
}); 

            // Calculate Box to fit view over the generated route
            let minLng = Math.min(originLnt, destLng);
            let maxLng = Math.max(originLnt, destLng);
            let minLat = Math.min(originLat, destLat);
            let maxLat = Math.max(originLat, destLat);
            
            coordinates.forEach(coord => {
                minLng = Math.min(minLng, coord[0]);
                maxLng = Math.max(maxLng, coord[0]);
                minLat = Math.min(minLat, coord[1]);
                maxLat = Math.max(maxLat, coord[1]);
            });

            window_extended.myMap.fitBounds(
                [
                    [minLng, minLat],
                    [maxLng, maxLat]  
                ],
                { padding: { top: 150, bottom: 250, left: 100, right: 100 }, duration: 1500 }
            );

            // ================================
            // 🔥 DESTINATION MARKER (FIXED)
            // ================================

            // Remove old marker if exists
            if (window.destinationMarker) {
                window.destinationMarker.remove();
                window.destinationMarker = null;
            }

            const iconSrc = getMarkerIcon(loc);

            const markerDiv = document.createElement('div');
            markerDiv.style.width = '40px';
            markerDiv.style.height = '40px';

            const img = document.createElement('img');
            img.src = iconSrc;
            img.style.width = '40px';
            img.style.height = '40px';
            img.style.objectFit = 'contain';
            img.style.filter = 'drop-shadow(0px 3px 6px rgba(0,0,0,0.4))';

            // Log error if icon fails to load
            img.onerror = () => {
                console.error('❌ Icon failed to load:', img.src);
                img.src = 'https://imgs.search.brave.com/_i4LiUUAUxNwS4H6ieozEVL0XZa8V3P5Ej0By1VcEyY/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9jZG4u/aWNvbnNjb3V0LmNv/bS9pY29uL3ByZW1p/dW0vcG5nLTI1Ni10/aHVtYi9lcnJvci1z/aWduLWljb24tc3Zn/LWRvd25sb2FkLXBu/Zy0xMzUwNDE4Mi5w/bmc_Zj13ZWJwJnc9/MTI4';
            };

            markerDiv.appendChild(img);

            if (window_extended.maplibregl) {
                window_extended.destinationMarker = new window_extended.maplibregl.Marker({
                    element: markerDiv,
                    anchor: 'bottom'  // ✅ Let MapLibre handle positioning — removed manual transform
                })
                .setLngLat([destLng, destLat])
                .addTo(window_extended.myMap);
            } else {
                console.error('❌ window.maplibregl is not defined! Cannot place destination marker.');
            }

        } catch (err) {
            console.error("Routing failed:", err);
            alert("Could not fetch directions. Note: Some Ola API configurations require POST on specific URLs, if this consistently fails consider falling back to drawn polylines.");
        }
    }
});
