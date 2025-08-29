// Accent colors for envelopes - expanded palette for unique colors
const accents = [
    ["#22d3ee", "#6366f1"], // Cyan to Blue
    ["#34d399", "#10b981"], // Green to Emerald
    ["#60a5fa", "#38bdf8"], // Blue to Sky
    ["#e879f9", "#8b5cf6"], // Fuchsia to Purple
    ["#f472b6", "#fb7185"], // Pink to Rose
    ["#f59e0b", "#f97316"], // Amber to Orange
    ["#ff6b6b", "#ee5a52"], // Red to Red-Orange
    ["#4ecdc4", "#26d0ce"], // Teal to Cyan
    ["#45b7d1", "#3498db"], // Light Blue to Blue
    ["#96ceb4", "#85c1a1"], // Mint to Green
    ["#feca57", "#ff9ff3"], // Yellow to Pink
    ["#ff9ff3", "#f368e0"], // Light Pink to Hot Pink
    ["#a29bfe", "#6c5ce7"], // Lavender to Purple
    ["#fd79a8", "#e84393"], // Rose to Magenta
    ["#00b894", "#00a085"], // Turquoise to Teal
    ["#00cec9", "#00b3ae"], // Cyan to Dark Cyan
    ["#0984e3", "#074080"], // Blue to Navy
    ["#6c5ce7", "#5f3dc4"], // Purple to Dark Purple
    ["#a29bfe", "#8b80f9"], // Light Purple to Purple
    ["#fd79a8", "#fc427b"]  // Pink to Hot Pink
];

let usedAccentIndices = new Set();

// Load envelopes from localStorage or initialize empty array
let envelopes;
try {
    envelopes = JSON.parse(localStorage.getItem('envelopes')) || [];
    // Validate loaded data structure
    if (!Array.isArray(envelopes)) {
        envelopes = [];
    }
    // Ensure each envelope has required properties and fix NaN values
    envelopes = envelopes.filter(env => 
        env && typeof env === 'object' && 
        env.id && env.name && 
        !isNaN(env.budget) && !isNaN(env.spent)
    ).map(env => ({
        ...env,
        budget: Math.max(0, parseFloat(env.budget) || 0),
        spent: Math.max(0, parseFloat(env.spent) || 0),
        expenses: Array.isArray(env.expenses) ? env.expenses.filter(exp => 
            exp && !isNaN(exp.amount) && exp.note && exp.note.trim() !== ''
        ).map(exp => ({
            ...exp,
            amount: Math.max(0, parseFloat(exp.amount) || 0)
        })) : []
    }));
} catch (e) {
    console.warn('Failed to load envelopes from localStorage:', e);
    envelopes = [];
}
let activeIndex = envelopes.length > 0 ? 0 : -1;
let currentDetailId = null;
let envelopeToDelete = null;

// Chart instances
let categoryChart = null;
let budgetChart = null;

// DOM Elements
const track = document.getElementById("track");
const welcomeScreen = document.getElementById("welcome");
const addBtn = document.getElementById("add");
const welcomeAddBtn = document.getElementById("welcome-add");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const dlg = document.getElementById("addDialog");
const deleteDlg = document.getElementById("deleteDialog");
const confirmDeleteBtn = document.getElementById("confirmDelete");
const cancelAddBtn = document.getElementById("cancelAdd");
const addForm = document.getElementById("addForm");
const envelopeDetail = document.getElementById("envelopeDetail");
const closeDetailBtn = document.getElementById("closeDetail");
const detailTitle = document.getElementById("detailTitle");
const detailBudget = document.getElementById("detailBudget");
const detailSpent = document.getElementById("detailSpent");
const detailRemaining = document.getElementById("detailRemaining");
const expenseAmount = document.getElementById("expenseAmount");
const expenseNote = document.getElementById("expenseNote");
const addExpenseBtn = document.getElementById("addExpense");
const expenseList = document.getElementById("expenseList");
const envelopesTab = document.getElementById("envelopes-tab");
const dashboardTab = document.getElementById("dashboard-tab");
const envelopesView = document.getElementById("envelopes-view");
const dashboardView = document.getElementById("dashboard-view");

