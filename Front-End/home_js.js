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

  // Peek Mode Toggle logic
  function togglePeekMode(e) {
    // Prevent toggle if the user clicks a tab or functional button
    if (e.target.closest('button')) return;
    horizontalBuilderWrapper.classList.toggle('peek-mode');
  }

  bsHeader.addEventListener('click', togglePeekMode);
  topRow.addEventListener('click', togglePeekMode);

  function startEditing() {
    isEditMode = true;
    draftData = JSON.parse(JSON.stringify(currentMode === 'schedule' ? weekData : eventData));
    setupTabs();
    renderTrack();
  }

  // 2. INITIALIZE APP
  const toggleSchedule = document.getElementById('toggle-schedule');
  const toggleEvents = document.getElementById('toggle-events');

  toggleSchedule.addEventListener('change', () => {
    currentMode = 'schedule';
    isEditMode = false;
    setupTabs();
    renderTrack();
  });

  toggleEvents.addEventListener('change', () => {
    currentMode = 'events';
    isEditMode = false;
    setupTabs();
    renderTrack();
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
    const masterData = currentMode === 'schedule' ? weekData : eventData;
    const dataObj = isEditMode ? draftData : masterData;
    const todayClasses = dataObj[currentDay];

    const hasAnySchedule = Object.values(masterData).some(arr => arr.length > 0);

    // Empty vs Exists global view state
    if (!hasAnySchedule && !isEditMode) {
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
    if (isEditMode) {
      editBtn.style.display = 'none';
      exitEditBtn.style.display = 'flex';
      saveBtn.style.display = 'block';
    } else {
      editBtn.style.display = 'flex';
      exitEditBtn.style.display = 'none';
      saveBtn.style.display = 'none';
    }

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
        <select class="frame-input location-val">
          <option value="" disabled ${!data.location ? 'selected' : ''}>Select Location...</option>
          <option value="room_201" ${data.location === 'room_201' ? 'selected' : ''}>Room 201</option>
          <option value="lab_3" ${data.location === 'lab_3' ? 'selected' : ''}>Computer Lab 3</option>
        </select>
        <div class="time-row">
          <input type="time" class="frame-input start-val" value="${data.start || ''}">
          <input type="time" class="frame-input end-val" value="${data.end || ''}">
        </div>
      </div>
    `;

    // Edit Mode Event Listeners
    card.querySelector('.delete').addEventListener('click', () => { card.remove(); });
    card.querySelector('.refresh').addEventListener('click', () => {
      card.querySelectorAll('input, select').forEach(input => input.value = '');
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
        <span class="view-text"><i class="fa-solid fa-location-dot"></i> ${data.location.replace('_', ' ')}</span>
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
        newClasses.push({
          subject: subject,
          location: card.querySelector('.location-val').value,
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

  saveBtn.addEventListener('click', () => {
    saveCurrentInputsToState(); // Saves last focused tab to draftData
    if (currentMode === 'schedule') {
        weekData = JSON.parse(JSON.stringify(draftData));
    } else {
        eventData = JSON.parse(JSON.stringify(draftData));
    }
    isEditMode = false;
    setupTabs();
    renderTrack();
    
    const outData = currentMode === 'schedule' ? weekData : eventData;
    console.log("DATA READY FOR BACKEND API:", JSON.stringify(outData, null, 2));
    alert("Saved successfully! Check Developer Console to see the JSON payload.");
  });

  // 7. FAB LISTENERS
  const recenterBtn = document.querySelector('.recenter-btn');
  const addActionBtn = document.querySelector('.add-action-btn');

  if (recenterBtn) {
    recenterBtn.addEventListener('click', () => {
        console.log("📍 Recentering Map to User's GPS Location...");
        alert("Recentering Map to User's GPS Location...");
    });
  }

  if (addActionBtn) {
    addActionBtn.addEventListener('click', () => {
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
  const dropdown = document.getElementById('categories-dropdown');

  if (filterBtn && dropdown) {
    filterBtn.addEventListener('click', async () => {
      const isOpen = dropdown.classList.toggle('is-open');

      if (isOpen) {
        await fetchAndRenderCategories();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!filterBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('is-open');
      }
    });
  }

  async function fetchAndRenderCategories() {
    dropdown.innerHTML = '<div class="loading-text">Loading...</div>';
    try {
      const response = await fetch('http://localhost:5000/api/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const categories = await response.json();
      
      dropdown.innerHTML = ''; // Clear loading text
      
      categories.forEach(category => {
        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
          <i class="fa-solid ${category.icon}"></i>
          <span>${category.name}</span>
        `;
        
        item.addEventListener('click', () => {
          console.log(`Selected Map Filter: ${category.name}`);
          dropdown.classList.remove('is-open');
        });
        
        dropdown.appendChild(item);
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      dropdown.innerHTML = '<div class="loading-text">Error loading categories.</div>';
    }
  }

});