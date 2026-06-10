const TOTAL_PAGES = 485;
const IMAGE_BASE_PATH = '../pages/warsh_muthamma_png/page';
const DEFAULT_LEFT_MARGIN = 0.03;
const DEFAULT_RIGHT_MARGIN = 0.97;
const HORIZONTAL_SNAP_THRESHOLD = 0.012;

let currentPage = 1;
let overlayEnabled = localStorage.getItem('warsh_muthamma_overlay') !== 'false'; // default true

// Data State
let currentLayoutData = null;
let currentAyahData = null;
let originalLineBands = null; // To compute offsets properly

// Selection and Drag State
let selectedItem = null; // { type: 'highlight'|'marker', index: number }
let selectedItemOriginals = null; // Storing original values for comparison
let isDragging = false;
let dragMode = 'move';
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartLeft = 0;
let dragStartRight = 0;
let dragStartCX = 0;
let dragStartCY = 0;
let dragStartLine = 0;
let dragStartImageY = 0;
let dragStartBandTop = 0;
let dragStartBandBottom = 0;

// Undo/redo history for the currently loaded page.
const HISTORY_LIMIT = 100;
let undoStack = [];
let redoStack = [];
let activeHistoryTransaction = null;

// Auto-save debounce timers
let ayahSaveTimeout;
let layoutSaveTimeout;

function autoSaveAyahData() {
    // Auto-save disabled as requested.
}

function autoSaveLayoutData() {
    // Auto-save disabled as requested.
}

const DOM = {
    img: document.getElementById('page-image'),
    pageText: document.getElementById('current-page-text'),
    jumpInput: document.getElementById('jump-input'),
    overlay: document.getElementById('overlay-container'),
    rightPanel: document.getElementById('right-panel'),
    boxInfo: document.getElementById('box-info'),
    hlControls: document.getElementById('highlight-controls'),
    mkControls: document.getElementById('marker-controls'),
    toast: document.getElementById('toast'),
    toggleOverlayBtn: document.getElementById('toggle-overlay-btn'),
    saveAllBtn: document.getElementById('save-all-btn'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn')
};

function showToast(msg, isError = false) {
    DOM.toast.textContent = msg;
    DOM.toast.style.background = isError ? '#f44336' : '#4CAF50';
    DOM.toast.style.opacity = 1;
    setTimeout(() => DOM.toast.style.opacity = 0, 3000);
}

function cloneData(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parseNumericInputValue(value, fallback = 0) {
    const normalized = String(value ?? '').trim().replace(/[،,]/g, '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampUnitValue(value) {
    return Math.min(1, Math.max(0, value));
}

function normalizeHighlightGeometry(highlight) {
    if (!highlight) return;
    highlight.left = clampUnitValue(parseNumericInputValue(highlight.left));
    highlight.right = clampUnitValue(parseNumericInputValue(highlight.right));
}

function normalizeMarkerGeometry(marker) {
    if (!marker) return;
    marker.center_x = clampUnitValue(parseNumericInputValue(marker.center_x));
    marker.center_y = clampUnitValue(parseNumericInputValue(marker.center_y, 0.5));
}

function normalizeAyahGeometry(data = currentAyahData) {
    if (!data) return;
    if (Array.isArray(data.ayah_highlights)) {
        data.ayah_highlights.forEach(normalizeHighlightGeometry);
    }
    if (Array.isArray(data.ayah_markers)) {
        data.ayah_markers.forEach(normalizeMarkerGeometry);
    }
}

function readHistoryInputValues() {
    const ids = [
        'global-y-offset',
        'global-scale',
        'global-height',
        'global-pad-left',
        'global-pad-right',
        'global-first-line-pad',
        'global-last-line-pad'
    ];
    return ids.reduce((values, id) => {
        const el = document.getElementById(id);
        if (el) values[id] = el.value;
        return values;
    }, {});
}

function writeHistoryInputValues(values) {
    Object.entries(values || {}).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    });
}

function createHistorySnapshot(label = '') {
    if (!currentLayoutData && !currentAyahData) return null;
    return {
        label,
        page: currentPage,
        currentLayoutData: cloneData(currentLayoutData),
        currentAyahData: cloneData(currentAyahData),
        originalLineBands: cloneData(originalLineBands),
        selectedItem: cloneData(selectedItem),
        selectedItemOriginals: cloneData(selectedItemOriginals),
        inputValues: readHistoryInputValues()
    };
}

function snapshotFingerprint(snapshot) {
    if (!snapshot) return '';
    return JSON.stringify({
        currentLayoutData: snapshot.currentLayoutData,
        currentAyahData: snapshot.currentAyahData,
        originalLineBands: snapshot.originalLineBands,
        selectedItem: snapshot.selectedItem,
        inputValues: snapshot.inputValues
    });
}

function updateUndoRedoButtons() {
    if (DOM.undoBtn) DOM.undoBtn.disabled = undoStack.length === 0;
    if (DOM.redoBtn) DOM.redoBtn.disabled = redoStack.length === 0;
    if (DOM.saveAllBtn) DOM.saveAllBtn.disabled = !currentLayoutData && !currentAyahData;
}

function resetHistory() {
    undoStack = [];
    redoStack = [];
    activeHistoryTransaction = null;
    updateUndoRedoButtons();
}

function pushUndoSnapshot(label = '') {
    const snapshot = createHistorySnapshot(label);
    if (!snapshot) return;

    const last = undoStack[undoStack.length - 1];
    if (last && snapshotFingerprint(last) === snapshotFingerprint(snapshot)) return;

    undoStack.push(snapshot);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
}

function beginHistoryTransaction(label = '') {
    if (activeHistoryTransaction) return;
    pushUndoSnapshot(label);
    activeHistoryTransaction = label || 'edit';
}

function endHistoryTransaction() {
    activeHistoryTransaction = null;
}

function restoreHistorySnapshot(snapshot) {
    if (!snapshot) return;
    currentLayoutData = cloneData(snapshot.currentLayoutData);
    currentAyahData = cloneData(snapshot.currentAyahData);
    originalLineBands = cloneData(snapshot.originalLineBands);
    selectedItem = cloneData(snapshot.selectedItem);
    selectedItemOriginals = cloneData(snapshot.selectedItemOriginals);
    writeHistoryInputValues(snapshot.inputValues);

    if (selectedItem && selectedItem.type === 'highlight' && !currentAyahData?.ayah_highlights?.[selectedItem.index]) {
        selectedItem = null;
        selectedItemOriginals = null;
    }
    if (selectedItem && selectedItem.type === 'marker' && !currentAyahData?.ayah_markers?.[selectedItem.index]) {
        selectedItem = null;
        selectedItemOriginals = null;
    }

    renderBoxes();
    if (selectedItem) openRightPanel();
    else clearRightPanel();
    if (typeof updateLeftPanelSaveButtons === 'function') updateLeftPanelSaveButtons();
    updateUndoRedoButtons();
}

function undoLastChange() {
    if (undoStack.length === 0) return;
    const current = createHistorySnapshot('redo');
    const previous = undoStack.pop();
    if (current) redoStack.push(current);
    activeHistoryTransaction = null;
    restoreHistorySnapshot(previous);
    showToast('تم التراجع');
}

function redoLastChange() {
    if (redoStack.length === 0) return;
    const current = createHistorySnapshot('undo');
    const next = redoStack.pop();
    if (current) undoStack.push(current);
    activeHistoryTransaction = null;
    restoreHistorySnapshot(next);
    showToast('تم الإرجاع');
}

async function saveToServer(filepath, content, onSuccessCallback) {
    try {
        const res = await fetch('/api/save-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath, content })
        });
        if (!res.ok) throw new Error('Save failed');
        showToast('تم الحفظ بنجاح');
        if (onSuccessCallback) onSuccessCallback();
        return true;
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء الحفظ! هل الخادم Node.js يعمل؟', true);
        return false;
    }
}

document.getElementById('toggle-overlay-btn').addEventListener('click', () => {
    overlayEnabled = !overlayEnabled;
    localStorage.setItem('warsh_muthamma_overlay', overlayEnabled);
    DOM.overlay.style.display = overlayEnabled ? 'block' : 'none';
    DOM.toggleOverlayBtn.style.color = overlayEnabled ? '#FF9800' : '#4CAF50';
    if (overlayEnabled) loadOverlayData(currentPage);
});

const savedPage = localStorage.getItem('warsh_muthamma_last_page');
if (savedPage) {
    let parsed = parseInt(savedPage);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= TOTAL_PAGES) currentPage = parsed;
}

function updatePage(page) {
    if (page < 1) page = 1;
    if (page > TOTAL_PAGES) page = TOTAL_PAGES;
    currentPage = page;
    
    const pageStr = String(currentPage).padStart(3, '0');
    DOM.img.src = `${IMAGE_BASE_PATH}${pageStr}.png`;
    if (DOM.pageText) DOM.pageText.textContent = currentPage;
    DOM.jumpInput.value = currentPage; 
    
    localStorage.setItem('warsh_muthamma_last_page', currentPage);
    closeRightPanel();
    
    // Reset left panel inputs
    document.getElementById('global-y-offset').value = 0;
    document.getElementById('global-scale').value = 1.0;
    document.getElementById('global-height').value = "";
    if (typeof updateLeftPanelSaveButtons === 'function') updateLeftPanelSaveButtons();

    if (overlayEnabled) {
        DOM.overlay.style.display = 'block';
        DOM.toggleOverlayBtn.style.color = '#FF9800';
        loadOverlayData(currentPage);
    } else {
        DOM.overlay.style.display = 'none';
        DOM.toggleOverlayBtn.style.color = '#4CAF50';
    }
}

async function loadOverlayData(page) {
    DOM.overlay.innerHTML = '';
    currentLayoutData = null;
    currentAyahData = null;
    originalLineBands = null;
    resetHistory();

    const pageStr = String(page).padStart(3, '0');
    const cacheBust = Date.now();
    const layoutUrl = `../databases/ayahinfo/warsh_muthamma/page_layout_json/page_${pageStr}.json?v=${cacheBust}`;
    const ayahUrl = `../databases/ayahinfo/warsh_muthamma/pages_json/page_${pageStr}.json?v=${cacheBust}`;

    try {
        const [layoutRes, ayahRes] = await Promise.all([
            fetch(layoutUrl, { cache: 'no-store' }),
            fetch(ayahUrl, { cache: 'no-store' })
        ]);
        if (!layoutRes.ok || !ayahRes.ok) throw new Error('Data not found');

        currentLayoutData = await layoutRes.json();
        currentAyahData = await ayahRes.json();
        normalizeAyahGeometry(currentAyahData);
        
        // Deep copy to store original lines for offset computing
        if (currentLayoutData.lineBands) {
            originalLineBands = JSON.parse(JSON.stringify(currentLayoutData.lineBands));
            if (originalLineBands.length > 0) {
                const avgHeight = Math.round(originalLineBands.reduce((sum, b) => sum + (b.bottom - b.top), 0) / originalLineBands.length);
                document.getElementById('global-height-orig').textContent = `الأصلية: ~${avgHeight}`;
            } else {
                document.getElementById('global-height-orig').textContent = `الأصلية: -`;
            }
        } else {
            document.getElementById('global-height-orig').textContent = `الأصلية: -`;
        }

        renderBoxes();
        resetHistory();
    } catch (err) {
        console.error("Could not load overlay data:", err);
        showToast("تعذر جلب البيانات. هل الخادم يعمل؟", true);
    }
}