// Dashboard elements
const totalBudgetEl = document.getElementById("total-budget");
const totalSpentEl = document.getElementById("total-spent");
const remainingBudgetEl = document.getElementById("remaining-budget");
const envelopesCountEl = document.getElementById("envelopes-count");

// Initialize the app
init();

function init() {
    // Show welcome screen if no envelopes
    if (envelopes.length === 0) {
        welcomeScreen.classList.remove('hidden');
        track.style.display = 'none';
    } else {
        welcomeScreen.classList.add('hidden');
        track.style.display = 'block';
        render();
        updateDashboard();
    }

    // Set up event listeners
    setupEventListeners();
    
    // Initialize used colors based on existing envelopes
    updateUsedColors();
}

function setupEventListeners() {
    // Add envelope buttons
    addBtn.addEventListener("click", () => dlg.showModal());
    welcomeAddBtn.addEventListener("click", () => dlg.showModal());
    
    // Cancel button for add form (should always close the modal)
    cancelAddBtn.addEventListener("click", () => {
        dlg.close();
    });
    
            // Add envelope form submission
            addForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                
                // Validate inputs with proper error handling
                const name = validateString(document.getElementById("name").value);
                const budgetValue = validateNumber(document.getElementById("budget").value, 1);
                const spentValue = validateNumber(document.getElementById("spent").value, 0) || 0;
                
                // Check for validation failures
                if (!name) {
                    alert('Please enter a valid envelope name.');
                    return;
                }
                if (budgetValue === null) {
                    alert('Please enter a valid budget amount (minimum ₹1).');
                    return;
                }
                
                // Get a unique color for this envelope
                const grad = getUniqueAccentColor();
                
                const newEnvelope = {
                    id: cryptoRandomId(), 
                    name, 
                    budget: budgetValue, 
                    spent: spentValue, 
                    grad,
                    expenses: [],
                    createdAt: new Date().toISOString()
                };
                
                envelopes.push(newEnvelope);
                activeIndex = envelopes.length - 1;
                
                // Save to both localStorage and Firebase
                saveToLocalStorage();
                await saveEnvelopeToDatabase(newEnvelope);
                
                // Hide welcome screen and show carousel
                welcomeScreen.classList.add('hidden');
                track.style.display = 'block';
                
                render(true);
                updateDashboard();
                dlg.close();
                addForm.reset();
            });

    // Carousel navigation
    prevBtn.addEventListener("click", () => {
        if (envelopes.length === 0) return;
        activeIndex = (activeIndex - 1 + envelopes.length) % envelopes.length;
        layout();
    });
    
    nextBtn.addEventListener("click", () => {
        if (envelopes.length === 0) return;
        activeIndex = (activeIndex + 1) % envelopes.length;
        layout();
    });

    // Close detail view
    closeDetailBtn.addEventListener("click", () => {
        envelopeDetail.classList.remove('active');
    });

            // Add expense
            addExpenseBtn.addEventListener("click", async () => {
                if (!currentDetailId) return;
                
                // Validate expense inputs
                const amountValue = validateNumber(expenseAmount.value, 0.01);
                const noteValue = validateString(expenseNote.value);
                
                if (amountValue === null) {
                    alert('Please enter a valid expense amount (minimum ₹1).');
                    expenseAmount.focus();
                    return;
                }
                
                if (!noteValue) {
                    alert('Please enter a description for this expense.');
                    expenseNote.focus();
                    return;
                }
                
                // Find the envelope and update it
                const envelopeIndex = envelopes.findIndex(env => env.id === currentDetailId);
                if (envelopeIndex === -1) {
                    alert('Envelope not found. Please try again.');
                    return;
                }
                
                // Initialize expenses array if it doesn't exist
                if (!envelopes[envelopeIndex].expenses) {
                    envelopes[envelopeIndex].expenses = [];
                }
                
                // Create expense object
                const newExpense = {
                    id: cryptoRandomId(),
                    amount: amountValue,
                    note: noteValue,
                    date: new Date().toISOString()
                };
                
                // Add the expense
                envelopes[envelopeIndex].expenses.push(newExpense);
                
                // Update the spent amount (round to avoid floating point issues)
                const newSpent = Math.round((envelopes[envelopeIndex].spent + amountValue) * 100) / 100;
                envelopes[envelopeIndex].spent = newSpent;
                
                // Save to localStorage and Firebase
                saveToLocalStorage();
                await saveEnvelopeToDatabase(envelopes[envelopeIndex]);
                await addExpenseToDatabase(currentDetailId, newExpense);
                
                // Update the UI
                updateDetailView();
                render();
                updateDashboard();
                
                // Clear the form
                expenseAmount.value = '';
                expenseNote.value = '';
            });

            // Delete confirmation
            confirmDeleteBtn.addEventListener("click", async () => {
                if (!envelopeToDelete) return;
                
                // Find the index of the envelope to delete
                const index = envelopes.findIndex(env => env.id === envelopeToDelete);
                if (index === -1) return;
                
                const envelopeToRemove = envelopes[index];
                
                // Check if the envelope being deleted is currently open in detail view
                if (currentDetailId === envelopeToDelete) {
                    envelopeDetail.classList.remove('active');
                    currentDetailId = null;
                }
                
                // Remove the envelope's color from used colors
                if (envelopeToRemove.grad) {
                    const colorIndex = accents.findIndex(accent => 
                        accent[0] === envelopeToRemove.grad[0] && accent[1] === envelopeToRemove.grad[1]
                    );
                    if (colorIndex !== -1) {
                        usedAccentIndices.delete(colorIndex);
                    }
                }
                
                // Remove the envelope from the array
                envelopes.splice(index, 1);
                
                // Update activeIndex if needed
                if (envelopes.length === 0) {
                    activeIndex = -1;
                    welcomeScreen.classList.remove('hidden');
                    track.style.display = 'none';
                } else if (activeIndex >= envelopes.length) {
                    activeIndex = envelopes.length - 1;
                }
                
                // Save to localStorage and delete from Firebase
                saveToLocalStorage();
                await deleteEnvelopeFromDatabase(envelopeToDelete);
                
                // Re-render UI
                render();
                updateDashboard();
                
                // Close the dialog and reset tracking variable
                deleteDlg.close();
                envelopeToDelete = null;
            });

    // View tabs
    envelopesTab.addEventListener("click", () => {
        envelopesTab.classList.add("active");
        dashboardTab.classList.remove("active");
        envelopesView.style.display = "flex";
        dashboardView.classList.remove("active");
    });
    
    dashboardTab.addEventListener("click", () => {
        dashboardTab.classList.add("active");
        envelopesTab.classList.remove("active");
        envelopesView.style.display = "none";
        dashboardView.classList.add("active");
        updateDashboard();
    });

    // Close modal when clicking outside
    window.addEventListener("click", (e) => {
        if (e.target === dlg) dlg.close();
        if (e.target === deleteDlg) deleteDlg.close();
    });
    
    // Add event handler for cancel button in delete dialog
    deleteDlg.addEventListener("close", () => {
        if (deleteDlg.returnValue === "cancel") {
            envelopeToDelete = null;
        }
    });
    
    // Handle cancel button click in delete dialog
    const cancelDeleteBtn = deleteDlg.querySelector('.btn.secondary');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener("click", () => {
            envelopeToDelete = null;
            deleteDlg.close();
        });
    }
}

