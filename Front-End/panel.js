/* panel.js */
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('sp-global-overlay');

    // Generic function to open a panel by its ID
    window.openPanel = function(panelId) {
        if (!overlay) return;
        
        // Ensure any currently open panels are closed first
        window.closePanels();

        const panel = document.getElementById(panelId);
        if (panel) {
            overlay.classList.add('sp-active');
            panel.classList.add('sp-open');
        }
    };

    // Generic function to close all open panels and hide overlay
    window.closePanels = function() {
        if (overlay) {
            overlay.classList.remove('sp-active');
        }

        const openPanels = document.querySelectorAll('.sp-side-panel.sp-open');
        openPanels.forEach(panel => {
            panel.classList.remove('sp-open');
        });
    };

    // Global overlay click dismisses the panel
    if (overlay) {
        overlay.addEventListener('click', window.closePanels);
    }
    
    // Wire up all close buttons inside any panel
    const closeButtons = document.querySelectorAll('.sp-close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', window.closePanels);
    });
    // -------------------------------------------------------------
    // DATA RENDERING LOGIC (The Prefab)
    // -------------------------------------------------------------
    window.renderCategoryItems = function(dataArray, categoryName) {
        const container = document.getElementById('panel-content-list');
        if (!container) return;
        
        // Clear old list items so it starts fresh every time
        container.innerHTML = '';
        
        if (!dataArray || dataArray.length === 0) {
            container.innerHTML = `<div style="padding: 15px; color: #94a3b8; font-size: 0.9rem;">No items found for ${categoryName}.</div>`;
            return;
        }

        // Loop through data and generate prefab HTML
        dataArray.forEach(item => {
            // Determine name key. Ordinary locations use location_name, but professors use full_name.
            const displayName = categoryName.toLowerCase() === 'professors' 
                ? item.full_name 
                : item.location_name || item.name || 'Unknown Location';
                
            // Note: In an integrated app, we might also want to access item.latitude and item.longitude!
            const htmlString = `
                <div class="sp-item-prefab">
                    <div class="sp-item-icon">
                        <i class="fa-solid fa-location-dot"></i>
                    </div>
                    <div class="sp-item-text">
                        ${displayName}
                    </div>
                </div>
            `;
            
            container.insertAdjacentHTML('beforeend', htmlString);
        });
    };

    window.fetchCategoryData = async function(categoryName, clickedCard) {
        // We'll throw a quick "Loading..." state before data arrives
        const container = document.getElementById('panel-content-list');
        if (container) {
            // Dynamically move the container precisely below the clicked category!
            if (clickedCard) {
                clickedCard.insertAdjacentElement('afterend', container);
            }
            container.innerHTML = '<div style="padding: 15px; color: #38bdf8; font-size: 0.9rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>';
        }

        try {
            // Smart routing: if it's 'Professors', handle that special route
            const isProfessor = categoryName.toLowerCase() === 'professors';
            const endpoint = isProfessor 
                ? 'http://10.240.167.136:5000/api/professors' 
                : `http://10.240.167.136:5000/api/categories/${encodeURIComponent(categoryName.toLowerCase())}`;
                
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error("Failed to fetch data from API.");
            
            const data = await response.json();
            
            // Render the data into the UI!
            renderCategoryItems(data, categoryName);
            
        } catch (error) {
            console.error('Error fetching data:', error);
            if (container) {
                container.innerHTML = `<div style="padding: 15px; color: #ef4444; font-size: 0.9rem;">Error loading data.</div>`;
            }
        }
    };

    // Automatically wire up the category buttons in the Side Panel to run the fetch
    const spCategoryCards = document.querySelectorAll('.sp-category-card');
    spCategoryCards.forEach(card => {
        card.addEventListener('click', () => {
            const categoryNameElement = card.querySelector('.sp-category-name');
            if (categoryNameElement) {
                const categoryName = categoryNameElement.textContent.trim();
                window.fetchCategoryData(categoryName, card);
            }
        });
    });

});