function renderBoxes() {
    DOM.overlay.innerHTML = '';
    if (!currentLayoutData || !currentAyahData) return;

    const imgHeight = currentLayoutData.imageHeight || 2000;
    const lineMap = {};
    
    if (currentLayoutData.lineBands) {
        const padFirstTop = parseInt(document.getElementById('global-first-line-pad').value) || 0;
        const padLastBottom = parseInt(document.getElementById('global-last-line-pad').value) || 0;

        currentLayoutData.lineBands.forEach((b, index) => {
            let top = b.top;
            let bottom = b.bottom;

            if (index === 0) {
                top = Math.max(0, top - padFirstTop);
            }
            if (index === currentLayoutData.lineBands.length - 1) {
                bottom = bottom + padLastBottom;
            }

            lineMap[b.line] = {
                top: top / imgHeight * 100,
                height: (bottom - top) / imgHeight * 100
            };
        });
    }

    // Render Highlights
    if (currentAyahData.ayah_highlights) {
        const padLeft = parseNumericInputValue(document.getElementById('global-pad-left').value);
        const padRight = parseNumericInputValue(document.getElementById('global-pad-right').value);

        currentAyahData.ayah_highlights.forEach((h, index) => {
            const band = lineMap[h.line];
            if (band) {
                const div = document.createElement('div');
                div.className = 'highlight-box';
                const actualLeft = Math.max(0, h.left - padLeft);
                const actualRight = Math.min(1, h.right + padRight);

                const leftPct = Math.min(actualLeft, actualRight) * 100;
                const rightPct = Math.max(actualLeft, actualRight) * 100;
                const widthPct = rightPct - leftPct;

                div.style.top = band.top + '%';
                div.style.height = band.height + '%';
                div.style.left = leftPct + '%';
                div.style.width = widthPct + '%';
                div.title = `سورة ${h.sura} آية ${h.ayah}`;

                const label = document.createElement('span');
                label.className = 'ayah-label';
                label.textContent = h.ayah;
                div.appendChild(label);
                
                if (selectedItem && selectedItem.type === 'highlight' && selectedItem.index === index) {
                    div.classList.add('selected-box');
                    
                    const edges = ['left', 'right', 'top', 'bottom'];
                    edges.forEach(edge => {
                        const handle = document.createElement('div');
                        handle.className = `box-resize-handle ${edge}`;
                        handle.addEventListener('mousedown', (e) => {
                            if (e.button !== 0) return; // Only left click
                            e.stopPropagation(); // prevent box mousedown
                            selectItem('highlight', index);
                            beginHistoryTransaction('resize highlight');
                            isDragging = true;
                            dragMode = `resize-${edge}`;
                            dragStartMouseX = e.clientX;
                            dragStartMouseY = e.clientY;
                            dragStartLeft = h.left;
                            dragStartRight = h.right;
                            
                            const bandObj = currentLayoutData.lineBands.find(b => b.line === h.line);
                            if (bandObj) {
                                dragStartBandTop = bandObj.top;
                                dragStartBandBottom = bandObj.bottom;
                            }
                        });
                        handle.addEventListener('dblclick', (e) => {
                            if (edge !== 'left' && edge !== 'right') return;
                            e.preventDefault();
                            e.stopPropagation();
                            selectItem('highlight', index);
                            pushUndoSnapshot(`snap ${edge} edge to margin`);
                            if (edge === 'left') {
                                h.left = DEFAULT_LEFT_MARGIN;
                            } else {
                                h.right = DEFAULT_RIGHT_MARGIN;
                            }
                            normalizeHighlightGeometry(h);
                            renderBoxes();
                            openRightPanel();
                            autoSaveAyahData();
                        });
                        div.appendChild(handle);
                    });
                    
                    // Add alignment toolbar
                    const toolbar = document.createElement('div');
                    toolbar.className = 'box-toolbar';
                    
                    const btnRight = document.createElement('button');
                    btnRight.innerHTML = '⭲';
                    btnRight.title = 'تمديد للحد الأيمن';
                    btnRight.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
                    btnRight.addEventListener('click', (e) => {
                        e.stopPropagation();
                        pushUndoSnapshot('snap right edge to margin');
                        h.right = DEFAULT_RIGHT_MARGIN;
                        normalizeHighlightGeometry(h);
                        renderBoxes();
                        openRightPanel();
                        autoSaveAyahData();
                    });

                    const btnFull = document.createElement('button');
                    btnFull.innerHTML = '⭤';
                    btnFull.title = 'تمديد للحدين الأيمن والأيسر';
                    btnFull.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
                    btnFull.addEventListener('click', (e) => {
                        e.stopPropagation();
                        pushUndoSnapshot('snap both edges to margins');
                        h.left = DEFAULT_LEFT_MARGIN;
                        h.right = DEFAULT_RIGHT_MARGIN;
                        normalizeHighlightGeometry(h);
                        renderBoxes();
                        openRightPanel();
                        autoSaveAyahData();
                    });

                    const btnLeft = document.createElement('button');
                    btnLeft.innerHTML = '⭰';
                    btnLeft.title = 'تمديد للحد الأيسر';
                    btnLeft.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
                    btnLeft.addEventListener('click', (e) => {
                        e.stopPropagation();
                        pushUndoSnapshot('snap left edge to margin');
                        h.left = DEFAULT_LEFT_MARGIN;
                        normalizeHighlightGeometry(h);
                        renderBoxes();
                        openRightPanel();
                        autoSaveAyahData();
                    });

                    const btnMinus = document.createElement('button');
                    btnMinus.innerHTML = '-';
                    btnMinus.title = 'إنقاص رقم الآية';
                    btnMinus.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
                    btnMinus.addEventListener('click', (e) => {
                        e.stopPropagation();
                        pushUndoSnapshot('decrement ayah number');
                        h.ayah = Math.max(1, h.ayah - 1);
                        renderBoxes();
                        openRightPanel();
                        autoSaveAyahData();
                    });

                    const btnPlus = document.createElement('button');
                    btnPlus.innerHTML = '+';
                    btnPlus.title = 'زيادة رقم الآية';
                    btnPlus.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
                    btnPlus.addEventListener('click', (e) => {
                        e.stopPropagation();
                        pushUndoSnapshot('increment ayah number');
                        h.ayah++;
                        renderBoxes();
                        openRightPanel();
                        autoSaveAyahData();
                    });

                    const btnDup = document.createElement('button');
                    btnDup.innerHTML = '⧉';
                    btnDup.title = 'تكرار المربع';
                    btnDup.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
                    btnDup.addEventListener('click', (e) => {
                        e.stopPropagation();
                        pushUndoSnapshot('duplicate highlight box');
                        const newH = JSON.parse(JSON.stringify(h));
                        currentAyahData.ayah_highlights.splice(index + 1, 0, newH);
                        selectItem('highlight', index + 1);
                        renderBoxes();
                        openRightPanel();
                        autoSaveAyahData();
                    });

                    const btnDel = document.createElement('button');
                    btnDel.innerHTML = '🗑';
                    btnDel.title = 'حذف المربع';
                    btnDel.style.color = '#ff5252';
                    btnDel.addEventListener('mousedown', (e) => { e.stopPropagation(); e.preventDefault(); });
                    btnDel.addEventListener('click', (e) => {
                        e.stopPropagation();
                        pushUndoSnapshot('delete highlight box');
                        currentAyahData.ayah_highlights.splice(index, 1);
                        selectedItem = null;
                        renderBoxes();
                        openRightPanel();
                        autoSaveAyahData();
                    });

                    toolbar.appendChild(btnDel);
                    toolbar.appendChild(btnDup);
                    toolbar.appendChild(btnMinus);
                    toolbar.appendChild(btnPlus);
                    toolbar.appendChild(btnRight);
                    toolbar.appendChild(btnFull);
                    toolbar.appendChild(btnLeft);
                    div.appendChild(toolbar);
                }

                div.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return; // Only left click
                    e.stopPropagation();
                    selectItem('highlight', index);
                    beginHistoryTransaction('move highlight');
                    isDragging = true;
                    dragMode = 'move';
                    dragStartMouseX = e.clientX;
                    dragStartMouseY = e.clientY;
                    dragStartLeft = h.left;
                    dragStartRight = h.right;
                });
                DOM.overlay.appendChild(div);
            }
        });
    }

    // Render Markers
    if (currentAyahData.ayah_markers) {
        currentAyahData.ayah_markers.forEach((m, index) => {
            const band = lineMap[m.line];
            if (band) {
                const div = document.createElement('div');
                div.className = 'marker-box';
                const cx = m.center_x * 100;
                const cy = band.top + ((m.center_y || 0.5) * band.height);

                div.style.left = cx + '%';
                div.style.top = cy + '%';
                div.style.width = '2.5%';
                div.style.aspectRatio = '1 / 1';
                div.title = `نهاية الآية ${m.ayah}`;
                
                const label = document.createElement('span');
                label.className = 'ayah-label marker-label';
                label.textContent = m.ayah;
                div.appendChild(label);
                
                if (selectedItem && selectedItem.type === 'marker' && selectedItem.index === index) {
                    div.classList.add('selected-box');
                }

                div.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    selectItem('marker', index);
                    beginHistoryTransaction('move marker');
                    isDragging = true;
                    dragStartMouseX = e.clientX;
                    dragStartMouseY = e.clientY;
                    dragStartCX = m.center_x;
                    dragStartCY = m.center_y || 0.5;
                    dragStartLine = m.line;
                    dragStartImageY = getMarkerImageY(m);
                });
                DOM.overlay.appendChild(div);
            }
        });
    }
}

// Selection Logic
function selectItem(type, index) {
    // Keep original values when first selected
    if (!selectedItem || selectedItem.type !== type || selectedItem.index !== index) {
        if (type === 'highlight') {
            const h = currentAyahData.ayah_highlights[index];
            selectedItemOriginals = { left: h.left, right: h.right, sura: h.sura, ayah: h.ayah, line: h.line };
        } else if (type === 'marker') {
            const m = currentAyahData.ayah_markers[index];
            selectedItemOriginals = { center_x: m.center_x, center_y: m.center_y || 0.5, line: m.line, sura: m.sura, ayah: m.ayah };
        }
    }
    selectedItem = { type, index };
    renderBoxes(); // Refresh to show selection outline
    openRightPanel();
}

// Drag events on document
document.addEventListener('mousemove', (e) => {
    if (!isDragging || !selectedItem || !currentAyahData) return;
    
    const imgRect = DOM.img.getBoundingClientRect();
    const deltaX = (e.clientX - dragStartMouseX) / imgRect.width;
    
    if (selectedItem.type === 'highlight') {
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        if (dragMode === 'move') {
            h.left = dragStartLeft + deltaX;
            h.right = dragStartRight + deltaX;
        } else if (dragMode === 'resize-left') {
            h.left = dragStartLeft + deltaX;
        } else if (dragMode === 'resize-right') {
            h.right = dragStartRight + deltaX;
        } else if (dragMode === 'resize-top' || dragMode === 'resize-bottom') {
            const band = currentLayoutData.lineBands.find(b => b.line === h.line);
            if (band) {
                const deltaY = (e.clientY - dragStartMouseY) / imgRect.height * currentLayoutData.imageHeight;
                if (dragMode === 'resize-top') {
                    band.top = Math.round(dragStartBandTop + deltaY);
                } else if (dragMode === 'resize-bottom') {
                    band.bottom = Math.round(dragStartBandBottom + deltaY);
                }
            }
        }
        applyHighlightMagneticSnap(h, selectedItem.index, dragMode);
        normalizeHighlightGeometry(h);
    } else if (selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedItem.index];
        const oldLine = m.line;
        const oldCenterX = m.center_x;
        
        // Keyboard modifier constraints
        const lockVertical = e.shiftKey && !e.ctrlKey; // Shift alone -> horizontal only
        const lockHorizontal = e.shiftKey && e.ctrlKey; // Ctrl+Shift -> vertical only
        
        if (lockHorizontal) {
            m.center_x = dragStartCX;
        } else {
            m.center_x = clampUnitValue(dragStartCX + deltaX);
        }
        
        if (lockVertical) {
            m.line = dragStartLine;
            m.center_y = dragStartCY;
        } else {
            const deltaYImage = (e.clientY - dragStartMouseY) / imgRect.height * currentLayoutData.imageHeight;
            setMarkerPositionFromImageY(m, dragStartImageY + deltaYImage);
        }
        normalizeMarkerGeometry(m);

        if (oldLine !== m.line) {
            syncMarkerLineChange(m, oldLine, oldCenterX);
        }
        if (typeof syncHighlightWithMarker === 'function') {
            syncHighlightWithMarker(m, { allowCreateNext: shouldCreateNextHighlightOnMarkerMove() });
        }
    }
    renderBoxes();
    openRightPanel(); // refresh inputs
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        const wasMarkerPreview = selectedItem && selectedItem.type === 'marker';
        isDragging = false;
        if (wasMarkerPreview) {
            // Marker dragging is a live preview only. Persist it explicitly with
            // the small save button or the main ayah save button.
        } else if (selectedItem && selectedItem.type === 'highlight' && (dragMode === 'resize-top' || dragMode === 'resize-bottom')) {
            autoSaveLayoutData();
        } else {
            autoSaveAyahData();
        }
        dragMode = 'move';
        endHistoryTransaction();
    }
});