function getUniqueAccentColor() {
    // If we've used all colors, reset and start over
    if (usedAccentIndices.size >= accents.length) {
        usedAccentIndices.clear();
    }
    
    // Find an unused color
    let availableIndices = [];
    for (let i = 0; i < accents.length; i++) {
        if (!usedAccentIndices.has(i)) {
            availableIndices.push(i);
        }
    }
    
    // If no available indices, just pick a random one
    if (availableIndices.length === 0) {
        return accents[Math.floor(Math.random() * accents.length)];
    }
    
    // Pick a random available color
    const selectedIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    usedAccentIndices.add(selectedIndex);
    
    return accents[selectedIndex];
}

function updateUsedColors() {
    // Update the used colors set based on existing envelopes
    usedAccentIndices.clear();
    envelopes.forEach(env => {
        const colorIndex = accents.findIndex(accent => 
            accent[0] === env.grad[0] && accent[1] === env.grad[1]
        );
        if (colorIndex !== -1) {
            usedAccentIndices.add(colorIndex);
        }
    });
}

function cryptoRandomId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2, 10);
}

function saveToLocalStorage() {
    localStorage.setItem('envelopes', JSON.stringify(envelopes));
}

// Enhanced validation functions
function validateNumber(value, min = 0) {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min ? num : null;
}

