// State Management
let state = {
    groupTitle: "조별 모임 일정",
    participants: [],
    // 168 cells representing 7 days * 24 hours.
    // Each cell contains an array of participant names available at that time.
    availabilityData: Array.from({ length: 168 }, () => []),
    currentWeekMonday: null, // Date object representing the Monday of the selected week
    
    // UI temporary states
    editMode: false,
    editParticipantName: "",
    editSelectedIndices: new Set() // Set of cell indices selected in the modal
};

// Constant configurations
const DAYS_KR = ['월', '화', '수', '목', '금', '토', '일'];
const DAYS_ENG = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    initDate();
    loadFromLocalStorage();
    updateWeekDisplay();
    renderMainCalendarGrid();
    renderParticipantList();
    initEventListeners();
    updateVisuals();
});

// 1. Date Operations
function initDate() {
    const today = new Date();
    state.currentWeekMonday = getMonday(today);
}

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

function getDayDateString(monday, dayIndex) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + dayIndex);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${month}/${date}`;
}

function getFullDateString(monday, dayIndex) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + dayIndex);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${date}`;
}

function updateWeekDisplay() {
    const monday = state.currentWeekMonday;
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const startStr = `${monday.getFullYear()}년 ${String(monday.getMonth() + 1).padStart(2, '0')}월 ${String(monday.getDate()).padStart(2, '0')}일`;
    const endStr = `${sunday.getFullYear()}년 ${String(sunday.getMonth() + 1).padStart(2, '0')}월 ${String(sunday.getDate()).padStart(2, '0')}일`;
    
    document.getElementById("current-week-display").textContent = `${startStr} ~ ${endStr}`;
    
    renderMainCalendarHeaders();
}

// 2. Local Storage Operations
function saveToLocalStorage() {
    const serializedState = {
        groupTitle: state.groupTitle,
        participants: state.participants,
        availabilityData: state.availabilityData,
        currentWeekMonday: state.currentWeekMonday.toISOString()
    };
    localStorage.setItem("our_time_scheduler_state", JSON.stringify(serializedState));
}

function loadFromLocalStorage() {
    const data = localStorage.getItem("our_time_scheduler_state");
    if (data) {
        try {
            const parsed = JSON.parse(data);
            state.groupTitle = parsed.groupTitle || "조별 모임 일정";
            state.participants = parsed.participants || [];
            state.availabilityData = parsed.availabilityData || Array.from({ length: 168 }, () => []);
            state.currentWeekMonday = new Date(parsed.currentWeekMonday);
            
            document.getElementById("group-name-input").value = state.groupTitle;
            document.getElementById("group-name-display").textContent = state.groupTitle;
        } catch (e) {
            console.error("Local storage parsing failed, using defaults", e);
            initDate();
        }
    } else {
        initDate();
    }
}

// 3. Render Views
function renderMainCalendarHeaders() {
    const tr = document.getElementById("calendar-thead-tr");
    if (!tr) return;
    
    // Clear and build the headers
    tr.innerHTML = `<th class="time-column-header">시간</th>`;
    
    DAYS_KR.forEach((day, index) => {
        const dateStr = getDayDateString(state.currentWeekMonday, index);
        const isWeekend = (index === 5 || index === 6) ? 'weekend' : '';
        const dayClass = index === 5 ? 'saturday' : (index === 6 ? 'sunday' : '');
        tr.innerHTML += `
            <th class="day-header ${isWeekend} ${dayClass}">
                <div class="day-label">${day}</div>
                <div class="date-label">${dateStr}</div>
            </th>
        `;
    });
}

function renderMainCalendarGrid() {
    const tbody = document.getElementById("calendar-tbody");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    for (let hour = 0; hour < 24; hour++) {
        const tr = document.createElement("tr");
        
        // Time cell
        const timeCell = document.createElement("td");
        timeCell.className = "time-cell";
        timeCell.textContent = `${String(hour).padStart(2, '0')}:00`;
        tr.appendChild(timeCell);
        
        // 7 Day cells
        for (let day = 0; day < 7; day++) {
            const cellIndex = day * 24 + hour;
            const td = document.createElement("td");
            td.className = "grid-cell cell-depth-0";
            td.dataset.index = cellIndex;
            td.id = `main-cell-${cellIndex}`;
            
            // Add tooltip container
            const tooltip = document.createElement("div");
            tooltip.className = "cell-tooltip";
            td.appendChild(tooltip);
            
            tr.appendChild(td);
        }
        
        tbody.appendChild(tr);
    }
}