function openRightPanel() {
    if (!selectedItem || !currentAyahData) {
        clearRightPanel();
        return;
    }

    const adjSection = document.getElementById('ayah-adjustment-section');
    if (adjSection) adjSection.style.display = 'block';

    const btnSave = document.getElementById('save-ayah-btn');
    btnSave.disabled = false;
    btnSave.style.opacity = 1;
    btnSave.style.cursor = 'pointer';
    const deleteHighlightBtn = document.getElementById('delete-highlight-btn');
    if (deleteHighlightBtn) {
        deleteHighlightBtn.disabled = selectedItem.type !== 'highlight';
    }

    const badge = document.getElementById('save-status-badge');
    badge.style.background = "";
    badge.style.color = "";
    badge.style.border = "";
    
    if (selectedItem.type === 'highlight') {
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        
        document.getElementById('meta-type').textContent = "تظليل آية";
        if (document.activeElement !== document.getElementById('meta-sura')) document.getElementById('meta-sura').value = h.sura;
        if (document.activeElement !== document.getElementById('meta-ayah')) document.getElementById('meta-ayah').value = h.ayah;
        if (document.activeElement !== document.getElementById('meta-line')) document.getElementById('meta-line').value = h.line;

        document.getElementById('highlight-value-fields').style.display = 'flex';
        document.getElementById('marker-value-fields').style.display = 'none';

        // Input values
        if (document.activeElement !== document.getElementById('hl-left')) {
            document.getElementById('hl-left').value = h.left;
        }
        if (document.activeElement !== document.getElementById('hl-right')) {
            document.getElementById('hl-right').value = h.right;
        }
        
        // Line top/bottom inputs
        let isTopChanged = false;
        let isBottomChanged = false;
        const band = currentLayoutData.lineBands.find(b => b.line === h.line);
        if (band) {
            if (document.activeElement !== document.getElementById('hl-line-top')) {
                document.getElementById('hl-line-top').value = band.top;
            }
            if (document.activeElement !== document.getElementById('hl-line-bottom')) {
                document.getElementById('hl-line-bottom').value = band.bottom;
            }
            
            const origBand = originalLineBands ? originalLineBands.find(b => b.line === h.line) : band;
            document.getElementById('line-top-orig').textContent = origBand ? origBand.top : band.top;
            document.getElementById('line-top-curr').textContent = band.top;
            document.getElementById('line-bottom-orig').textContent = origBand ? origBand.bottom : band.bottom;
            document.getElementById('line-bottom-curr').textContent = band.bottom;
            
            // Calculate heights (Bottom - Top)
            const origHeight = origBand ? (origBand.bottom - origBand.top) : (band.bottom - band.top);
            const currHeight = band.bottom - band.top;
            document.getElementById('line-height-orig').textContent = origHeight;
            document.getElementById('line-height-curr').textContent = currHeight;

            isTopChanged = origBand && origBand.top !== band.top;
            isBottomChanged = origBand && origBand.bottom !== band.bottom;
        }

        // Compare values
        const origLeft = selectedItemOriginals ? selectedItemOriginals.left : h.left;
        const origRight = selectedItemOriginals ? selectedItemOriginals.right : h.right;
        document.getElementById('hl-left-orig').textContent = origLeft.toFixed(4);
        document.getElementById('hl-left-curr').textContent = h.left.toFixed(4);
        document.getElementById('hl-right-orig').textContent = origRight.toFixed(4);
        document.getElementById('hl-right-curr').textContent = h.right.toFixed(4);

        // Update badge state
        const origSura = selectedItemOriginals ? selectedItemOriginals.sura : h.sura;
        const origAyah = selectedItemOriginals ? selectedItemOriginals.ayah : h.ayah;
        const origLine = selectedItemOriginals ? selectedItemOriginals.line : h.line;
        
        document.getElementById('meta-sura-orig').textContent = origSura;
        document.getElementById('meta-sura-curr').textContent = h.sura;
        document.getElementById('meta-ayah-orig').textContent = origAyah;
        document.getElementById('meta-ayah-curr').textContent = h.ayah;
        document.getElementById('meta-line-orig').textContent = origLine;
        document.getElementById('meta-line-curr').textContent = h.line;

        const isSuraChanged = h.sura !== origSura;
        const isAyahChanged = h.ayah !== origAyah;
        const isLineChangedMeta = h.line !== origLine;

        const isLeftChanged = Math.abs(h.left - origLeft) > 0.00001;
        const isRightChanged = Math.abs(h.right - origRight) > 0.00001;
        const isChanged = isLeftChanged || isRightChanged || isTopChanged || isBottomChanged || isSuraChanged || isAyahChanged || isLineChangedMeta;
        
        if (isChanged) {
            badge.textContent = "غير محفوظ ⚠️";
            badge.className = "badge badge-unsaved";
        } else {
            badge.textContent = "تم الحفظ ✓";
            badge.className = "badge badge-saved";
        }

        // Update inline save buttons
        const btnSaveLeft = document.getElementById('save-hl-left');
        const btnSaveRight = document.getElementById('save-hl-right');
        const btnSaveTop = document.getElementById('save-hl-line-top');
        const btnSaveBottom = document.getElementById('save-hl-line-bottom');
        
        if (isLeftChanged) {
            btnSaveLeft.className = "save-inline-btn unsaved";
            btnSaveLeft.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveLeft.className = "save-inline-btn saved";
            btnSaveLeft.title = "تم الحفظ";
        }
        if (isRightChanged) {
            btnSaveRight.className = "save-inline-btn unsaved";
            btnSaveRight.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveRight.className = "save-inline-btn saved";
            btnSaveRight.title = "تم الحفظ";
        }
        if (isTopChanged) {
            btnSaveTop.className = "save-inline-btn unsaved";
            btnSaveTop.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveTop.className = "save-inline-btn saved";
            btnSaveTop.title = "تم الحفظ";
        }
        if (isBottomChanged) {
            btnSaveBottom.className = "save-inline-btn unsaved";
            btnSaveBottom.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveBottom.className = "save-inline-btn saved";
            btnSaveBottom.title = "تم الحفظ";
        }

    } else if (selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedItem.index];
        
        document.getElementById('meta-type').textContent = "علامة نهاية آية";
        if (document.activeElement !== document.getElementById('meta-sura')) document.getElementById('meta-sura').value = m.sura;
        if (document.activeElement !== document.getElementById('meta-ayah')) document.getElementById('meta-ayah').value = m.ayah;
        if (document.activeElement !== document.getElementById('meta-line')) document.getElementById('meta-line').value = m.line;

        document.getElementById('highlight-value-fields').style.display = 'none';
        document.getElementById('marker-value-fields').style.display = 'flex';

        // Input values
        if (document.activeElement !== document.getElementById('mk-cx')) {
            document.getElementById('mk-cx').value = m.center_x;
        }
        if (document.activeElement !== document.getElementById('mk-cy')) {
            document.getElementById('mk-cy').value = m.center_y || 0.5;
        }
        if (document.activeElement !== document.getElementById('mk-line')) {
            document.getElementById('mk-line').value = m.line;
        }
        const mkLineInput = document.getElementById('mk-line');
        if (currentLayoutData && currentLayoutData.lineBands) {
            mkLineInput.min = 1;
            mkLineInput.max = currentLayoutData.lineBands.length;
        }

        // Compare values
        const origCX = selectedItemOriginals ? selectedItemOriginals.center_x : m.center_x;
        const origCY = selectedItemOriginals ? selectedItemOriginals.center_y : (m.center_y || 0.5);
        const origLine = selectedItemOriginals ? selectedItemOriginals.line : m.line;
        const currCY = m.center_y || 0.5;

        document.getElementById('mk-cx-orig').textContent = origCX.toFixed(4);
        document.getElementById('mk-cx-curr').textContent = m.center_x.toFixed(4);
        document.getElementById('mk-cy-orig').textContent = origCY.toFixed(4);
        document.getElementById('mk-cy-curr').textContent = currCY.toFixed(4);
        document.getElementById('mk-line-orig').textContent = origLine;
        document.getElementById('mk-line-curr').textContent = m.line;

        const origSura = selectedItemOriginals ? selectedItemOriginals.sura : m.sura;
        const origAyah = selectedItemOriginals ? selectedItemOriginals.ayah : m.ayah;

        document.getElementById('meta-sura-orig').textContent = origSura;
        document.getElementById('meta-sura-curr').textContent = m.sura;
        document.getElementById('meta-ayah-orig').textContent = origAyah;
        document.getElementById('meta-ayah-curr').textContent = m.ayah;
        document.getElementById('meta-line-orig').textContent = origLine;
        document.getElementById('meta-line-curr').textContent = m.line;

        const isSuraChanged = m.sura !== origSura;
        const isAyahChanged = m.ayah !== origAyah;

        // Update badge state
        const isCXChanged = Math.abs(m.center_x - origCX) > 0.00001;
        const isCYChanged = Math.abs(currCY - origCY) > 0.00001;
        const isLineChanged = m.line !== origLine;
        const isChanged = isCXChanged || isCYChanged || isLineChanged || isSuraChanged || isAyahChanged;

        if (isChanged) {
            badge.textContent = "غير محفوظ ⚠️";
            badge.className = "badge badge-unsaved";
        } else {
            badge.textContent = "تم الحفظ ✓";
            badge.className = "badge badge-saved";
        }

        // Update inline save buttons
        const btnSaveCX = document.getElementById('save-mk-cx');
        const btnSaveCY = document.getElementById('save-mk-cy');
        const btnSaveLine = document.getElementById('save-mk-line');
        if (isCXChanged) {
            btnSaveCX.className = "save-inline-btn unsaved";
            btnSaveCX.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveCX.className = "save-inline-btn saved";
            btnSaveCX.title = "تم الحفظ";
        }
        if (isCYChanged) {
            btnSaveCY.className = "save-inline-btn unsaved";
            btnSaveCY.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveCY.className = "save-inline-btn saved";
            btnSaveCY.title = "تم الحفظ";
        }
        if (isLineChanged) {
            btnSaveLine.className = "save-inline-btn unsaved";
            btnSaveLine.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveLine.className = "save-inline-btn saved";
            btnSaveLine.title = "تم الحفظ";
        }

        // Meta fields
        const isSuraChangedMeta = selectedItem.type === 'highlight' ? currentAyahData.ayah_highlights[selectedItem.index].sura !== (selectedItemOriginals ? selectedItemOriginals.sura : currentAyahData.ayah_highlights[selectedItem.index].sura) : m.sura !== (selectedItemOriginals ? selectedItemOriginals.sura : m.sura);
        const isAyahChangedMeta = selectedItem.type === 'highlight' ? currentAyahData.ayah_highlights[selectedItem.index].ayah !== (selectedItemOriginals ? selectedItemOriginals.ayah : currentAyahData.ayah_highlights[selectedItem.index].ayah) : m.ayah !== (selectedItemOriginals ? selectedItemOriginals.ayah : m.ayah);
        const isLineChangedMeta = selectedItem.type === 'highlight' ? currentAyahData.ayah_highlights[selectedItem.index].line !== (selectedItemOriginals ? selectedItemOriginals.line : currentAyahData.ayah_highlights[selectedItem.index].line) : m.line !== (selectedItemOriginals ? selectedItemOriginals.line : m.line);

        const btnSaveMetaSura = document.getElementById('save-meta-sura');
        const btnSaveMetaAyah = document.getElementById('save-meta-ayah');
        const btnSaveMetaLine = document.getElementById('save-meta-line');

        if (isSuraChangedMeta) {
            btnSaveMetaSura.className = "save-inline-btn unsaved";
            btnSaveMetaSura.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveMetaSura.className = "save-inline-btn saved";
            btnSaveMetaSura.title = "تم الحفظ";
        }
        if (isAyahChangedMeta) {
            btnSaveMetaAyah.className = "save-inline-btn unsaved";
            btnSaveMetaAyah.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveMetaAyah.className = "save-inline-btn saved";
            btnSaveMetaAyah.title = "تم الحفظ";
        }
        if (isLineChangedMeta) {
            btnSaveMetaLine.className = "save-inline-btn unsaved";
            btnSaveMetaLine.title = "تغيير غير محفوظ - انقر للحفظ";
        } else {
            btnSaveMetaLine.className = "save-inline-btn saved";
            btnSaveMetaLine.title = "تم الحفظ";
        }
    }
}