function validateString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// Firebase operations wrapper
async function saveEnvelopeToDatabase(envelope) {
    if (window.firebaseOperations) {
        try {
            await window.firebaseOperations.saveEnvelope(envelope);
        } catch (error) {
            console.error('Failed to save envelope to database:', error);
        }
    }
}

async function deleteEnvelopeFromDatabase(envelopeId) {
    if (window.firebaseOperations) {
        try {
            await window.firebaseOperations.deleteEnvelope(envelopeId);
        } catch (error) {
            console.error('Failed to delete envelope from database:', error);
        }
    }
}

async function addExpenseToDatabase(envelopeId, expense) {
    if (window.firebaseOperations) {
        try {
            await window.firebaseOperations.addExpense(envelopeId, expense);
        } catch (error) {
            console.error('Failed to add expense to database:', error);
        }
    }
}

function render(isNew = false) {
    track.innerHTML = "";
    
    envelopes.forEach((env, idx) => {
        const card = document.createElement("article");
        card.className = "envelope" + (isNew && idx === envelopes.length - 1 ? " new" : "");
        card.dataset.index = idx;
        card.dataset.id = env.id;
        card.style.setProperty("--grad", `linear-gradient(135deg, ${env.grad[0]}, ${env.grad[1]})`);

        card.innerHTML = `
            <div class="cover"></div>
            <div class="veil"></div>
            <div class="meta">
                <div class="row">
                    <div class="kv">${new Date().toLocaleDateString()}</div>
                </div>
                <div class="title">${escapeHtml(env.name)}</div>
                <div class="progress"><span></span></div>
                <div class="row">
                    <div class="kv">Budget <b>₹${formatMoney(env.budget)}</b></div>
                    <div class="kv">Spent <b>₹${formatMoney(env.spent)}</b></div>
                </div>
            </div>
            <button class="delete-btn" title="Delete envelope">🗑️</button>
        `;

        track.appendChild(card);

        const pct = Math.max(0, Math.min(100, Math.round((env.spent / Math.max(1, env.budget)) * 100)));
        requestAnimationFrame(() => {
            card.querySelector(".progress > span").style.width = pct + "%";
        });

        setupInteractions(card, idx, env);
    });
    
    layout();
}

function setupInteractions(card, idx, env) {
    card.addEventListener("click", (ev) => {
        // Don't trigger if the delete button was clicked
        if (ev.target.closest('.delete-btn')) return;
        
        const isActive = idx === activeIndex;
        if (!isActive) {
            activeIndex = idx;
            layout();
            return;
        }
        
        // Open the envelope detail view
        openEnvelopeDetail(env);
    });

    // Add event listener for the delete button
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        envelopeToDelete = env.id;
        deleteDlg.showModal();
    });

    card.addEventListener("mouseenter", () => {
        if (idx === activeIndex) return;
        card.classList.add("peek");
        card.style.transition = "transform .25s var(--ease), filter .25s var(--ease), opacity .25s var(--ease), z-index 0s";
        const t = parseTransform(card.style.transform);
        card.style.transform = `${t.translate} translateZ(80px) ${t.rotate} scale(1.05)`;
    });
    
    card.addEventListener("mouseleave", () => {
        card.classList.remove("peek");
        layout();
    });

    // Subtle tilt for the active card
    let tiltRAF = null;
    card.addEventListener("mousemove", (e) => {
        if (idx !== activeIndex || card.classList.contains("expanded")) return;
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2);
        const dy = (e.clientY - cy) / (rect.height / 2);
        const max = 8;
        const rx = (-dy * max);
        const ry = (dx * max);
        
        cancelAnimationFrame(tiltRAF);
        tiltRAF = requestAnimationFrame(() => {
            const t = parseTransform(card.style.transform);
            card.style.transform = `${t.translate} translateZ(160px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`;
        });
    });
    
    card.addEventListener("mouseleave", () => {
        if (idx !== activeIndex) return;
        layout();
    });
}

