const API_BASE_URL = 'https://projectcode-production.up.railway.app'; // Change to live cloud URL when deployed to production (e.g., Vercel)

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. STATE MANAGEMENT (The "Fake Database")
  // This is the exact object you will send to the backend later.
  let weekData = {
    Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: []
  };
  let eventData = {
    'Oct 12': [], 'Oct 14': [], 'Oct 15': [], 'Oct 20': []
  };
  let currentMode = 'schedule'; // 'schedule' or 'events'
  let currentDay = 'Monday';
  let isEditMode = false;
  let draftData = {};

  // --- INITIAL LOAD LOGIC ---
  async function loadTimetable() {
      const userStr = localStorage.getItem('user');
      if (!userStr) return;
      const currentUser = JSON.parse(userStr);

      try {
          const res = await fetch(`${API_BASE_URL}/api/schedules?user_id=${currentUser.user_id}`);
          if (!res.ok) throw new Error('Failed to load schedules');
          const schedules = await res.json();

          // Reset the weekData to prevent duplication on multiple loads
          weekData = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };

          schedules.forEach(sched => {
              if (weekData[sched.day_of_week]) {
                  weekData[sched.day_of_week].push({
                      subject: sched.title,
                      location: sched.location_id,
                      location_name: sched.location_name,
                      // MySQL TIME often returns HH:MM:SS format; we trim to HH:MM for input compatibility
                      start: sched.start_time ? sched.start_time.substring(0, 5) : '',
                      end: sched.end_time ? sched.end_time.substring(0, 5) : ''
                  });
              }
          });
          
          // Force a re-render of the currently active view
          if (!isEditMode && currentMode === 'schedule') {
             renderTrack();
          }
      } catch (err) {
          console.error("Error loading timetable during UI initialization:", err);
      }
  }

  loadTimetable();

  const track = document.getElementById('schedule-track');
  const tabsContainer = document.getElementById('weekday-tabs');
  const editBtn = document.getElementById('edit-mode-btn');
  const createBtn = document.getElementById('create-new-btn');
  const exitEditBtn = document.getElementById('exit-edit-btn');
  const saveBtn = document.getElementById('save-btn');
  const emptyStateWrapper = document.getElementById('create-empty-state');
  const bsHeader = document.getElementById('bottom-sheet-header');
  const topRow = document.getElementById('header-top-row');
  const horizontalBuilderWrapper = document.querySelector('.horizontal-builder-wrapper');

  // Peek Mode and Panel Click logic
  function handlePanelClick(e) {
    // Prevent action if the user clicks a tab or functional button
    if (e.target.closest('button')) return;
    
    // If user clicks the panel while it's in peek mode, make it fully visible
    if (horizontalBuilderWrapper.classList.contains('peek-mode')) {
      horizontalBuilderWrapper.classList.remove('peek-mode');
      // Restore visually selected state to the active button
      if (currentMode === 'schedule') toggleSchedule.checked = true;
      if (currentMode === 'events') toggleEvents.checked = true;
    }
  }

  bsHeader.addEventListener('click', handlePanelClick);
  topRow.addEventListener('click', handlePanelClick);

  function startEditing() {
    isEditMode = true;
    draftData = JSON.parse(JSON.stringify(currentMode === 'schedule' ? weekData : eventData));
    setupTabs();
    renderTrack();
  }

  // 2. INITIALIZE APP
  const toggleSchedule = document.getElementById('toggle-schedule');
  const toggleEvents = document.getElementById('toggle-events');

  toggleSchedule.addEventListener('click', (e) => {
    if (currentMode === 'schedule' && !horizontalBuilderWrapper.classList.contains('peek-mode')) {
      // Toggle to peek mode and visually unselect
      horizontalBuilderWrapper.classList.add('peek-mode');
      setTimeout(() => toggleSchedule.checked = false, 0); 
    } else {
      // Select schedule and open 100%
      currentMode = 'schedule';
      isEditMode = false;
      horizontalBuilderWrapper.classList.remove('peek-mode');
      toggleSchedule.checked = true; // Ensure it's visually selected
      setupTabs();
      renderTrack();
    }
  });

  toggleEvents.addEventListener('click', (e) => {
    if (currentMode === 'events' && !horizontalBuilderWrapper.classList.contains('peek-mode')) {
      // Toggle to peek mode and visually unselect
      horizontalBuilderWrapper.classList.add('peek-mode');
      setTimeout(() => toggleEvents.checked = false, 0); 
    } else {
      // Select events and open 100%
      currentMode = 'events';
      isEditMode = false;
      horizontalBuilderWrapper.classList.remove('peek-mode');
      toggleEvents.checked = true; // Ensure it's visually selected
      setupTabs();
      renderTrack();
    }
  });

  setupTabs();
  renderTrack();

  function setupTabs() {
    tabsContainer.innerHTML = '';
    const dataSource = isEditMode ? draftData : (currentMode === 'schedule' ? weekData : eventData);
    const items = Object.keys(dataSource);
    
    if (!items.includes(currentDay)) {
       currentDay = items[0];
    }

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = `day-tab ${item === currentDay ? 'active' : ''}`;
      btn.textContent = item;
      btn.addEventListener('click', () => {
        if(isEditMode) saveCurrentInputsToState(); // Saves to draftData for current tab
        currentDay = item;
        updateActiveTab();
        renderTrack();
      });
      tabsContainer.appendChild(btn);
    });
  }

  function updateActiveTab() {
    document.querySelectorAll('.day-tab').forEach(tab => {
      tab.classList.toggle('active', tab.textContent === currentDay);
    });
  }

  // 3. RENDER LOGIC (Draws the cards based on state)
  function renderTrack() {
    track.innerHTML = ''; // Clear track
    
    const addActionBtn = document.querySelector('.add-action-btn');
    if (addActionBtn) {
       addActionBtn.style.display = currentMode === 'events' ? 'flex' : 'none';
    }
    
    const masterData = currentMode === 'schedule' ? weekData : eventData;
    const dataObj = isEditMode ? draftData : masterData;
    const todayClasses = dataObj[currentDay];

    const hasAnySchedule = Object.values(masterData).some(arr => arr.length > 0);

    // Empty vs Exists global view state - ONLY for schedule
    if (currentMode === 'schedule' && !hasAnySchedule && !isEditMode) {
      bsHeader.style.display = 'none';
      topRow.style.display = 'none';
      track.style.display = 'none';
      emptyStateWrapper.style.display = 'flex';
      return;
    } else {
      bsHeader.style.display = 'flex';
      topRow.style.display = 'flex';
      track.style.display = 'flex';
      emptyStateWrapper.style.display = 'none';
    }

    // Header buttons state
    if (currentMode === 'events') {
      editBtn.style.display = 'none';
      exitEditBtn.style.display = 'none';
      saveBtn.style.display = 'none';
    } else {
      if (isEditMode) {
        editBtn.style.display = 'none';
        exitEditBtn.style.display = 'flex';
        saveBtn.style.display = 'block';
      } else {
        editBtn.style.display = 'flex';
        exitEditBtn.style.display = 'none';
        saveBtn.style.display = 'none';
      }
    }

    if (currentMode === 'events') {
       // --- EVENTS MODE ---
       if (!todayClasses || todayClasses.length === 0) {
         track.innerHTML = `<p style="color:#94a3b8; padding: 20px;">No events for ${currentDay}.</p>`;
       } else {
         todayClasses.forEach((evt, index) => track.appendChild(createEventViewCard(evt, index)));
       }
    } else {
       // --- SCHEDULE MODE ---
       if (isEditMode) {
         // --- EDIT MODE: Draw Input Cards ---
         if (todayClasses) {
           todayClasses.forEach((cls, index) => track.appendChild(createEditCard(cls, index)));
         }
         track.appendChild(createAddButtonCard());
       } else {
         // --- VIEW MODE: Draw Selectable Text Cards ---
         if (!todayClasses || todayClasses.length === 0) {
           track.innerHTML = `<p style="color:#94a3b8; padding: 20px;">No items for ${currentDay}.</p>`;
         } else {
           todayClasses.forEach((cls, index) => track.appendChild(createViewCard(cls, index)));
         }
       }
    }
  }

  // 4. CARD CREATORS
  function createEditCard(data = {}, index = null) {
    const card = document.createElement('div');
    card.className = 'class-frame';
    card.innerHTML = `
      <div class="frame-header">
        <button class="icon-btn refresh"><i class="fa-solid fa-rotate-right"></i></button>
        <span>Class ${index !== null ? index + 1 : ''}</span>
        <button class="icon-btn delete"><i class="fa-solid fa-trash"></i></button>
      </div>
      <div class="frame-body">
        <input type="text" class="frame-input subject-val" placeholder="Subject" value="${data.subject || ''}">
        <div style="position: relative; width: 100%;">
            <input type="text" class="frame-input location-search-input" placeholder="Search location..." value="${data.location_name || ''}">
            <input type="hidden" class="location-id-input location-val" value="${data.location || ''}">
            <ul class="location-suggestions" style="display:none; position:absolute; z-index: 100; background: #0f172a; border: 1px solid #334155; width: 100%; max-height: 150px; overflow-y: auto; list-style: none; padding: 0; margin: 0; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);"></ul>
        </div>
        <div class="time-row">
          <input type="time" class="frame-input start-val" value="${data.start || ''}">
          <input type="time" class="frame-input end-val" value="${data.end || ''}">
        </div>
      </div>
    `;

    // Edit Mode Event Listeners
    card.querySelector('.delete').addEventListener('click', () => { card.remove(); });
    card.querySelector('.refresh').addEventListener('click', () => {
      card.querySelectorAll('input').forEach(input => input.value = '');
    });
    
    // Autocomplete Logic
    const searchInput = card.querySelector('.location-search-input');
    const idInput = card.querySelector('.location-id-input');
    const suggestionsUl = card.querySelector('.location-suggestions');
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        // Clear hidden ID if user starts typing something new
        idInput.value = '';

        if (!query) {
            suggestionsUl.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error('Search failed');
                const results = await res.json();
                
                suggestionsUl.innerHTML = '';
                if (results.length === 0) {
                    suggestionsUl.style.display = 'none';
                    return;
                }
                
                // Show top 2 results
                const topResults = results.slice(0, 2);
                topResults.forEach(item => {
                    const li = document.createElement('li');
                    li.style.padding = '8px 12px';
                    li.style.cursor = 'pointer';
                    li.style.borderBottom = '1px solid #1e293b';
                    li.style.color = '#f8fafc';
                    li.innerHTML = `<strong>${item.location_name}</strong> <span style="font-size:0.75rem; color:#94a3b8;">(${item.location_type})</span>`;
                    
                    li.addEventListener('mouseenter', () => { li.style.background = '#1e293b'; });
                    li.addEventListener('mouseleave', () => { li.style.background = 'transparent'; });
                    
                    // Crucial: Click handling updates visible and hidden inputs
                    li.addEventListener('click', () => {
                        searchInput.value = item.location_name;
                        idInput.value = item.location_id;
                        suggestionsUl.style.display = 'none';
                    });
                    
                    suggestionsUl.appendChild(li);
                });
                
                suggestionsUl.style.display = 'block';

            } catch (err) {
                console.error("Autocomplete error:", err);
            }
        }, 300);
    });

    // Hide dropdown if clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsUl.contains(e.target)) {
            suggestionsUl.style.display = 'none';
        }
    });

    return card;
  }

  function createViewCard(data, index) {
    const card = document.createElement('div');
    card.className = 'class-frame view-mode'; // Notice the view-mode class
    card.innerHTML = `
      <div class="frame-header">
        <span><i class="fa-solid fa-book"></i> Class ${index + 1}</span>
      </div>
      <div class="frame-body">
        <span class="view-text"><strong>${data.subject}</strong></span>
        <span class="view-text"><i class="fa-solid fa-location-dot"></i> ${data.location_name || 'Missing Location'}</span>
        <span class="view-time"><i class="fa-regular fa-clock"></i> ${data.start} - ${data.end}</span>
      </div>
    `;

    // Make it act like a radio button
    card.addEventListener('click', () => {
      document.querySelectorAll('.class-frame').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      // Trigger your map navigation here!
      console.log("Navigate to:", data.location); 
    });
    return card;
  }

  function createEventViewCard(data, index) {
    const card = document.createElement('div');
    card.className = 'class-frame view-mode'; 
    card.style.minWidth = '250px';
    card.innerHTML = `
      <div class="frame-body" style="gap: 5px;">
        <span class="view-text" style="white-space: pre-wrap; font-size: 1rem;">${data.text}</span>
        <span class="view-time" style="margin-top: 10px; color: var(--primary-color); font-weight: bold;">- ${data.author || 'User'}</span>
      </div>
    `;
    return card;
  }

  function createEventInputCard() {
    const card = document.createElement('div');
    card.className = 'class-frame';
    card.style.minWidth = '250px';
    card.innerHTML = `
      <div class="frame-body">
        <textarea class="frame-input event-text-val" placeholder="What's happening?" rows="3" style="resize: none; font-family: inherit; margin-bottom: 10px;"></textarea>
        <button class="save-schedule-btn post-event-btn" style="width: 100%;">Post Event</button>
      </div>
    `;

    card.querySelector('.post-event-btn').addEventListener('click', () => {
      const text = card.querySelector('.event-text-val').value.trim();
      if (text) {
         if (!eventData[currentDay]) eventData[currentDay] = [];
         eventData[currentDay].push({ text: text, author: 'Current User' });
         renderTrack();
      } else {
         card.remove();
         renderTrack(); // refresh if it was empty track before
      }
    });
    return card;
  }

  function createAddButtonCard() {
    const btn = document.createElement('div');
    btn.className = 'add-class-card';
    btn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    btn.addEventListener('click', () => {
      track.insertBefore(createEditCard(), btn);
      track.scrollLeft = track.scrollWidth;
    });
    return btn;
  }

  // 5. DATA SAVING
  function saveCurrentInputsToState() {
    const newClasses = [];
    document.querySelectorAll('.class-frame:not(.add-class-card)').forEach(card => {
      const subject = card.querySelector('.subject-val').value;
      if (subject) { // Only save if they typed a subject
        const rawLoc = card.querySelector('.location-val').value;
        const parsedLoc = parseInt(rawLoc, 10);
        
        newClasses.push({
          subject: subject,
          location: isNaN(parsedLoc) ? "" : parsedLoc, // Int or ""
          location_name: card.querySelector('.location-search-input').value,
          start: card.querySelector('.start-val').value,
          end: card.querySelector('.end-val').value
        });
      }
    });

    if (isEditMode) {
        draftData[currentDay] = newClasses;
    } else {
        const dataObj = currentMode === 'schedule' ? weekData : eventData;
        dataObj[currentDay] = newClasses;
    }
  }

  // 6. ACTION BUTTON LISTENERS
  editBtn.addEventListener('click', () => {
    startEditing();
  });

  createBtn.addEventListener('click', () => {
    startEditing();
    if(draftData[currentDay] && draftData[currentDay].length === 0) {
       track.insertBefore(createEditCard(), document.querySelector('.add-class-card'));
       track.scrollLeft = track.scrollWidth;
    }
  });

  exitEditBtn.addEventListener('click', () => {
    isEditMode = false;
    setupTabs();
    renderTrack();
  });

  saveBtn.addEventListener('click', async () => {
    saveCurrentInputsToState(); // Saves last focused tab to draftData
    
    // --- VALIDATION STEP ---
    if (currentMode === 'schedule') {
        let hasError = false;
        for (const [day, classes] of Object.entries(draftData)) {
            for (const cls of classes) {
                if (!cls.location || !cls.start || !cls.end) {
                    hasError = true;
                    break;
                }
            }
            if (hasError) break;
        }

        if (hasError) {
            alert('Please fill all required fields (Location, Start Time, End Time) for your classes before saving.');
            return; // Halt the entire save process
        }
    }
    
    if (currentMode === 'schedule') {
        weekData = JSON.parse(JSON.stringify(draftData));
    } else {
        eventData = JSON.parse(JSON.stringify(draftData));
    }
    isEditMode = false;
    setupTabs();
    renderTrack();
    
    // Handle saving Schedules to backend
    if (currentMode === 'schedule') {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            alert('Cannot save: User is not logged in.');
            return;
        }
        const currentUser = JSON.parse(userStr);

        // Flatten the week object into an array with day_of_week
        const flatSchedules = [];
        for (const [day, classes] of Object.entries(weekData)) {
            classes.forEach(cls => {
                flatSchedules.push({
                    day_of_week: day,
                    title: cls.subject, // Map subject to title
                    // Convert empty strings to null (as an extra safety measure)
                    location_id: cls.location === "" ? null : cls.location,
                    start_time: cls.start === "" ? null : cls.start,
                    end_time: cls.end === "" ? null : cls.end
                });
            });
        }

        try {
            saveBtn.textContent = 'Saving...';
            const res = await fetch(`${API_BASE_URL}/api/schedules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.user_id,
                    schedules: flatSchedules
                })
            });

            if (!res.ok) throw new Error('Failed to save schedules');
            
            saveBtn.textContent = 'Save Changes';
            console.log("Timetable saved to Database:", flatSchedules);
            
        } catch (error) {
            console.error('Error:', error);
            saveBtn.textContent = 'Save Changes';
            alert('An error occurred while saving the schedule.');
        }
    } else {
        // Fallback for events (not mapped to DB in this prompt yet)
        console.log("Events saved locally", eventData);
    }
  });

  // 7. FAB LISTENERS
  const recenterBtn = document.querySelector('.recenter-btn');
  const addActionBtn = document.querySelector('.add-action-btn');

  if (recenterBtn) {
    // The click logic is now fully handled in map.js!
  }

  if (addActionBtn) {
    addActionBtn.addEventListener('click', () => {
        if (currentMode === 'events') {
           // Provide an input card for events if one doesn't exist already
           const existingInput = document.querySelector('.event-text-val');
           if (existingInput) {
               existingInput.focus();
               return;
           }
           const inputCard = createEventInputCard();
           // Remove "No events" text if it's there
           const p = track.querySelector('p');
           if (p) p.remove();
           
           track.prepend(inputCard);
           track.scrollLeft = 0;
           return;
        }

        if (!isEditMode) {
           if (emptyStateWrapper.style.display !== 'none') {
               createBtn.click();
           } else {
               editBtn.click();
               setTimeout(() => {
                   const addCard = document.querySelector('.add-class-card');
                   if (addCard) {
                       track.insertBefore(createEditCard(), addCard);
                       track.scrollLeft = track.scrollWidth;
                   }
               }, 50);
           }
        } else {
           const addCard = document.querySelector('.add-class-card');
           if (addCard) {
               track.insertBefore(createEditCard(), addCard);
               track.scrollLeft = track.scrollWidth;
           }
        }
    });
  }
  
  const profToggle = document.getElementById('prof-toggle');
  if (profToggle) {
     profToggle.addEventListener('change', (e) => {
         const text = e.target.parentElement.querySelector('.status-text');
         if (e.target.checked) {
            text.textContent = 'Busy';
         } else {
            text.textContent = 'Available';
         }
     });
  }

  // 8. MAP FILTERS DROPDOWN LOGIC
    const filterBtn = document.getElementById('filter-btn');

  // Replace your old map filter logic with this clean integration
  if (filterBtn) {
    filterBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent accidental default behavior
      
      // Call the globally available panel trigger system 
      if (typeof window.openPanel === 'function') {
          window.openPanel('side-panel-categories');
      } else {
          console.error("Panel system is not loaded.");
      }
    });
  }

  // const filterBtn = document.getElementById('filter-btn');
  // const dropdown = document.getElementById('categories-dropdown');

  // if (filterBtn && dropdown) {
  //   filterBtn.addEventListener('click', async () => {
  //     const isOpen = dropdown.classList.toggle('is-open');

  //     if (isOpen) {
  //       await fetchAndRenderCategories();
  //     }
  //   });

  //   // Close dropdown when clicking outside
  //   document.addEventListener('click', (e) => {
  //     if (!filterBtn.contains(e.target) && !dropdown.contains(e.target)) {
  //       dropdown.classList.remove('is-open');
  //     }
  //   });
  // }

  // function fetchAndRenderCategories() {
  //   dropdown.innerHTML = '<div class="loading-text">Loading...</div>';
    
  //   return fetch(`${API_BASE_URL}/api/categories`)
  //     .then(response => {
  //       if (!response.ok) throw new Error('Server responded but with an error status.');
  //       return response.json();
  //     })
  //     .then(categories => {
  //       dropdown.innerHTML = ''; // Clear loading text
        
  //       categories.forEach(category => {
  //         const item = document.createElement('div');
  //         item.className = 'category-item';
  //         item.innerHTML = `
  //           <i class="fa-solid ${category.icon}"></i>
  //           <span>${category.name}</span>
  //         `;
          
  //         item.addEventListener('click', () => {
  //           console.log(`Selected Map Filter: ${category.name}`);
  //           dropdown.classList.remove('is-open');
  //         });
          
  //         dropdown.appendChild(item);
  //       });
  //     })
  //     .catch(error => {
  //       console.error('Network Warning: The server might be offline or unreachable.', error.message);
  //       dropdown.innerHTML = '<div class="loading-text">Filters temporarily unavailable (Server offline)</div>';
  //     });
  // }
  // 9. ISOMETRIC FLOOR LEGEND LOGIC
  const floorLayers = document.querySelectorAll('.cube-layer');
  const floorTooltip = document.getElementById('floor-tooltip');

  if (floorLayers.length > 0 && floorTooltip) {
      floorLayers.forEach(layer => {
          layer.addEventListener('mouseenter', (e) => {
              const floorName = e.target.getAttribute('data-floor');
              if (floorName) {
                  floorTooltip.textContent = floorName;
                  floorTooltip.style.opacity = '1';
              }
          });
          layer.addEventListener('mouseleave', () => {
              floorTooltip.style.opacity = '0';
          });
      });
  }

});