function clearRightPanel() {
    const adjSection = document.getElementById('ayah-adjustment-section');
    if (adjSection) adjSection.style.display = 'none';

    document.getElementById('meta-type').textContent = "-";
    document.getElementById('meta-sura').value = "";
    document.getElementById('meta-ayah').value = "";
    document.getElementById('meta-line').value = "";

    const badge = document.getElementById('save-status-badge');
    badge.textContent = "لا يوجد اختيار";
    badge.className = "badge";
    badge.style.background = "rgba(255, 255, 255, 0.05)";
    badge.style.color = "#aaa";
    badge.style.border = "1px solid rgba(255, 255, 255, 0.1)";

    // Hide value fields when nothing is selected
    document.getElementById('highlight-value-fields').style.display = 'none';
    document.getElementById('marker-value-fields').style.display = 'none';

    document.getElementById('hl-left').value = "";
    document.getElementById('hl-right').value = "";
    document.getElementById('hl-line-top').value = "";
    document.getElementById('hl-line-bottom').value = "";
    document.getElementById('mk-cx').value = "";
    document.getElementById('mk-cy').value = "";
    document.getElementById('mk-line').value = "";

    // Reset comparison texts
    document.getElementById('hl-left-orig').textContent = "-";
    document.getElementById('hl-left-curr').textContent = "-";
    document.getElementById('hl-right-orig').textContent = "-";
    document.getElementById('hl-right-curr').textContent = "-";
    document.getElementById('mk-cx-orig').textContent = "-";
    document.getElementById('mk-cx-curr').textContent = "-";
    document.getElementById('mk-cy-orig').textContent = "-";
    document.getElementById('mk-cy-curr').textContent = "-";
    document.getElementById('mk-line-orig').textContent = "-";
    document.getElementById('mk-line-curr').textContent = "-";
    document.getElementById('meta-sura-orig').textContent = "-";
    document.getElementById('meta-sura-curr').textContent = "-";
    document.getElementById('meta-ayah-orig').textContent = "-";
    document.getElementById('meta-ayah-curr').textContent = "-";
    document.getElementById('meta-line-orig').textContent = "-";
    document.getElementById('meta-line-curr').textContent = "-";
    document.getElementById('line-height-orig').textContent = "-";
    document.getElementById('line-height-curr').textContent = "-";

    const ids = ['save-hl-left', 'save-hl-right', 'save-hl-line-top', 'save-hl-line-bottom', 'save-mk-cx', 'save-mk-cy', 'save-mk-line', 'save-meta-sura', 'save-meta-ayah', 'save-meta-line'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.className = "save-inline-btn saved";
            btn.title = "لا يوجد اختيار";
        }
    });

    const btnSave = document.getElementById('save-ayah-btn');
    btnSave.disabled = true;
    btnSave.style.opacity = 0.5;
    btnSave.style.cursor = 'not-allowed';

    const deleteHighlightBtn = document.getElementById('delete-highlight-btn');
    if (deleteHighlightBtn) deleteHighlightBtn.disabled = true;
}

function closeRightPanel() {
    selectedItem = null;
    selectedItemOriginals = null;
    renderBoxes();
    clearRightPanel();
}

document.getElementById('close-right-panel').addEventListener('click', closeRightPanel);
DOM.img.addEventListener('click', closeRightPanel); // clicking image deselects

// Meta inputs (Sura, Ayah, Line)
document.getElementById('meta-sura').addEventListener('input', (e) => {
    if (selectedItem) {
        const val = parseInt(e.target.value) || 1;
        if (selectedItem.type === 'highlight') {
            currentAyahData.ayah_highlights[selectedItem.index].sura = val;
        } else {
            currentAyahData.ayah_markers[selectedItem.index].sura = val;
        }
        renderBoxes();
        openRightPanel();
    }
});
document.getElementById('meta-ayah').addEventListener('input', (e) => {
    if (selectedItem) {
        const val = parseInt(e.target.value) || 1;
        if (selectedItem.type === 'highlight') {
            currentAyahData.ayah_highlights[selectedItem.index].ayah = val;
        } else {
            currentAyahData.ayah_markers[selectedItem.index].ayah = val;
        }
        renderBoxes();
        openRightPanel();
    }
});
document.getElementById('meta-line').addEventListener('input', (e) => {
    if (selectedItem) {
        const val = parseInt(e.target.value) || 1;
        if (selectedItem.type === 'highlight') {
            currentAyahData.ayah_highlights[selectedItem.index].line = val;
        } else {
            const m = currentAyahData.ayah_markers[selectedItem.index];
            const oldLine = m.line;
            const oldCenterX = m.center_x;
            m.line = val;
            if (oldLine !== m.line) {
                syncMarkerLineChange(m, oldLine, oldCenterX);
            }
            if (typeof syncHighlightWithMarker === 'function') {
                syncHighlightWithMarker(m, { allowCreateNext: shouldCreateNextHighlightOnMarkerMove() });
            }
            document.getElementById('mk-line').value = m.line;
        }
        renderBoxes();
        openRightPanel();
    }
});

document.getElementById('hl-left').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'highlight') {
        currentAyahData.ayah_highlights[selectedItem.index].left = clampUnitValue(parseNumericInputValue(e.target.value));
        renderBoxes();
        openRightPanel();
    }
});
document.getElementById('hl-right').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'highlight') {
        currentAyahData.ayah_highlights[selectedItem.index].right = clampUnitValue(parseNumericInputValue(e.target.value));
        renderBoxes();
        openRightPanel();
    }
});

// Highlight Line Layout Tweaks
document.getElementById('hl-line-top').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'highlight') {
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        const band = currentLayoutData.lineBands.find(b => b.line === h.line);
        if (band) {
            band.top = parseInt(e.target.value) || 0;
            renderBoxes();
            openRightPanel();
        }
    }
});
document.getElementById('hl-line-bottom').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'highlight') {
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        const band = currentLayoutData.lineBands.find(b => b.line === h.line);
        if (band) {
            band.bottom = parseInt(e.target.value) || 0;
            renderBoxes();
            openRightPanel();
        }
    }
});

// Trigger save on layout blur/change
document.getElementById('hl-line-top').addEventListener('change', autoSaveLayoutData);
document.getElementById('hl-line-bottom').addEventListener('change', autoSaveLayoutData);

document.getElementById('mk-cx').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedItem.index];
        m.center_x = clampUnitValue(parseNumericInputValue(e.target.value));
        if (typeof syncHighlightWithMarker === 'function') {
            syncHighlightWithMarker(m, { allowCreateNext: shouldCreateNextHighlightOnMarkerMove() });
        }
        renderBoxes();
        openRightPanel();
    }
});
document.getElementById('mk-cy').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'marker') {
        currentAyahData.ayah_markers[selectedItem.index].center_y = clampUnitValue(parseNumericInputValue(e.target.value));
        renderBoxes();
        openRightPanel();
    }
});

document.getElementById('mk-line').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedItem.index];
        const oldLine = m.line;
        const oldCenterX = m.center_x;
        const maxLine = currentLayoutData && currentLayoutData.lineBands
            ? currentLayoutData.lineBands.length
            : 1;
        m.line = Math.min(maxLine, Math.max(1, parseInt(e.target.value) || 1));
        e.target.value = m.line;
        if (oldLine !== m.line) {
            syncMarkerLineChange(m, oldLine, oldCenterX);
        }
        if (typeof syncHighlightWithMarker === 'function') {
            syncHighlightWithMarker(m, { allowCreateNext: shouldCreateNextHighlightOnMarkerMove() });
        }
        document.getElementById('meta-line').textContent = m.line;
        renderBoxes();
        openRightPanel();
    }
});

function attachInputHistory(ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('focus', () => beginHistoryTransaction(`edit ${id}`));
        el.addEventListener('blur', endHistoryTransaction);
        el.addEventListener('change', endHistoryTransaction);
    });
}

attachInputHistory([
    'hl-left',
    'hl-right',
    'hl-line-top',
    'hl-line-bottom',
    'mk-cx',
    'mk-cy',
    'mk-line',
    'meta-sura',
    'meta-ayah',
    'meta-line',
    'global-y-offset',
    'global-scale',
    'global-height',
    'global-pad-left',
    'global-pad-right',
    'global-first-line-pad',
    'global-last-line-pad'
]);

function getMarkerImageY(marker) {
    if (!currentLayoutData || !currentLayoutData.lineBands) return 0;
    const band = currentLayoutData.lineBands.find(b => b.line === marker.line);
    if (!band) return 0;
    const centerY = marker.center_y || 0.5;
    return band.top + (centerY * (band.bottom - band.top));
}

function setMarkerPositionFromImageY(marker, imageY) {
    const band = findLineBandForImageY(imageY);
    if (!band) return;

    marker.line = band.line;
    const height = Math.max(1, band.bottom - band.top);
    marker.center_y = Math.min(0.98, Math.max(0.02, (imageY - band.top) / height));
}

function findLineBandForImageY(imageY) {
    if (!currentLayoutData || !currentLayoutData.lineBands || currentLayoutData.lineBands.length === 0) return null;

    const containing = currentLayoutData.lineBands.find(b => imageY >= b.top && imageY <= b.bottom);
    if (containing) return containing;

    return currentLayoutData.lineBands
        .slice()
        .sort((a, b) => {
            const distanceA = Math.min(Math.abs(imageY - a.top), Math.abs(imageY - a.bottom));
            const distanceB = Math.min(Math.abs(imageY - b.top), Math.abs(imageY - b.bottom));
            return distanceA - distanceB;
        })[0];
}

function shouldCreateNextHighlightOnMarkerMove() {
    const checkbox = document.getElementById('sync-create-next-highlight');
    return Boolean(checkbox && checkbox.checked);
}

function shouldRenumberFollowingHighlights() {
    const checkbox = document.getElementById('renumber-following-highlights');
    return Boolean(checkbox && checkbox.checked);
}

function shouldSnapHighlightEdges() {
    const checkbox = document.getElementById('snap-highlight-edges');
    return Boolean(checkbox && checkbox.checked);
}

function collectHorizontalSnapTargets(highlight, highlightIndex) {
    const targets = [0, DEFAULT_LEFT_MARGIN, DEFAULT_RIGHT_MARGIN, 1];
    if (!currentAyahData || !highlight) return targets;

    if (Array.isArray(currentAyahData.ayah_markers)) {
        currentAyahData.ayah_markers
            .filter(m => m.line === highlight.line)
            .forEach(m => targets.push(clampUnitValue(parseNumericInputValue(m.center_x))));
    }

    if (Array.isArray(currentAyahData.ayah_highlights)) {
        currentAyahData.ayah_highlights.forEach((h, index) => {
            if (index === highlightIndex || h.line !== highlight.line) return;
            targets.push(clampUnitValue(parseNumericInputValue(h.left)));
            targets.push(clampUnitValue(parseNumericInputValue(h.right)));
        });
    }

    return [...new Set(targets.map(t => Number(t.toFixed(6))))];
}