function openEnvelopeDetail(env) {
    currentDetailId = env.id;
    updateDetailView();
    envelopeDetail.classList.add('active');
}

function updateDetailView() {
    const envelope = envelopes.find(env => env.id === currentDetailId);
    if (!envelope) return;
    
    detailTitle.textContent = envelope.name;
    detailBudget.textContent = `₹${formatMoney(envelope.budget)}`;
    detailSpent.textContent = `₹${formatMoney(envelope.spent)}`;
    detailRemaining.textContent = `₹${formatMoney(Math.max(0, envelope.budget - envelope.spent))}`;
    
    // Update expense list
    expenseList.innerHTML = '';
    
    if (envelope.expenses && envelope.expenses.length > 0) {
        // Sort expenses by date (newest first)
        const sortedExpenses = [...envelope.expenses].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        sortedExpenses.forEach(expense => {
            const logItem = document.createElement('div');
            logItem.className = 'log-item';
            logItem.innerHTML = `
                <span class="log-amount">₹${formatMoney(expense.amount)}</span>
                <span class="log-note">${escapeHtml(expense.note)}</span>
            `;
            expenseList.appendChild(logItem);
        });
    } else {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-log';
        emptyMessage.textContent = 'No expenses yet. Add your first expense above.';
        expenseList.appendChild(emptyMessage);
    }
}

function updateDashboard() {
    if (envelopes.length === 0) {
        totalBudgetEl.textContent = "₹0";
        totalSpentEl.textContent = "₹0";
        remainingBudgetEl.textContent = "₹0";
        envelopesCountEl.textContent = "0";
        
        // Clear charts
        if (categoryChart) categoryChart.destroy();
        if (budgetChart) budgetChart.destroy();
        return;
    }
    
    // Calculate totals
    const totalBudget = envelopes.reduce((sum, env) => sum + env.budget, 0);
    const totalSpent = envelopes.reduce((sum, env) => sum + env.spent, 0);
    const remainingBudget = totalBudget - totalSpent;
    
    // Update dashboard numbers
    totalBudgetEl.textContent = `₹${formatMoney(totalBudget)}`;
    totalSpentEl.textContent = `₹${formatMoney(totalSpent)}`;
    remainingBudgetEl.textContent = `₹${formatMoney(remainingBudget)}`;
    envelopesCountEl.textContent = envelopes.length.toString();
    
    // Update charts
    updateCharts();
}

function updateCharts() {
    // Skip chart updates if no envelopes
    if (envelopes.length === 0) {
        if (categoryChart) {
            categoryChart.destroy();
            categoryChart = null;
        }
        if (budgetChart) {
            budgetChart.destroy();
            budgetChart = null;
        }
        return;
    }
    
    // Prepare data for charts
    const categories = envelopes.map(env => env.name);
    const spentData = envelopes.map(env => env.spent);
    const budgetData = envelopes.map(env => env.budget);
    
    // Colors for charts (Chart.js doesn't support gradients directly, use primary colors)
    const backgroundColors = envelopes.map(env => env.grad[0]);
    
    // Destroy existing charts if they exist
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
    if (budgetChart) {
        budgetChart.destroy();
        budgetChart = null;
    }
    
    // Category spending chart
    const categoryCtx = document.getElementById('category-chart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: categories,
            datasets: [{
                data: spentData,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#e5e7eb',
                        font: {
                            family: 'Inter'
                        }
                    }
                }
            }
        }
    });
    
    // Budget vs spent chart
    const budgetCtx = document.getElementById('budget-chart').getContext('2d');
    budgetChart = new Chart(budgetCtx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [
                {
                    label: 'Budget',
                    data: budgetData,
                    backgroundColor: 'rgba(56, 189, 248, 0.5)',
                    borderColor: 'rgba(56, 189, 248, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Spent',
                    data: spentData,
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#e5e7eb'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#e5e7eb'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e5e7eb',
                        font: {
                            family: 'Inter'
                        }
                    }
                }
            }
        }
    });
}