function renderParticipantList() {
    const listEl = document.getElementById("participant-list");
    const countEl = document.getElementById("participant-count");
    if (!listEl) return;
    
    countEl.textContent = state.participants.length;
    
    if (state.participants.length === 0) {
        listEl.innerHTML = `
            <li class="empty-list-message">등록된 참여자가 없습니다.<br>아래 '일정 추가하기'로 일정을 등록해 보세요!</li>
        `;
        return;
    }
    
    listEl.innerHTML = "";
    state.participants.forEach(name => {
        // Calculate total hours this participant is available
        let hourCount = 0;
        state.availabilityData.forEach(cellNames => {
            if (cellNames.includes(name)) hourCount++;
        });
        
        const li = document.createElement("li");
        li.className = "participant-item";
        li.innerHTML = `
            <div class="participant-name-container">
                <span class="avatar-dot"></span>
                <div>
                    <span class="participant-name">${escapeHTML(name)}</span>
                    <div class="participant-hours">선택 시간: ${hourCount}시간</div>
                </div>
            </div>
            <div class="participant-actions">
                <button class="icon-btn edit-member-btn" data-name="${escapeHTML(name)}" title="일정 수정">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="icon-btn remove-member-btn danger" data-name="${escapeHTML(name)}" title="삭제">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="danger-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;
        listEl.appendChild(li);
    });
    
    // Re-bind listeners for dynamic items
    document.querySelectorAll(".edit-member-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const name = e.currentTarget.dataset.name;
            openEditScheduleModal(name);
        });
    });
    
    document.querySelectorAll(".remove-member-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const name = e.currentTarget.dataset.name;
            if (confirm(`'${name}' 님의 일정을 삭제하시겠습니까?`)) {
                removeParticipant(name);
            }
        });
    });
}

function updateVisuals() {
    const totalParticipants = state.participants.length;
    
    for (let i = 0; i < 168; i++) {
        const cell = document.getElementById(`main-cell-${i}`);
        if (!cell) continue;
        
        const names = state.availabilityData[i] || [];
        const count = names.length;
        
        // Remove old classes
        cell.className = "grid-cell";
        
        // Compute visual depth
        if (totalParticipants === 0 || count === 0) {
            cell.classList.add("cell-depth-0");
        } else if (count === totalParticipants) {
            cell.classList.add("cell-depth-all");
        } else {
            // Relative depth scaling (1, 2, 3)
            const ratio = count / totalParticipants;
            if (ratio <= 0.35 || count === 1) {
                cell.classList.add("cell-depth-1");
            } else if (ratio <= 0.7) {
                cell.classList.add("cell-depth-2");
            } else {
                cell.classList.add("cell-depth-3");
            }
        }
        
        // Update tooltip content
        const dayIndex = Math.floor(i / 24);
        const hour = i % 24;
        const timeRangeStr = `${getDayDateString(state.currentWeekMonday, dayIndex)} (${DAYS_KR[dayIndex]}) ${String(hour).padStart(2, '0')}:00 ~ ${String(hour + 1).padStart(2, '0')}:00`;
        
        const tooltip = cell.querySelector(".cell-tooltip");
        if (tooltip) {
            if (count > 0) {
                const badgeHTML = names.map(n => `<span class="tooltip-person-badge">${escapeHTML(n)}</span>`).join("");
                tooltip.innerHTML = `
                    <span class="tooltip-time">${timeRangeStr}</span>
                    <div style="font-weight:600; margin-bottom:6px; color:#10b981;">가능 인원: ${count}/${totalParticipants}명</div>
                    <div class="tooltip-people">${badgeHTML}</div>
                `;
            } else {
                tooltip.innerHTML = `
                    <span class="tooltip-time">${timeRangeStr}</span>
                    <div style="color:var(--text-muted);">가능한 조원 없음</div>
                `;
            }
        }
    }
}

// 4. Modal Editing Logic
function renderEditCalendarGrid() {
    const trHead = document.getElementById("edit-thead-tr");
    const tbody = document.getElementById("edit-calendar-tbody");
    if (!tbody || !trHead) return;
    
    // Render headers matching active week
    trHead.innerHTML = `<th class="time-column-header">시간</th>`;
    DAYS_KR.forEach((day, index) => {
        const dateStr = getDayDateString(state.currentWeekMonday, index);
        const isWeekend = (index === 5 || index === 6) ? 'weekend' : '';
        const dayClass = index === 5 ? 'saturday' : (index === 6 ? 'sunday' : '');
        trHead.innerHTML += `
            <th class="day-header ${isWeekend} ${dayClass}">
                <div class="day-label">${day}</div>
                <div class="date-label">${dateStr}</div>
            </th>
        `;
    });
    
    tbody.innerHTML = "";
    
    for (let hour = 0; hour < 24; hour++) {
        const tr = document.createElement("tr");
        
        const timeCell = document.createElement("td");
        timeCell.className = "time-cell";
        timeCell.textContent = `${String(hour).padStart(2, '0')}:00`;
        tr.appendChild(timeCell);
        
        for (let day = 0; day < 7; day++) {
            const cellIndex = day * 24 + hour;
            const td = document.createElement("td");
            td.className = "grid-cell";
            td.dataset.index = cellIndex;
            td.id = `edit-cell-${cellIndex}`;
            
            if (state.editSelectedIndices.has(cellIndex)) {
                td.classList.add("cell-editing-selected");
            }
            
            tr.appendChild(td);
        }
        
        tbody.appendChild(tr);
    }
    
    setupGridDragSelection();
}

function setupGridDragSelection() {
    const cells = document.querySelectorAll("#edit-calendar-table td.grid-cell");
    let isDragging = false;
    let selectMode = true; // true = draw, false = erase
    
    const getActiveTool = () => {
        return document.querySelector('input[name="draw-tool"]:checked').value;
    };
    
    cells.forEach(cell => {
        // Prevent default touch/drag behavior
        cell.addEventListener("mousedown", (e) => {
            e.preventDefault();
            isDragging = true;
            
            const index = parseInt(cell.dataset.index);
            const tool = getActiveTool();
            
            if (tool === 'draw') {
                selectMode = true;
                state.editSelectedIndices.add(index);
                cell.classList.add("cell-editing-selected");
            } else {
                selectMode = false;
                state.editSelectedIndices.delete(index);
                cell.classList.remove("cell-editing-selected");
            }
        });
        
        cell.addEventListener("mouseenter", () => {
            if (isDragging) {
                const index = parseInt(cell.dataset.index);
                if (selectMode) {
                    state.editSelectedIndices.add(index);
                    cell.classList.add("cell-editing-selected");
                } else {
                    state.editSelectedIndices.delete(index);
                    cell.classList.remove("cell-editing-selected");
                }
            }
        });
    });
    
    const handleMouseUp = () => {
        isDragging = false;
    };
    
    document.addEventListener("mouseup", handleMouseUp);
    
    // Add touch selection support for mobile
    const editTable = document.getElementById("edit-calendar-table");
    
    editTable.addEventListener("touchstart", (e) => {
        if (e.target.classList.contains("grid-cell")) {
            e.preventDefault();
            isDragging = true;
            const cell = e.target;
            const index = parseInt(cell.dataset.index);
            const tool = getActiveTool();
            
            selectMode = tool === 'draw';
            
            if (selectMode) {
                state.editSelectedIndices.add(index);
                cell.classList.add("cell-editing-selected");
            } else {
                state.editSelectedIndices.delete(index);
                cell.classList.remove("cell-editing-selected");
            }
        }
    }, { passive: false });
    
    editTable.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (element && element.classList.contains("grid-cell") && element.closest("#edit-calendar-table")) {
            const index = parseInt(element.dataset.index);
            if (selectMode) {
                state.editSelectedIndices.add(index);
                element.classList.add("cell-editing-selected");
            } else {
                state.editSelectedIndices.delete(index);
                element.classList.remove("cell-editing-selected");
            }
        }
    }, { passive: false });
    
    editTable.addEventListener("touchend", () => {
        isDragging = false;
    });
}

function openEditScheduleModal(name = "") {
    state.editParticipantName = name;
    state.editSelectedIndices.clear();
    
    const nameInput = document.getElementById("user-name-input");
    const modalTitle = document.getElementById("modal-title");
    
    if (name) {
        modalTitle.textContent = "일정 수정하기";
        nameInput.value = name;
        nameInput.disabled = true; // Protect name key
        
        // Load existing availability indices
        for (let i = 0; i < 168; i++) {
            if (state.availabilityData[i].includes(name)) {
                state.editSelectedIndices.add(i);
            }
        }
    } else {
        modalTitle.textContent = "일정 추가하기";
        nameInput.value = "";
        nameInput.disabled = false;
    }
    
    // Render the selector table
    renderEditCalendarGrid();
    
    // Reset draw tool to default
    document.getElementById("tool-draw").checked = true;
    
    document.getElementById("schedule-modal").classList.add("active");
}

function closeEditScheduleModal() {
    document.getElementById("schedule-modal").classList.remove("active");
    state.editParticipantName = "";
    state.editSelectedIndices.clear();
}

function saveSchedule() {
    const nameInput = document.getElementById("user-name-input");
    const rawName = nameInput.value.trim();
    
    if (!rawName) {
        showToast("참여자 이름을 입력해 주세요!");
        nameInput.focus();
        return;
    }
    
    // Check duplication for new participants
    if (!state.editParticipantName && state.participants.includes(rawName)) {
        showToast("이미 동일한 이름의 참여자가 존재합니다.");
        nameInput.focus();
        return;
    }
    
    const finalName = state.editParticipantName || rawName;
    
    // Clean old entries for this name from grid data
    for (let i = 0; i < 168; i++) {
        state.availabilityData[i] = state.availabilityData[i].filter(n => n !== finalName);
    }
    
    // Add participant to the master list if new
    if (!state.participants.includes(finalName)) {
        state.participants.push(finalName);
    }
    
    // Save new selections
    state.editSelectedIndices.forEach(index => {
        if (!state.availabilityData[index].includes(finalName)) {
            state.availabilityData[index].push(finalName);
        }
    });
    
    saveToLocalStorage();
    renderParticipantList();
    updateVisuals();
    closeEditScheduleModal();
    showToast(`'${finalName}' 님의 일정이 저장되었습니다.`);
}

function removeParticipant(name) {
    // Remove from participants list
    state.participants = state.participants.filter(n => n !== name);
    
    // Remove from each of the 168 availability list arrays
    for (let i = 0; i < 168; i++) {
        state.availabilityData[i] = state.availabilityData[i].filter(n => n !== name);
    }
    
    saveToLocalStorage();
    renderParticipantList();
    updateVisuals();
    showToast(`'${name}' 님의 일정이 삭제되었습니다.`);
}

// Quick selection algorithms inside modal
function setupQuickSelection() {
    // Weekday: indices matching Mon-Fri (dayIndex 0 to 4)
    document.getElementById("quick-weekday-btn").addEventListener("click", () => {
        for (let day = 0; day < 5; day++) {
            for (let hour = 9; hour < 18; hour++) { // Default standard business/study hours: 9:00 to 18:00
                const index = day * 24 + hour;
                state.editSelectedIndices.add(index);
                const cell = document.getElementById(`edit-cell-${index}`);
                if (cell) cell.classList.add("cell-editing-selected");
            }
        }
    });
    
    // Weekend: indices matching Sat-Sun (dayIndex 5 & 6)
    document.getElementById("quick-weekend-btn").addEventListener("click", () => {
        for (let day = 5; day < 7; day++) {
            for (let hour = 10; hour < 22; hour++) { // Default weekend social hours: 10:00 to 22:00
                const index = day * 24 + hour;
                state.editSelectedIndices.add(index);
                const cell = document.getElementById(`edit-cell-${index}`);
                if (cell) cell.classList.add("cell-editing-selected");
            }
        }
    });
    
    // Clear all in modal
    document.getElementById("quick-clear-btn").addEventListener("click", () => {
        state.editSelectedIndices.clear();
        document.querySelectorAll("#edit-calendar-tbody td.grid-cell").forEach(cell => {
            cell.classList.remove("cell-editing-selected");
        });
    });
}

// 5. Result Analyzer (Contiguous block logic)
function analyzeAvailableTimes() {
    const listEl = document.getElementById("results-list");
    if (!listEl) return;
    
    listEl.innerHTML = "";
    
    if (state.participants.length === 0) {
        listEl.innerHTML = `<div class="empty-results-message">참여자가 등록되지 않았습니다.<br>먼저 일정을 등록해 주세요.</div>`;
        return;
    }
    
    const mode = state.activeFilter; // 'all' or 'most'
    
    // Compute availability counts for all slots
    let cellCounts = state.availabilityData.map(names => names.length);
    let maxAvailable = Math.max(...cellCounts);
    
    if (maxAvailable === 0) {
        listEl.innerHTML = `<div class="empty-results-message">활동이 가능하다고 체크된 시간이 없습니다.</div>`;
        return;
    }
    
    let targetIndices = [];
    let badgeText = "";
    let badgeClass = "";
    
    if (mode === 'all') {
        // Get slots where all participants are available
        const total = state.participants.length;
        for (let i = 0; i < 168; i++) {
            if (cellCounts[i] === total) {
                targetIndices.push(i);
            }
        }
        badgeText = "전원 합의";
        badgeClass = "success";
    } else {
        // Get slots where the maximum possible participants are available
        for (let i = 0; i < 168; i++) {
            if (cellCounts[i] === maxAvailable) {
                targetIndices.push(i);
            }
        }
        badgeText = `${state.participants.length}명 중 ${maxAvailable}명 가능`;
        badgeClass = maxAvailable === state.participants.length ? "success" : "warning";
    }
    
    if (targetIndices.length === 0) {
        if (mode === 'all') {
            listEl.innerHTML = `
                <div class="empty-results-message">
                    😢 모든 조원이 가능한 시간이 없습니다.<br>
                    대신 <strong>'최다 인원 가능 시간'</strong> 탭을 확인해 보세요!
                </div>`;
        } else {
            listEl.innerHTML = `<div class="empty-results-message">조건에 부합하는 일정이 없습니다.</div>`;
        }
        return;
    }
    
    // Group target indices into contiguous blocks day by day
    let blocksByDay = Array.from({ length: 7 }, () => []);
    targetIndices.forEach(idx => {
        const day = Math.floor(idx / 24);
        const hour = idx % 24;
        blocksByDay[day].push(hour);
    });
    
    let resultBlocks = [];
    
    blocksByDay.forEach((hours, dayIndex) => {
        if (hours.length === 0) return;
        
        hours.sort((a, b) => a - b);
        
        let startHour = hours[0];
        let endHour = hours[0] + 1;
        
        for (let k = 1; k < hours.length; k++) {
            if (hours[k] === endHour) {
                endHour = hours[k] + 1;
            } else {
                resultBlocks.push({
                    dayIndex: dayIndex,
                    startHour: startHour,
                    endHour: endHour,
                    duration: endHour - startHour
                });
                startHour = hours[k];
                endHour = hours[k] + 1;
            }
        }
        
        resultBlocks.push({
            dayIndex: dayIndex,
            startHour: startHour,
            endHour: endHour,
            duration: endHour - startHour
        });
    });
    
    // Render result items
    resultBlocks.forEach(block => {
        const fullDateStr = getFullDateString(state.currentWeekMonday, block.dayIndex);
        const dayLabel = DAYS_KR[block.dayIndex];
        const timeRange = `${String(block.startHour).padStart(2, '0')}:00 ~ ${String(block.endHour).padStart(2, '0')}:00`;
        const durationText = `${block.duration}시간`;
        
        // Find who is available at these times
        const cellIndex = block.dayIndex * 24 + block.startHour;
        const availablePeople = state.availabilityData[cellIndex] || [];
        
        const itemEl = document.createElement("div");
        itemEl.className = "result-item";
        itemEl.innerHTML = `
            <div class="result-header">
                <span class="result-time-text">${fullDateStr} (${dayLabel}) ${timeRange}</span>
                <span class="result-badge ${badgeClass}">${badgeText} (${durationText})</span>
            </div>
            <div class="result-details">
                🧑‍🤝‍🧑 <strong>가능 인원 (${availablePeople.length}명):</strong> ${availablePeople.map(escapeHTML).join(", ")}
            </div>
        `;
        listEl.appendChild(itemEl);
    });
}

function copyResultsToClipboard() {
    const listEl = document.getElementById("results-list");
    const items = listEl.querySelectorAll(".result-item");
    
    if (items.length === 0 || listEl.querySelector(".empty-results-message")) {
        showToast("복사할 결과가 없습니다.");
        return;
    }
    
    let text = `📅 [${state.groupTitle}] 활동 가능 시간 조율 결과\n`;
    text += `주간 범위: ${document.getElementById("current-week-display").textContent}\n`;
    text += `조율 기준: ${state.activeFilter === 'all' ? '모든 조원 합의 시간' : '최대 인원 가능 시간'}\n\n`;
    
    items.forEach((item, index) => {
        const timeText = item.querySelector(".result-time-text").textContent;
        const badgeText = item.querySelector(".result-badge").textContent;
        const detailsText = item.querySelector(".result-details").textContent.trim();
        
        text += `${index + 1}. ${timeText} (${badgeText})\n   ${detailsText}\n\n`;
    });
    
    text += `우리의 시간 scheduler에서 편하게 일정을 잡아보세요!`;
    
    navigator.clipboard.writeText(text).then(() => {
        showToast("📋 결과가 클립보드에 복사되었습니다! 카카오톡 등에 전달해보세요.");
    }).catch(err => {
        console.error("Clipboard write error: ", err);
        showToast("클립보드 복사에 실패했습니다. 수동으로 긁어서 복사해주세요.");
    });
}

// 6. Interactive and Navigation Listeners
function initEventListeners() {
    // Open schedule modal
    document.getElementById("add-schedule-btn").addEventListener("click", () => openEditScheduleModal());
    
    // Modal buttons
    document.getElementById("close-schedule-modal-btn").addEventListener("click", closeEditScheduleModal);
    document.getElementById("cancel-schedule-btn").addEventListener("click", closeEditScheduleModal);
    document.getElementById("save-schedule-btn").addEventListener("click", saveSchedule);
    
    // Setup draw preset tools
    setupQuickSelection();
    
    // Open results modal
    document.getElementById("view-times-btn").addEventListener("click", () => {
        state.activeFilter = 'all';
        document.getElementById("filter-all-btn").classList.add("active");
        document.getElementById("filter-most-btn").classList.remove("active");
        
        analyzeAvailableTimes();
        document.getElementById("results-modal").classList.add("active");
    });
    
    document.getElementById("close-results-modal-btn").addEventListener("click", () => {
        document.getElementById("results-modal").classList.remove("active");
    });
    
    document.getElementById("close-results-btn").addEventListener("click", () => {
        document.getElementById("results-modal").classList.remove("active");
    });
    
    // Copy Results
    document.getElementById("copy-results-btn").addEventListener("click", copyResultsToClipboard);
    
    // Result Modal Filter Tabs
    document.getElementById("filter-all-btn").addEventListener("click", () => {
        state.activeFilter = 'all';
        document.getElementById("filter-all-btn").classList.add("active");
        document.getElementById("filter-most-btn").classList.remove("active");
        analyzeAvailableTimes();
    });
    
    document.getElementById("filter-most-btn").addEventListener("click", () => {
        state.activeFilter = 'most';
        document.getElementById("filter-most-btn").classList.add("active");
        document.getElementById("filter-all-btn").classList.remove("active");
        analyzeAvailableTimes();
    });
    
    // Clear all action
    document.getElementById("clear-all-btn").addEventListener("click", () => {
        if (confirm("정말로 모든 참여자와 입력된 일정 데이터를 삭제하고 초기화하시겠습니까?")) {
            state.participants = [];
            state.availabilityData = Array.from({ length: 168 }, () => []);
            saveToLocalStorage();
            renderParticipantList();
            updateVisuals();
            showToast("모든 데이터가 초기화되었습니다.");
        }
    });
    
    // Title Modal Trigger
    document.getElementById("edit-group-name-btn").addEventListener("click", () => {
        document.getElementById("group-name-input").value = state.groupTitle;
        document.getElementById("title-modal").classList.add("active");
    });
    
    document.getElementById("cancel-title-btn").addEventListener("click", () => {
        document.getElementById("title-modal").classList.remove("active");
    });
    
    document.getElementById("save-title-btn").addEventListener("click", () => {
        const titleVal = document.getElementById("group-name-input").value.trim();
        if (titleVal) {
            state.groupTitle = titleVal;
            document.getElementById("group-name-display").textContent = titleVal;
            saveToLocalStorage();
            document.getElementById("title-modal").classList.remove("active");
            showToast("모임 정보가 수정되었습니다.");
        } else {
            showToast("모임 명칭을 입력해 주세요!");
        }
    });
    
    // Week navigation logic
    document.getElementById("prev-week-btn").addEventListener("click", () => {
        state.currentWeekMonday.setDate(state.currentWeekMonday.getDate() - 7);
        updateWeekDisplay();
        updateVisuals();
    });
    
    document.getElementById("next-week-btn").addEventListener("click", () => {
        state.currentWeekMonday.setDate(state.currentWeekMonday.getDate() + 7);
        updateWeekDisplay();
        updateVisuals();
    });
}

// 7. Utility Functions
function showToast(message) {
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toast-message");
    
    toastMsg.textContent = message;
    toast.classList.add("show");
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