function snapUnitValue(value, targets, threshold = HORIZONTAL_SNAP_THRESHOLD) {
    let bestValue = value;
    let bestDistance = threshold;
    targets.forEach(target => {
        const distance = Math.abs(value - target);
        if (distance <= bestDistance) {
            bestDistance = distance;
            bestValue = target;
        }
    });
    return bestValue;
}

function applyHighlightMagneticSnap(highlight, highlightIndex, mode) {
    if (!shouldSnapHighlightEdges() || !highlight) return;

    const targets = collectHorizontalSnapTargets(highlight, highlightIndex);
    if (mode === 'resize-left') {
        highlight.left = snapUnitValue(highlight.left, targets);
    } else if (mode === 'resize-right') {
        highlight.right = snapUnitValue(highlight.right, targets);
    } else if (mode === 'move') {
        const snappedLeft = snapUnitValue(highlight.left, targets);
        const leftDelta = snappedLeft - highlight.left;
        const snappedRight = snapUnitValue(highlight.right, targets);
        const rightDelta = snappedRight - highlight.right;

        if (Math.abs(leftDelta) > 0 && Math.abs(leftDelta) <= Math.abs(rightDelta || Infinity)) {
            highlight.left += leftDelta;
            highlight.right += leftDelta;
        } else if (Math.abs(rightDelta) > 0) {
            highlight.left += rightDelta;
            highlight.right += rightDelta;
        }
    }
}

function compareHighlightsReadingOrder(a, b) {
    if (a.line !== b.line) return a.line - b.line;
    const rightA = Math.max(a.left, a.right);
    const rightB = Math.max(b.left, b.right);
    if (Math.abs(rightA - rightB) > 0.000001) return rightB - rightA;
    return Math.min(a.left, a.right) - Math.min(b.left, b.right);
}

function renumberHighlightsFromIndex(startIndex, delta, sura) {
    if (!currentAyahData || !Array.isArray(currentAyahData.ayah_highlights)) return;
    for (let index = startIndex; index < currentAyahData.ayah_highlights.length; index++) {
        const h = currentAyahData.ayah_highlights[index];
        if (h.sura !== sura) continue;
        const nextAyah = h.ayah + delta;
        if (nextAyah < 1) continue;
        h.ayah = nextAyah;
        if (h.source !== 'manual_marker_sync' && !String(h.source || '').includes('renumbered')) {
            h.source = `${h.source || 'manual'}_renumbered`;
        }
    }
}

// Sync Highlight With Marker
function syncHighlightWithMarker(m, options = {}) {
    const syncCheckbox = document.getElementById('sync-marker-highlight');
    const syncNextCheckbox = document.getElementById('sync-next-ayah-highlight');
    const allowCreateNext = options.allowCreateNext === true;
    const shouldSyncNext = Boolean(syncNextCheckbox && syncNextCheckbox.checked) || allowCreateNext;
    
    // The text is RTL. The end of the ayah text is on the left side (h.left).
    // 1. Sync the left boundary of the current ayah highlight on the same line
    if (syncCheckbox && syncCheckbox.checked) {
        const currentHighlight = currentAyahData.ayah_highlights.find(h => 
            h.sura === m.sura && h.ayah === m.ayah && h.line === m.line
        ) || createCurrentHighlightOnLine(m);
        if (currentHighlight) {
            currentHighlight.left = clampHighlightBoundary(m.center_x, currentHighlight.right, 'left');
        }
    }

    // 2. Sync the boundary of the next ayah highlight on the same line.
    // In RTL page coordinates, the next ayah segment that starts after the
    // marker is visually to the marker's left, so the boundary touching the
    // marker is that segment's right edge.
    if (shouldSyncNext) {
        const nextHighlight = findNextHighlightOnLine(m) || (allowCreateNext ? createNextHighlightOnLine(m) : null);
        if (nextHighlight) {
            nextHighlight.right = clampHighlightBoundary(m.center_x, nextHighlight.left, 'right');
        }
    }
}

function syncMarkerLineChange(marker, oldLine, oldCenterX) {
    if (!currentAyahData || !currentAyahData.ayah_highlights || oldLine === marker.line) return;

    const syncCheckbox = document.getElementById('sync-marker-highlight');
    const syncNextCheckbox = document.getElementById('sync-next-ayah-highlight');

    if (syncCheckbox && syncCheckbox.checked) {
        removeMarkerBoundHighlight({
            sura: marker.sura,
            ayah: marker.ayah,
            line: oldLine,
            boundary: 'left',
            centerX: oldCenterX,
        });
        createCurrentHighlightOnLine(marker);
    }

    if (syncNextCheckbox && syncNextCheckbox.checked) {
        const oldNext = inferNextAyahIdentity(marker);
        removeMarkerBoundHighlight({
            sura: oldNext.sura,
            ayah: oldNext.ayah,
            line: oldLine,
            boundary: 'right',
            centerX: oldCenterX,
        });
        createNextHighlightOnLine(marker);
    }
}

function removeMarkerBoundHighlight({ sura, ayah, line, boundary, centerX }) {
    const highlights = currentAyahData.ayah_highlights;
    for (let index = highlights.length - 1; index >= 0; index--) {
        const h = highlights[index];
        const isMatch =
            h.sura === sura &&
            h.ayah === ayah &&
            h.line === line &&
            (
                h.source === 'manual_marker_sync' ||
                Math.abs((boundary === 'left' ? h.left : h.right) - centerX) <= 0.05
            );
        if (isMatch) {
            highlights.splice(index, 1);
        }
    }
}

function inferNextAyahIdentity(marker) {
    const nextMarker = currentAyahData.ayah_markers
        ? currentAyahData.ayah_markers
            .filter(m =>
                (m.sura === marker.sura && m.ayah === marker.ayah + 1) ||
                (m.sura === marker.sura + 1 && m.ayah === 1)
            )
            .sort((a, b) => a.line - b.line || b.center_x - a.center_x)[0]
        : null;

    return {
        sura: nextMarker ? nextMarker.sura : marker.sura,
        ayah: nextMarker ? nextMarker.ayah : marker.ayah + 1
    };
}

function clampHighlightBoundary(value, oppositeBoundary, side) {
    const safeValue = Math.min(0.99, Math.max(0.01, value));
    const safeOpposite = Number.isFinite(oppositeBoundary) ? oppositeBoundary : safeValue;
    const minWidth = 0.006;

    if (side === 'left') {
        return Math.max(0.01, Math.min(safeValue, safeOpposite - minWidth));
    }
    return Math.min(0.99, Math.max(safeValue, safeOpposite + minWidth));
}

function createCurrentHighlightOnLine(marker) {
    if (!currentAyahData || !currentAyahData.ayah_highlights) return null;

    const existing = currentAyahData.ayah_highlights.find(h =>
        h.sura === marker.sura && h.ayah === marker.ayah && h.line === marker.line
    );
    if (existing) return existing;

    const highlight = {
        page: currentPage,
        line: marker.line,
        sura: marker.sura,
        ayah: marker.ayah,
        left: marker.center_x,
        right: 0.97,
        confidence: 0.5,
        source: 'manual_marker_sync'
    };

    currentAyahData.ayah_highlights.push(highlight);
    return highlight;
}

function findNextHighlightOnLine(marker) {
    if (!currentAyahData || !currentAyahData.ayah_highlights) return null;

    const sameLine = currentAyahData.ayah_highlights.filter(h => h.line === marker.line);
    if (sameLine.length === 0) return null;
    const nextIdentity = inferNextAyahIdentity(marker);

    const logicalNext = sameLine.find(h =>
        h.sura === nextIdentity.sura && h.ayah === nextIdentity.ayah
    );
    if (logicalNext) return logicalNext;

    const markerX = marker.center_x;
    const leftSideCandidates = sameLine
        .filter(h => h.sura !== marker.sura || h.ayah !== marker.ayah)
        .filter(h => Math.max(h.left, h.right) <= markerX + 0.04)
        .sort((a, b) => Math.abs(Math.max(a.left, a.right) - markerX) - Math.abs(Math.max(b.left, b.right) - markerX));

    return leftSideCandidates[0] || null;
}

function createNextHighlightOnLine(marker) {
    if (!currentAyahData || !currentAyahData.ayah_highlights) return null;
    const nextIdentity = inferNextAyahIdentity(marker);

    const nextMarker = currentAyahData.ayah_markers
        ? currentAyahData.ayah_markers
            .filter(m => m.line === marker.line)
            .filter(m => m.center_x < marker.center_x)
            .filter(m => m.sura === nextIdentity.sura && m.ayah === nextIdentity.ayah)
            .sort((a, b) => Math.abs(a.center_x - marker.center_x) - Math.abs(b.center_x - marker.center_x))[0]
        : null;

    const hasVisibleSpaceForNextAyah = marker.center_x > 0.12;
    if (!nextMarker && !hasVisibleSpaceForNextAyah) {
        return null;
    }
    const conservativeLeft = Math.max(0.03, marker.center_x - 0.12);

    const nextHighlight = {
        page: currentPage,
        line: marker.line,
        sura: nextIdentity.sura,
        ayah: nextIdentity.ayah,
        left: nextMarker ? nextMarker.center_x : conservativeLeft,
        right: marker.center_x,
        confidence: 0.5,
        source: 'manual_marker_sync'
    };

    currentAyahData.ayah_highlights.push(nextHighlight);
    currentAyahData.ayah_highlights.sort(compareHighlightsReadingOrder);
    const insertedIndex = currentAyahData.ayah_highlights.indexOf(nextHighlight);
    if (shouldRenumberFollowingHighlights()) {
        renumberHighlightsFromIndex(insertedIndex + 1, 1, nextHighlight.sura);
    }
    return nextHighlight;
}

function deleteSelectedHighlight() {
    if (!currentAyahData || !Array.isArray(currentAyahData.ayah_highlights)) return;
    if (!selectedItem || selectedItem.type !== 'highlight') return;

    const index = selectedItem.index;
    const deleted = currentAyahData.ayah_highlights[index];
    if (!deleted) return;

    const shouldRenumber = shouldRenumberFollowingHighlights();
    const confirmed = confirm(
        shouldRenumber
            ? 'سيتم حذف مربع التحديد وتخفيض أرقام مربعات نفس السورة التي بعده بواحد. هل تتابع؟'
            : 'سيتم حذف مربع التحديد المحدد فقط. هل تتابع؟'
    );
    if (!confirmed) return;

    pushUndoSnapshot('delete highlight');
    currentAyahData.ayah_highlights.splice(index, 1);
    if (shouldRenumber) {
        renumberHighlightsFromIndex(index, -1, deleted.sura);
    }

    if (currentAyahData.ayah_highlights.length > 0) {
        const nextIndex = Math.min(index, currentAyahData.ayah_highlights.length - 1);
        selectedItem = { type: 'highlight', index: nextIndex };
        const h = currentAyahData.ayah_highlights[nextIndex];
        selectedItemOriginals = { left: h.left, right: h.right };
    } else {
        selectedItem = null;
        selectedItemOriginals = null;
    }

    renderBoxes();
    if (selectedItem) openRightPanel();
    else clearRightPanel();
    autoSaveAyahData();
}