function layout(initial = false) {
    const cards = Array.from(track.children);
    
    cards.forEach((card, i) => {
        const delta = i - activeIndex;
        const isActive = delta === 0;

        let tx = 0, tz = 0, ry = 0, sc = 1, cls = "", opacity = 1;
        const gap = 320; // increased horizontal spacing to prevent overlap
        
        if (isActive) {
            tx = 0;
            tz = 160;
            ry = 0;
            sc = 1.02;
            cls = "active";
        } else if (delta === -1 || (activeIndex === 0 && i === envelopes.length - 1)) {
            tx = -gap;
            tz = 0;
            ry = 18;
            sc = .94;
            cls = "side";
        } else if (delta === 1 || (activeIndex === envelopes.length - 1 && i === 0)) {
            tx = gap;
            tz = 0;
            ry = -18;
            sc = .94;
            cls = "side";
        } else {
            const absDelta = Math.abs(delta);
            const sign = Math.sign(delta);
            const depth = Math.min(3, absDelta - 1);
            
            tx = sign * (gap + 140 + (depth - 1) * 80); // increased spacing
            tz = -250 - (depth - 1) * 100; // pushed further back
            ry = -sign * 28; // slightly more rotation
            sc = .82 - (depth - 1) * .04; // smaller scale
            cls = "back";
            opacity = .65 - (depth - 1) * .1; // more transparent
        }

        card.classList.remove("active", "side", "back", "peek", "expanded");
        card.classList.add(cls);
        
        // Improved z-index management to prevent overlapping
        let zIndex;
        if (isActive) {
            zIndex = 10;
        } else if (cls === "side") {
            zIndex = 6;
        } else if (cls === "back") {
            zIndex = Math.max(1, 4 - Math.abs(delta));
        } else {
            zIndex = 2;
        }
        
        card.style.zIndex = zIndex;
        card.style.opacity = opacity.toString();
        card.style.transform = `translate(-50%,-50%) translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`;
        
        if (initial && isActive) {
            // small lift-in on first render
            card.style.transform += " translateY(-2px)";
        }
    });
}

function parseTransform(str) {
    // Very small helper to retain translate/rotate/scale ordering when tilting
    const has = str || "";
    const translate = has.match(/translate\([^)]+\)/g)?.[0] || "translate(-50%,-50%)";
    const translateX = has.match(/translateX\([^)]+\)/g)?.[0] || "translateX(0px)";
    const translateZ = has.match(/translateZ\([^)]+\)/g)?.[0] || "translateZ(160px)";
    const rotateY = has.match(/rotateY\([^)]+\)/g)?.[0] || "rotateY(0deg)";
    const rotateX = has.match(/rotateX\([^)]+\)/g)?.[0] || "rotateX(0deg)";
    const scale = has.match(/scale\([^)]+\)/g)?.[0] || "scale(1)";
    
    return {
        translate: `${translate} ${translateX}`,
        rotate: `${rotateX} ${rotateY}`,
        scale: `${scale}`
    };
}

function formatMoney(n) {
    // Handle NaN and invalid values
    if (isNaN(n) || n === null || n === undefined) {
        return '0';
    }
    
    const num = parseFloat(n);
    if (isNaN(num)) {
        return '0';
    }
    
    // Format as Indian Rupees with proper Indian numbering system
    return (Math.round(num * 100) / 100).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function escapeHtml(str) {
    // Handle null, undefined, or non-string values
    if (str === null || str === undefined || typeof str !== 'string') {
        return '';
    }
    
    return str.replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
    }[m]));
}