// Reset Button Listeners
document.getElementById('reset-hl-left').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'highlight' && selectedItemOriginals) {
        pushUndoSnapshot('reset highlight left');
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        h.left = selectedItemOriginals.left;
        document.getElementById('hl-left').value = h.left;
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});
document.getElementById('reset-hl-right').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'highlight' && selectedItemOriginals) {
        pushUndoSnapshot('reset highlight right');
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        h.right = selectedItemOriginals.right;
        document.getElementById('hl-right').value = h.right;
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});
document.getElementById('reset-mk-cx').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'marker' && selectedItemOriginals) {
        pushUndoSnapshot('reset marker x');
        const m = currentAyahData.ayah_markers[selectedItem.index];
        m.center_x = selectedItemOriginals.center_x;
        document.getElementById('mk-cx').value = m.center_x;
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});
document.getElementById('reset-mk-cy').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'marker' && selectedItemOriginals) {
        pushUndoSnapshot('reset marker y');
        const m = currentAyahData.ayah_markers[selectedItem.index];
        m.center_y = selectedItemOriginals.center_y;
        document.getElementById('mk-cy').value = m.center_y;
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});

document.getElementById('reset-mk-line').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'marker' && selectedItemOriginals) {
        pushUndoSnapshot('reset marker line');
        const m = currentAyahData.ayah_markers[selectedItem.index];
        m.line = selectedItemOriginals.line;
        document.getElementById('mk-line').value = m.line;
        document.getElementById('meta-line').textContent = m.line;
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});

document.getElementById('reset-meta-sura').addEventListener('click', () => {
    if (selectedItem && selectedItemOriginals) {
        pushUndoSnapshot('reset meta sura');
        if (selectedItem.type === 'highlight') {
            currentAyahData.ayah_highlights[selectedItem.index].sura = selectedItemOriginals.sura;
        } else {
            currentAyahData.ayah_markers[selectedItem.index].sura = selectedItemOriginals.sura;
        }
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});
document.getElementById('reset-meta-ayah').addEventListener('click', () => {
    if (selectedItem && selectedItemOriginals) {
        pushUndoSnapshot('reset meta ayah');
        if (selectedItem.type === 'highlight') {
            currentAyahData.ayah_highlights[selectedItem.index].ayah = selectedItemOriginals.ayah;
        } else {
            currentAyahData.ayah_markers[selectedItem.index].ayah = selectedItemOriginals.ayah;
        }
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});
document.getElementById('reset-meta-line').addEventListener('click', () => {
    if (selectedItem && selectedItemOriginals) {
        pushUndoSnapshot('reset meta line');
        if (selectedItem.type === 'highlight') {
            currentAyahData.ayah_highlights[selectedItem.index].line = selectedItemOriginals.line;
        } else {
            const m = currentAyahData.ayah_markers[selectedItem.index];
            const oldLine = m.line;
            const oldCenterX = m.center_x;
            m.line = selectedItemOriginals.line;
            if (oldLine !== m.line) {
                syncMarkerLineChange(m, oldLine, oldCenterX);
            }
            if (typeof syncHighlightWithMarker === 'function') {
                syncHighlightWithMarker(m, { allowCreateNext: shouldCreateNextHighlightOnMarkerMove() });
            }
            document.getElementById('mk-line').value = m.line;
        }
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});

document.getElementById('reset-hl-line-top').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'highlight' && originalLineBands) {
        pushUndoSnapshot('reset line top');
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        const band = currentLayoutData.lineBands.find(b => b.line === h.line);
        const origBand = originalLineBands.find(b => b.line === h.line);
        if (band && origBand) {
            band.top = origBand.top;
            document.getElementById('hl-line-top').value = band.top;
            renderBoxes();
            openRightPanel();
            autoSaveLayoutData();
        }
    }
});
document.getElementById('reset-hl-line-bottom').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'highlight' && originalLineBands) {
        pushUndoSnapshot('reset line bottom');
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        const band = currentLayoutData.lineBands.find(b => b.line === h.line);
        const origBand = originalLineBands.find(b => b.line === h.line);
        if (band && origBand) {
            band.bottom = origBand.bottom;
            document.getElementById('hl-line-bottom').value = band.bottom;
            renderBoxes();
            openRightPanel();
            autoSaveLayoutData();
        }
    }
});

document.getElementById('reset-global-y-offset').addEventListener('click', () => {
    pushUndoSnapshot('reset global y');
    document.getElementById('global-y-offset').value = 0;
    applyGlobalLayoutTweaks();
    autoSaveLayoutData();
});
document.getElementById('reset-global-scale').addEventListener('click', () => {
    pushUndoSnapshot('reset global scale');
    document.getElementById('global-scale').value = 1.0;
    applyGlobalLayoutTweaks();
    autoSaveLayoutData();
});
document.getElementById('reset-global-height').addEventListener('click', () => {
    pushUndoSnapshot('reset global height');
    document.getElementById('global-height').value = "";
    applyGlobalLayoutTweaks();
    updateLeftPanelSaveButtons();
});

// Inline Save Button Listeners
document.getElementById('save-hl-left').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-hl-right').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-hl-line-top').addEventListener('click', () => {
    document.getElementById('save-layout-btn').click();
});
document.getElementById('save-hl-line-bottom').addEventListener('click', () => {
    document.getElementById('save-layout-btn').click();
});
document.getElementById('save-mk-cx').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-mk-cy').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-mk-line').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-meta-sura').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-meta-ayah').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-meta-line').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});

document.getElementById('save-global-y-offset').addEventListener('click', () => {
    document.getElementById('save-layout-btn').click();
});
document.getElementById('save-global-scale').addEventListener('click', () => {
    document.getElementById('save-layout-btn').click();
});
document.getElementById('save-global-height').addEventListener('click', () => {
    document.getElementById('save-layout-btn').click();
});

if (DOM.saveAllBtn) DOM.saveAllBtn.addEventListener('click', saveCurrentPageAll);
if (DOM.undoBtn) DOM.undoBtn.addEventListener('click', undoLastChange);
if (DOM.redoBtn) DOM.redoBtn.addEventListener('click', redoLastChange);
const deleteHighlightBtn = document.getElementById('delete-highlight-btn');
if (deleteHighlightBtn) deleteHighlightBtn.addEventListener('click', deleteSelectedHighlight);

// Save Actions
document.getElementById('save-ayah-btn').addEventListener('click', () => {
    if (currentAyahData) {
        normalizeAyahGeometry(currentAyahData);
        const pageStr = String(currentPage).padStart(3, '0');
        const path = `databases/ayahinfo/warsh_muthamma/pages_json/page_${pageStr}.json`;
        saveToServer(path, currentAyahData, () => {
            if (selectedItem) {
                if (selectedItem.type === 'highlight') {
                    const h = currentAyahData.ayah_highlights[selectedItem.index];
                    selectedItemOriginals = { left: h.left, right: h.right, sura: h.sura, ayah: h.ayah, line: h.line };
                } else if (selectedItem.type === 'marker') {
                    const m = currentAyahData.ayah_markers[selectedItem.index];
                    selectedItemOriginals = { center_x: m.center_x, center_y: m.center_y || 0.5, line: m.line, sura: m.sura, ayah: m.ayah };
                }
                openRightPanel();
                flashSavedFeedback();
            }
        });
    }
});

function flashSavedFeedback() {
    const badge = document.getElementById('save-status-badge');
    const cards = document.querySelectorAll('.val-compare-card');
    
    badge.style.background = 'rgba(76, 175, 80, 0.4)';
    badge.style.color = '#fff';
    
    cards.forEach(card => {
        card.classList.add('success-glow');
    });
    
    setTimeout(() => {
        badge.style.background = '';
        badge.style.color = '';
        cards.forEach(card => {
            card.classList.remove('success-glow');
        });
    }, 1000);
}

function syncSelectionOriginalsFromCurrent() {
    if (!selectedItem || !currentAyahData) return;
    if (selectedItem.type === 'highlight') {
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        if (h) selectedItemOriginals = { left: h.left, right: h.right, sura: h.sura, ayah: h.ayah, line: h.line };
    } else if (selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedItem.index];
        if (m) selectedItemOriginals = { center_x: m.center_x, center_y: m.center_y || 0.5, line: m.line, sura: m.sura, ayah: m.ayah };
    }
}

function syncLayoutOriginalsFromCurrent(resetInputs = false) {
    if (!currentLayoutData || !currentLayoutData.lineBands) return;
    originalLineBands = JSON.parse(JSON.stringify(currentLayoutData.lineBands));
    if (originalLineBands.length > 0) {
        const avgHeight = Math.round(originalLineBands.reduce((sum, b) => sum + (b.bottom - b.top), 0) / originalLineBands.length);
        document.getElementById('global-height-orig').textContent = `Ø§Ù„Ø£ØµÙ„ÙŠØ©: ~${avgHeight}`;
    } else {
        document.getElementById('global-height-orig').textContent = `Ø§Ù„Ø£ØµÙ„ÙŠØ©: -`;
    }

    if (resetInputs) {
        document.getElementById('global-y-offset').value = 0;
        document.getElementById('global-scale').value = 1.0;
        document.getElementById('global-height').value = "";
        updateLeftPanelSaveButtons();
    }
}

async function saveCurrentPageAll() {
    if (!currentAyahData && !currentLayoutData) return;

    const pageStr = String(currentPage).padStart(3, '0');
    const oldDisabled = DOM.saveAllBtn ? DOM.saveAllBtn.disabled : false;
    if (DOM.saveAllBtn) DOM.saveAllBtn.disabled = true;

    let ok = true;
    if (currentAyahData) {
        normalizeAyahGeometry(currentAyahData);
        const ayahPath = `databases/ayahinfo/warsh_muthamma/pages_json/page_${pageStr}.json`;
        ok = await saveToServer(ayahPath, currentAyahData, syncSelectionOriginalsFromCurrent) && ok;
    }
    if (currentLayoutData) {
        const layoutPath = `databases/ayahinfo/warsh_muthamma/page_layout_json/page_${pageStr}.json`;
        ok = await saveToServer(layoutPath, currentLayoutData, () => syncLayoutOriginalsFromCurrent(true)) && ok;
    }

    if (selectedItem) openRightPanel();
    if (ok) {
        flashSavedFeedback();
        showToast('تم حفظ الصفحة كاملة');
    }

    if (DOM.saveAllBtn) DOM.saveAllBtn.disabled = oldDisabled;
    updateUndoRedoButtons();
}

document.getElementById('save-layout-btn').addEventListener('click', () => {
    if (currentLayoutData) {
        const pageStr = String(currentPage).padStart(3, '0');
        const path = `databases/ayahinfo/warsh_muthamma/page_layout_json/page_${pageStr}.json`;
        saveToServer(path, currentLayoutData, () => {
            // Sync originalLineBands to current layout and reset inputs to baseline
            if (currentLayoutData.lineBands) {
                originalLineBands = JSON.parse(JSON.stringify(currentLayoutData.lineBands));
                if (originalLineBands.length > 0) {
                    const avgHeight = Math.round(originalLineBands.reduce((sum, b) => sum + (b.bottom - b.top), 0) / originalLineBands.length);
                    document.getElementById('global-height-orig').textContent = `الأصلية: ~${avgHeight}`;
                } else {
                    document.getElementById('global-height-orig').textContent = `الأصلية: -`;
                }
            }
            document.getElementById('global-y-offset').value = 0;
            document.getElementById('global-scale').value = 1.0;
            document.getElementById('global-height').value = "";
            updateLeftPanelSaveButtons();
        });
    }
});

// Left Panel (Global Layout Tweaks)
function applyGlobalLayoutTweaks() {
    if (!originalLineBands || !currentLayoutData) return;
    const yOffset = parseInt(document.getElementById('global-y-offset').value) || 0;
    const scale = parseNumericInputValue(document.getElementById('global-scale').value, 1.0);
    const fixedHeight = parseInt(document.getElementById('global-height').value) || 0;

    currentLayoutData.lineBands = originalLineBands.map(orig => {
        const center = orig.center + yOffset;
        const baseHeight = fixedHeight > 0 ? fixedHeight : (orig.bottom - orig.top);
        const halfHeight = (baseHeight / 2) * scale;
        return {
            line: orig.line,
            top: Math.round(center - halfHeight),
            bottom: Math.round(center + halfHeight),
            center: center
        };
    });
    renderBoxes();
}

// Left Panel Save Buttons State Update
function updateLeftPanelSaveButtons() {
    const yOffset = parseInt(document.getElementById('global-y-offset').value) || 0;
    const scale = parseNumericInputValue(document.getElementById('global-scale').value, 1.0);
    const height = document.getElementById('global-height').value;

    const btnY = document.getElementById('save-global-y-offset');
    const btnS = document.getElementById('save-global-scale');
    const btnH = document.getElementById('save-global-height');

    if (yOffset !== 0) {
        btnY.className = "save-inline-btn unsaved";
        btnY.title = "تغيير غير محفوظ - انقر للحفظ";
    } else {
        btnY.className = "save-inline-btn saved";
        btnY.title = "تم الحفظ";
    }

    if (Math.abs(scale - 1.0) > 0.001) {
        btnS.className = "save-inline-btn unsaved";
        btnS.title = "تغيير غير محفوظ - انقر للحفظ";
    } else {
        btnS.className = "save-inline-btn saved";
        btnS.title = "تم الحفظ";
    }

    if (height !== "" && height !== "0") {
        btnH.className = "save-inline-btn unsaved";
        btnH.title = "تغيير غير محفوظ - انقر للحفظ";
    } else {
        btnH.className = "save-inline-btn saved";
        btnH.title = "تم الحفظ";
    }
}

document.getElementById('global-y-offset').addEventListener('input', () => {
    applyGlobalLayoutTweaks();
    updateLeftPanelSaveButtons();
});
document.getElementById('global-scale').addEventListener('input', () => {
    applyGlobalLayoutTweaks();
    updateLeftPanelSaveButtons();
});
document.getElementById('global-height').addEventListener('input', () => {
    applyGlobalLayoutTweaks();
    updateLeftPanelSaveButtons();
});

// Keyboard Navigation and Shortcuts
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const cmd = e.ctrlKey || e.metaKey;
    if (cmd && !e.altKey && key === 's') {
        e.preventDefault();
        saveCurrentPageAll();
        return;
    }
    if (cmd && !e.altKey && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoLastChange();
        return;
    }
    if (cmd && !e.altKey && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoLastChange();
        return;
    }

    const activeTag = document.activeElement.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') {
        if (e.key === 'Enter' && document.activeElement === DOM.jumpInput) {
            const val = parseInt(DOM.jumpInput.value);
            if (!isNaN(val) && val >= 1 && val <= TOTAL_PAGES) {
                updatePage(val);
                DOM.jumpInput.blur();
            }
        }
        return; // ignore arrow keys when typing
    }

    // Box shortcuts
    if (selectedItem) {
        
        if (e.key.startsWith('Arrow')) {
            if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                const arr = selectedItem.type === 'highlight' ? currentAyahData.ayah_highlights : currentAyahData.ayah_markers;
                let newIndex = selectedItem.index - 1;
                if (newIndex < 0) newIndex = arr.length - 1;
                selectItem(selectedItem.type, newIndex);
                e.preventDefault();
                return;
            }
            if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                const arr = selectedItem.type === 'highlight' ? currentAyahData.ayah_highlights : currentAyahData.ayah_markers;
                let newIndex = selectedItem.index + 1;
                if (newIndex >= arr.length) newIndex = 0;
                selectItem(selectedItem.type, newIndex);
                e.preventDefault();
                return;
            }
        }

        let updatedAyah = false;
        let updatedLayout = false;
        const isEditingKey = e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'd' || e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_' || e.key === ' ';
        const shouldCaptureHistory = e.shiftKey || e.ctrlKey || e.altKey || isEditingKey;
        
        if (shouldCaptureHistory) pushUndoSnapshot('keyboard edit');

        if (selectedItem.type === 'highlight') {
            const h = currentAyahData.ayah_highlights[selectedItem.index];
            const lineBand = currentLayoutData.lineBands.find(b => b.line === h.line);
            
            if (e.key === 'Delete' || e.key === 'Backspace') {
                currentAyahData.ayah_highlights.splice(selectedItem.index, 1);
                selectedItem = null;
                updatedAyah = true;
                e.preventDefault();
            } else if ((e.key.toLowerCase() === 'd') && (e.ctrlKey || e.metaKey)) {
                const newH = JSON.parse(JSON.stringify(h));
                currentAyahData.ayah_highlights.splice(selectedItem.index + 1, 0, newH);
                selectItem('highlight', selectedItem.index + 1);
                updatedAyah = true;
                e.preventDefault();
            } else if (e.key === '+' || e.key === '=') {
                h.ayah++;
                updatedAyah = true;
                e.preventDefault();
            } else if (e.key === '-' || e.key === '_') {
                h.ayah = Math.max(1, h.ayah - 1);
                updatedAyah = true;
                e.preventDefault();
            } else if (e.ctrlKey && !e.shiftKey && !e.altKey) {
                if (e.key === 'ArrowRight') { h.right = DEFAULT_RIGHT_MARGIN; updatedAyah = true; e.preventDefault(); }
                else if (e.key === 'ArrowLeft') { h.left = DEFAULT_LEFT_MARGIN; updatedAyah = true; e.preventDefault(); }
                else if (e.key === ' ') { h.left = DEFAULT_LEFT_MARGIN; h.right = DEFAULT_RIGHT_MARGIN; updatedAyah = true; e.preventDefault(); }
            }
            
            if (e.shiftKey && !e.ctrlKey && !e.altKey) {
                // Horizontal Move
                const step = 0.001;
                if (e.key === 'ArrowLeft') { h.left -= step; h.right -= step; updatedAyah = true; }
                else if (e.key === 'ArrowRight') { h.left += step; h.right += step; updatedAyah = true; }
            } else if (e.ctrlKey && e.shiftKey) {
                // Vertical Resizing of LineBand
                const step = 1;
                if (!e.altKey) {
                    // Expand
                    if (e.key === 'ArrowUp') { lineBand.top -= step; updatedLayout = true; }
                    else if (e.key === 'ArrowDown') { lineBand.bottom += step; updatedLayout = true; }
                } else {
                    // Shrink
                    if (e.key === 'ArrowUp') { lineBand.bottom -= step; updatedLayout = true; }
                    else if (e.key === 'ArrowDown') { lineBand.top += step; updatedLayout = true; }
                }
            }
        } else if (selectedItem.type === 'marker') {
            const m = currentAyahData.ayah_markers[selectedItem.index];
            const oldLine = m.line;
            const oldCenterX = m.center_x;
            if (e.shiftKey && !e.ctrlKey && !e.altKey) {
                const step = 0.001;
                if (e.key === 'ArrowLeft') { m.center_x -= step; updatedAyah = true; }
                else if (e.key === 'ArrowRight') { m.center_x += step; updatedAyah = true; }
                else if (e.key === 'ArrowUp') { m.center_y -= step; updatedAyah = true; }
                else if (e.key === 'ArrowDown') { m.center_y += step; updatedAyah = true; }
                normalizeMarkerLineAfterKeyboardMove(m, oldLine, oldCenterX);
                if (updatedAyah && typeof syncHighlightWithMarker === 'function') {
                    syncHighlightWithMarker(m, { allowCreateNext: shouldCreateNextHighlightOnMarkerMove() });
                }
            }
        }

        if (updatedAyah || updatedLayout) {
            e.preventDefault(); // Prevent page scroll
            renderBoxes();
            openRightPanel();
            if (updatedAyah) autoSaveAyahData();
            if (updatedLayout) {
                originalLineBands = JSON.parse(JSON.stringify(currentLayoutData.lineBands)); // Sync original
                autoSaveLayoutData();
            }
            return;
        }
    } else if (!selectedItem && e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        // If nothing selected, select first highlight
        if (currentAyahData && currentAyahData.ayah_highlights && currentAyahData.ayah_highlights.length > 0) {
            selectItem('highlight', 0);
            e.preventDefault();
            return;
        }
    }

    // Normal navigation
    if (e.key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey) updatePage(currentPage + 1);
    else if (e.key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey) updatePage(currentPage - 1);
});

function normalizeMarkerLineAfterKeyboardMove(marker, oldLine, oldCenterX) {
    if (!currentLayoutData || !currentLayoutData.lineBands) return;

    while (marker.center_y < 0 && marker.line > 1) {
        marker.line -= 1;
        marker.center_y += 1;
    }
    while (marker.center_y > 1 && marker.line < currentLayoutData.lineBands.length) {
        marker.line += 1;
        marker.center_y -= 1;
    }
    marker.center_y = Math.min(0.98, Math.max(0.02, marker.center_y));

    if (oldLine !== marker.line) {
        syncMarkerLineChange(marker, oldLine, oldCenterX);
    }
}

document.getElementById('prev-page-btn').addEventListener('click', () => {
    updatePage(currentPage - 1);
});

document.getElementById('next-page-btn').addEventListener('click', () => {
    updatePage(currentPage + 1);
});

DOM.jumpInput.addEventListener('change', () => {
    const val = parseInt(DOM.jumpInput.value);
    if (!isNaN(val) && val >= 1 && val <= TOTAL_PAGES) updatePage(val);
});

document.getElementById('refresh-btn').addEventListener('click', () => {
    const pageStr = String(currentPage).padStart(3, '0');
    DOM.img.src = `${IMAGE_BASE_PATH}${pageStr}.png?t=${new Date().getTime()}`;
});

// Batch Pad Highlights
document.getElementById('global-pad-left').addEventListener('input', () => {
    renderBoxes();
});
document.getElementById('global-pad-right').addEventListener('input', () => {
    renderBoxes();
});

document.getElementById('save-ayah-pad-btn').addEventListener('click', () => {
    if (!currentAyahData) return;
    
    const padLeft = parseNumericInputValue(document.getElementById('global-pad-left').value);
    const padRight = parseNumericInputValue(document.getElementById('global-pad-right').value);
    
    if (padLeft !== 0 || padRight !== 0) {
        pushUndoSnapshot('apply page ayah padding');
        if (currentAyahData.ayah_highlights) {
            currentAyahData.ayah_highlights.forEach(h => {
                h.left = Math.max(0, h.left - padLeft);
                h.right = Math.min(1, h.right + padRight);
            });
        }
    }
    
    autoSaveAyahData();
    document.getElementById('global-pad-left').value = "0.00";
    document.getElementById('global-pad-right').value = "0.00";
    renderBoxes(); // re-render without visual padding since it's now permanent

    const btn = document.getElementById('save-ayah-pad-btn');
    const origText = btn.textContent;
    btn.textContent = "تم الحفظ!";
    setTimeout(() => {
        btn.textContent = origText;
    }, 1500);
});

document.getElementById('apply-pad-all-btn').addEventListener('click', async () => {
    const padLeft = parseNumericInputValue(document.getElementById('global-pad-left').value);
    const padRight = parseNumericInputValue(document.getElementById('global-pad-right').value);
    
    if (padLeft === 0 && padRight === 0) {
        alert("يرجى إدخال قيمة التمديد أولاً.");
        return;
    }

    const conf = confirm(`هل أنت متأكد من رغبتك في تطبيق تمديد يمين (${padRight}) ويسار (${padLeft}) على جميع ملفات الآيات (485 صفحة)؟\nهذا الإجراء لا يمكن التراجع عنه بسهولة.`);
    if (!conf) return;

    try {
        const btn = document.getElementById('apply-pad-all-btn');
        btn.textContent = "جاري التطبيق...";
        btn.disabled = true;

        const res = await fetch('/api/batch-pad-highlights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ padLeft, padRight })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(`تم تطبيق التعديلات بنجاح على ${data.filesModified} صفحة.`);
            // Reset the inputs
            document.getElementById('global-pad-left').value = "0.00";
            document.getElementById('global-pad-right').value = "0.00";
            // Reload page to fetch updated data
            updatePage(currentPage);
        } else {
            alert("حدث خطأ: " + (data.error || "غير معروف"));
        }
    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
        const btn = document.getElementById('apply-pad-all-btn');
        btn.textContent = "تطبيق وحفظ في كل الصفحات";
        btn.disabled = false;
    }
});

// Live Preview for first and last line pad inputs
document.getElementById('global-first-line-pad').addEventListener('input', () => {
    renderBoxes();
});
document.getElementById('global-last-line-pad').addEventListener('input', () => {
    renderBoxes();
});

// Save first/last line adjustments locally on current page
document.getElementById('save-first-last-page-btn').addEventListener('click', () => {
    if (!currentLayoutData || !currentLayoutData.lineBands || currentLayoutData.lineBands.length === 0) return;
    
    const padFirstTop = parseInt(document.getElementById('global-first-line-pad').value) || 0;
    const padLastBottom = parseInt(document.getElementById('global-last-line-pad').value) || 0;
    
    if (padFirstTop === 0 && padLastBottom === 0) return;
    pushUndoSnapshot('apply first/last line padding');
    
    const bands = currentLayoutData.lineBands;
    const first = bands[0];
    const last = bands[bands.length - 1];
    
    first.top = Math.max(0, first.top - padFirstTop);
    first.center = Math.round((first.top + first.bottom) / 2);
    
    last.bottom = last.bottom + padLastBottom;
    last.center = Math.round((last.top + last.bottom) / 2);
    
    const pageStr = String(currentPage).padStart(3, '0');
    const path = `databases/ayahinfo/warsh_muthamma/page_layout_json/page_${pageStr}.json`;
    saveToServer(path, currentLayoutData, () => {
        originalLineBands = JSON.parse(JSON.stringify(currentLayoutData.lineBands));
        document.getElementById('global-first-line-pad').value = 0;
        document.getElementById('global-last-line-pad').value = 0;
        renderBoxes();
        
        // Show success visual feedback on the button
        const btn = document.getElementById('save-first-last-page-btn');
        const origText = btn.textContent;
        btn.textContent = "تم الحفظ!";
        setTimeout(() => { btn.textContent = origText; }, 1500);
    });
});

// Save first/last line adjustments globally on all pages
document.getElementById('apply-first-last-all-btn').addEventListener('click', async () => {
    const padFirstTop = parseInt(document.getElementById('global-first-line-pad').value) || 0;
    const padLastBottom = parseInt(document.getElementById('global-last-line-pad').value) || 0;
    
    if (padFirstTop === 0 && padLastBottom === 0) {
        alert("يرجى إدخال قيمة تمديد السطر الأول أو الأخير أولاً.");
        return;
    }

    const conf = confirm(`هل أنت متأكد من رغبتك في تطبيق تمديد السطر الأول للأعلى (${padFirstTop}px) وتمديد السطر الأخير للأسفل (${padLastBottom}px) على جميع ملفات التخطيط (485 صفحة)؟\nهذا الإجراء لا يمكن التراجع عنه بسهولة.`);
    if (!conf) return;

    try {
        const btn = document.getElementById('apply-first-last-all-btn');
        btn.textContent = "جاري التطبيق...";
        btn.disabled = true;

        const res = await fetch('/api/batch-adjust-first-last-lines', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ padFirstTop, padLastBottom })
        });
        const data = await res.json();
        
        if (data.success) {
            alert(`تم تطبيق التعديلات بنجاح على ${data.filesModified} صفحة تخطيط.`);
            // Reset the inputs
            document.getElementById('global-first-line-pad').value = 0;
            document.getElementById('global-last-line-pad').value = 0;
            // Reload page to fetch updated data
            updatePage(currentPage);
        } else {
            alert("حدث خطأ: " + (data.error || "غير معروف"));
        }
    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
        const btn = document.getElementById('apply-first-last-all-btn');
        btn.textContent = "تطبيق وحفظ في كل الصفحات";
        btn.disabled = false;
    }
});

// Help Modal
document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').style.display = 'block';
});
document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').style.display = 'none';
});

// Sidebar Resizing Logic
(function() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const leftResizer = document.getElementById('left-resizer');
    const rightResizer = document.getElementById('right-resizer');
    const imageContainer = document.getElementById('image-container');

    let leftWidth = parseInt(localStorage.getItem('sidebar_left_width')) || 250;
    let rightWidth = parseInt(localStorage.getItem('sidebar_right_width')) || 340;

    leftWidth = Math.max(125, Math.min(375, leftWidth));
    rightWidth = Math.max(170, Math.min(510, rightWidth));

    function applySidebarWidths() {
        leftPanel.style.width = leftWidth + 'px';
        rightPanel.style.width = rightWidth + 'px';
        imageContainer.style.marginLeft = leftWidth + 'px';
        imageContainer.style.marginRight = rightWidth + 'px';
        imageContainer.style.width = `calc(100% - ${leftWidth + rightWidth}px)`;
    }

    applySidebarWidths();

    leftResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
        leftResizer.classList.add('resizing');
        const startX = e.clientX;
        const startWidth = leftWidth;

        function onMouseMove(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            leftWidth = Math.max(125, Math.min(375, startWidth + deltaX));
            applySidebarWidths();
        }

        function onMouseUp() {
            document.body.style.cursor = '';
            leftResizer.classList.remove('resizing');
            localStorage.setItem('sidebar_left_width', leftWidth);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    rightResizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
        rightResizer.classList.add('resizing');
        const startX = e.clientX;
        const startWidth = rightWidth;

        function onMouseMove(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            rightWidth = Math.max(170, Math.min(510, startWidth - deltaX));
            applySidebarWidths();
        }

        function onMouseUp() {
            document.body.style.cursor = '';
            rightResizer.classList.remove('resizing');
            localStorage.setItem('sidebar_right_width', rightWidth);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
})();

// Init Checkboxes
const syncCheckbox = document.getElementById('sync-marker-highlight');
const syncNextCheckbox = document.getElementById('sync-next-ayah-highlight');
const syncCreateNextCheckbox = document.getElementById('sync-create-next-highlight');
const renumberFollowingCheckbox = document.getElementById('renumber-following-highlights');
const snapHighlightEdgesCheckbox = document.getElementById('snap-highlight-edges');
if (syncCheckbox) {
    syncCheckbox.checked = localStorage.getItem('warsh_muthamma_sync_marker') === 'true';
    syncCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('warsh_muthamma_sync_marker', e.target.checked);
    });
}
if (syncNextCheckbox) {
    syncNextCheckbox.checked = localStorage.getItem('warsh_muthamma_sync_next') === 'true';
    syncNextCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('warsh_muthamma_sync_next', e.target.checked);
    });
}
if (syncCreateNextCheckbox) {
    syncCreateNextCheckbox.checked = localStorage.getItem('warsh_muthamma_sync_create_next') === 'true';
    syncCreateNextCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('warsh_muthamma_sync_create_next', e.target.checked);
    });
}
if (renumberFollowingCheckbox) {
    renumberFollowingCheckbox.checked = localStorage.getItem('warsh_muthamma_renumber_following') === 'true';
    renumberFollowingCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('warsh_muthamma_renumber_following', e.target.checked);
    });
}
if (snapHighlightEdgesCheckbox) {
    snapHighlightEdgesCheckbox.checked = localStorage.getItem('warsh_muthamma_snap_edges') === 'true';
    snapHighlightEdgesCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('warsh_muthamma_snap_edges', e.target.checked);
    });
}

// Enable scroll adjustments on numeric inputs
document.addEventListener('wheel', (e) => {
    const target = e.target;
    if (target && target.tagName === 'INPUT' && target.type === 'number') {
        // Prevent default browser page scrolling
        e.preventDefault();

        // Focus the input to start history transaction if it has history tracking
        if (document.activeElement !== target) {
            target.focus();
        }

        let val = parseNumericInputValue(target.value);
        if (isNaN(val)) {
            val = 0;
        }

        const stepAttr = target.getAttribute('step');
        let step = 1;
        if (stepAttr && stepAttr !== 'any') {
            step = parseNumericInputValue(stepAttr, 1);
        } else if (stepAttr === 'any') {
            step = 0.0001;
        }

        // Adjust value based on scroll direction
        if (e.deltaY < 0) {
            val += step;
        } else {
            val -= step;
        }

        // Min/max constraints
        const minAttr = target.getAttribute('min');
        const maxAttr = target.getAttribute('max');
        if (minAttr !== null) {
            val = Math.max(parseNumericInputValue(minAttr), val);
        }
        if (maxAttr !== null) {
            val = Math.min(parseNumericInputValue(maxAttr), val);
        }

        // Format to correct decimal places to prevent floating-point precision errors
        let decimals = 0;
        if (stepAttr && stepAttr.includes('.')) {
            decimals = stepAttr.split('.')[1].length;
        } else if (stepAttr === 'any') {
            decimals = 4;
        } else if (step < 1) {
            decimals = -Math.floor(Math.log10(step));
        }

        target.value = val.toFixed(decimals);

        // Dispatch input event to update model and preview immediately
        target.dispatchEvent(new Event('input', { bubbles: true }));

        // Debounce the change event to commit history transaction after scrolling stops
        if (target._scrollTimeout) {
            clearTimeout(target._scrollTimeout);
        }
        target._scrollTimeout = setTimeout(() => {
            target.dispatchEvent(new Event('change', { bubbles: true }));
        }, 400);
    }
}, { passive: false });

// Ayah Offset Adjustment Logic
function adjustSuraAyahNumbers(delta) {
    if (!selectedItem || !currentAyahData) {
        alert("يرجى اختيار تظليل آية أو علامة نهاية آية أولاً.");
        return;
    }

    // 1. Determine Sura and start Ayah
    let currentSura = 0;
    let startAyah = 0;
    const selectedIdx = selectedItem.index;

    if (selectedItem.type === 'highlight') {
        const h = currentAyahData.ayah_highlights[selectedIdx];
        currentSura = h.sura;
        startAyah = h.ayah;
    } else if (selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedIdx];
        currentSura = m.sura;
        startAyah = m.ayah;
    }

    if (!currentSura) {
        alert("لا يمكن تحديد السورة الحالية.");
        return;
    }

    const scopeAll = document.getElementById('adj-scope-all').checked;

    // Start Undo/Redo history transaction
    beginHistoryTransaction(`shift sura ${currentSura} ayahs ${delta > 0 ? '+' : ''}${delta}`);

    // 2. Adjust highlights
    if (currentAyahData.ayah_highlights) {
        currentAyahData.ayah_highlights.forEach((h) => {
            if (h.sura === currentSura) {
                if (scopeAll || h.ayah >= startAyah) {
                    h.ayah = Math.max(1, h.ayah + delta);
                    if (h.source !== 'manual_marker_sync' && !String(h.source || '').includes('renumbered')) {
                        h.source = `${h.source || 'manual'}_renumbered`;
                    }
                }
            }
        });
    }

    // 3. Adjust markers
    if (currentAyahData.ayah_markers) {
        currentAyahData.ayah_markers.forEach((m) => {
            if (m.sura === currentSura) {
                if (scopeAll || m.ayah >= startAyah) {
                    m.ayah = Math.max(1, m.ayah + delta);
                }
            }
        });
    }

    // End history transaction
    endHistoryTransaction();

    // 4. Re-render and update UI
    renderBoxes();
    openRightPanel();
    
    // Automatically trigger save buttons update
    if (typeof updateLeftPanelSaveButtons === 'function') {
        updateLeftPanelSaveButtons();
    }
    
    showToast(`تمت إزاحة آيات السورة ${currentSura} بـ ${delta > 0 ? '+' : ''}${delta}`);
}

// Attach listeners for adjustment buttons
document.getElementById('btn-adj-ayah-minus').addEventListener('click', () => adjustSuraAyahNumbers(-1));
document.getElementById('btn-adj-ayah-plus').addEventListener('click', () => adjustSuraAyahNumbers(1));

// Init
updatePage(currentPage);
clearRightPanel();
