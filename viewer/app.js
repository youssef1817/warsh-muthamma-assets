const TOTAL_PAGES = 485;
const IMAGE_BASE_PATH = '../pages/warsh_muthamma_png/page';

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
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartLeft = 0;
let dragStartRight = 0;
let dragStartCX = 0;
let dragStartCY = 0;

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
    toggleOverlayBtn: document.getElementById('toggle-overlay-btn')
};

function showToast(msg, isError = false) {
    DOM.toast.textContent = msg;
    DOM.toast.style.background = isError ? '#f44336' : '#4CAF50';
    DOM.toast.style.opacity = 1;
    setTimeout(() => DOM.toast.style.opacity = 0, 3000);
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
    } catch (err) {
        console.error(err);
        showToast('خطأ أثناء الحفظ! هل الخادم Node.js يعمل؟', true);
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

    const pageStr = String(page).padStart(3, '0');
    const layoutUrl = `../databases/ayahinfo/warsh_muthamma/page_layout_json/page_${pageStr}.json`;
    const ayahUrl = `../databases/ayahinfo/warsh_muthamma/pages_json/page_${pageStr}.json`;

    try {
        const [layoutRes, ayahRes] = await Promise.all([ fetch(layoutUrl), fetch(ayahUrl) ]);
        if (!layoutRes.ok || !ayahRes.ok) throw new Error('Data not found');

        currentLayoutData = await layoutRes.json();
        currentAyahData = await ayahRes.json();
        
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
        currentLayoutData.lineBands.forEach(b => {
            lineMap[b.line] = {
                top: b.top / imgHeight * 100,
                height: (b.bottom - b.top) / imgHeight * 100
            };
        });
    }

    // Render Highlights
    if (currentAyahData.ayah_highlights) {
        const padLeft = parseFloat(document.getElementById('global-pad-left').value) || 0;
        const padRight = parseFloat(document.getElementById('global-pad-right').value) || 0;

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
                
                if (selectedItem && selectedItem.type === 'highlight' && selectedItem.index === index) {
                    div.classList.add('selected-box');
                }

                div.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return; // Only left click
                    e.stopPropagation();
                    selectItem('highlight', index);
                    isDragging = true;
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
                
                if (selectedItem && selectedItem.type === 'marker' && selectedItem.index === index) {
                    div.classList.add('selected-box');
                }

                div.addEventListener('mousedown', (e) => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    selectItem('marker', index);
                    isDragging = true;
                    dragStartMouseX = e.clientX;
                    dragStartMouseY = e.clientY;
                    dragStartCX = m.center_x;
                    dragStartCY = m.center_y || 0.5;
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
            selectedItemOriginals = { left: h.left, right: h.right };
        } else if (type === 'marker') {
            const m = currentAyahData.ayah_markers[index];
            selectedItemOriginals = { center_x: m.center_x, center_y: m.center_y || 0.5 };
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
        h.left = dragStartLeft + deltaX;
        h.right = dragStartRight + deltaX;
    } else if (selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedItem.index];
        
        // Keyboard modifier constraints
        const lockVertical = e.shiftKey && !e.ctrlKey; // Shift alone -> horizontal only
        const lockHorizontal = e.shiftKey && e.ctrlKey; // Ctrl+Shift -> vertical only
        
        if (lockHorizontal) {
            m.center_x = dragStartCX;
        } else {
            m.center_x = dragStartCX + deltaX;
        }
        
        if (typeof syncHighlightWithMarker === 'function') syncHighlightWithMarker(m);
        
        const lineBand = currentLayoutData.lineBands.find(b => b.line === m.line);
        if (lineBand) {
            const bandHeightInPx = ((lineBand.bottom - lineBand.top) / currentLayoutData.imageHeight) * imgRect.height;
            const deltaYBand = (e.clientY - dragStartMouseY) / bandHeightInPx;
            if (lockVertical) {
                m.center_y = dragStartCY;
            } else {
                m.center_y = dragStartCY + deltaYBand;
            }
        }
    }
    renderBoxes();
    openRightPanel(); // refresh inputs
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        autoSaveAyahData();
    }
});

function openRightPanel() {
    if (!selectedItem || !currentAyahData) {
        clearRightPanel();
        return;
    }

    const btnSave = document.getElementById('save-ayah-btn');
    btnSave.disabled = false;
    btnSave.style.opacity = 1;
    btnSave.style.cursor = 'pointer';

    const badge = document.getElementById('save-status-badge');
    badge.style.background = "";
    badge.style.color = "";
    badge.style.border = "";
    
    if (selectedItem.type === 'highlight') {
        const h = currentAyahData.ayah_highlights[selectedItem.index];
        
        document.getElementById('meta-type').textContent = "تظليل آية";
        document.getElementById('meta-sura').textContent = h.sura;
        document.getElementById('meta-ayah').textContent = h.ayah;
        document.getElementById('meta-line').textContent = h.line;

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
        }

        // Compare values
        const origLeft = selectedItemOriginals ? selectedItemOriginals.left : h.left;
        const origRight = selectedItemOriginals ? selectedItemOriginals.right : h.right;
        document.getElementById('hl-left-orig').textContent = origLeft.toFixed(4);
        document.getElementById('hl-left-curr').textContent = h.left.toFixed(4);
        document.getElementById('hl-right-orig').textContent = origRight.toFixed(4);
        document.getElementById('hl-right-curr').textContent = h.right.toFixed(4);

        // Update badge state
        const isLeftChanged = Math.abs(h.left - origLeft) > 0.00001;
        const isRightChanged = Math.abs(h.right - origRight) > 0.00001;
        const isChanged = isLeftChanged || isRightChanged;
        
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

    } else if (selectedItem.type === 'marker') {
        const m = currentAyahData.ayah_markers[selectedItem.index];
        
        document.getElementById('meta-type').textContent = "علامة نهاية آية";
        document.getElementById('meta-sura').textContent = m.sura;
        document.getElementById('meta-ayah').textContent = m.ayah;
        document.getElementById('meta-line').textContent = m.line;

        document.getElementById('highlight-value-fields').style.display = 'none';
        document.getElementById('marker-value-fields').style.display = 'flex';

        // Input values
        if (document.activeElement !== document.getElementById('mk-cx')) {
            document.getElementById('mk-cx').value = m.center_x;
        }
        if (document.activeElement !== document.getElementById('mk-cy')) {
            document.getElementById('mk-cy').value = m.center_y || 0.5;
        }

        // Compare values
        const origCX = selectedItemOriginals ? selectedItemOriginals.center_x : m.center_x;
        const origCY = selectedItemOriginals ? selectedItemOriginals.center_y : (m.center_y || 0.5);
        const currCY = m.center_y || 0.5;

        document.getElementById('mk-cx-orig').textContent = origCX.toFixed(4);
        document.getElementById('mk-cx-curr').textContent = m.center_x.toFixed(4);
        document.getElementById('mk-cy-orig').textContent = origCY.toFixed(4);
        document.getElementById('mk-cy-curr').textContent = currCY.toFixed(4);

        // Update badge state
        const isCXChanged = Math.abs(m.center_x - origCX) > 0.00001;
        const isCYChanged = Math.abs(currCY - origCY) > 0.00001;
        const isChanged = isCXChanged || isCYChanged;

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
    }
}

function clearRightPanel() {
    document.getElementById('meta-type').textContent = "-";
    document.getElementById('meta-sura').textContent = "-";
    document.getElementById('meta-ayah').textContent = "-";
    document.getElementById('meta-line').textContent = "-";

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
    document.getElementById('mk-cx').value = "";
    document.getElementById('mk-cy').value = "";

    // Reset comparison texts
    document.getElementById('hl-left-orig').textContent = "-";
    document.getElementById('hl-left-curr').textContent = "-";
    document.getElementById('hl-right-orig').textContent = "-";
    document.getElementById('hl-right-curr').textContent = "-";
    document.getElementById('mk-cx-orig').textContent = "-";
    document.getElementById('mk-cx-curr').textContent = "-";
    document.getElementById('mk-cy-orig').textContent = "-";
    document.getElementById('mk-cy-curr').textContent = "-";

    const ids = ['save-hl-left', 'save-hl-right', 'save-mk-cx', 'save-mk-cy'];
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
}

function closeRightPanel() {
    selectedItem = null;
    selectedItemOriginals = null;
    renderBoxes();
    clearRightPanel();
}

document.getElementById('close-right-panel').addEventListener('click', closeRightPanel);
DOM.img.addEventListener('click', closeRightPanel); // clicking image deselects

document.getElementById('hl-left').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'highlight') {
        currentAyahData.ayah_highlights[selectedItem.index].left = parseFloat(e.target.value) || 0;
        renderBoxes();
        openRightPanel();
    }
});
document.getElementById('hl-right').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'highlight') {
        currentAyahData.ayah_highlights[selectedItem.index].right = parseFloat(e.target.value) || 0;
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
        m.center_x = parseFloat(e.target.value) || 0;
        if (typeof syncHighlightWithMarker === 'function') syncHighlightWithMarker(m);
        renderBoxes();
        openRightPanel();
    }
});
document.getElementById('mk-cy').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'marker') {
        currentAyahData.ayah_markers[selectedItem.index].center_y = parseFloat(e.target.value) || 0;
        renderBoxes();
        openRightPanel();
    }
});

// Sync Highlight With Marker
function syncHighlightWithMarker(m) {
    const syncCheckbox = document.getElementById('sync-marker-highlight');
    const syncNextCheckbox = document.getElementById('sync-next-ayah-highlight');
    
    // The text is RTL. The end of the ayah text is on the left side (h.left).
    // 1. Sync the left boundary of the current ayah highlight on the same line
    if (syncCheckbox && syncCheckbox.checked) {
        const currentHighlight = currentAyahData.ayah_highlights.find(h => 
            h.sura === m.sura && h.ayah === m.ayah && h.line === m.line
        );
        if (currentHighlight) {
            currentHighlight.left = m.center_x;
        }
    }

    // 2. Sync the right boundary of the next ayah highlight on the same line
    if (syncNextCheckbox && syncNextCheckbox.checked) {
        // Look for the highlight that immediately follows this one logically (usually m.ayah + 1)
        const nextHighlight = currentAyahData.ayah_highlights.find(h => 
            h.line === m.line && 
            ((h.sura === m.sura && h.ayah === m.ayah + 1) || (h.sura === m.sura + 1 && h.ayah === 1))
        );
        if (nextHighlight) {
            nextHighlight.right = m.center_x;
        }
    }
}

// Reset Button Listeners
document.getElementById('reset-hl-left').addEventListener('click', () => {
    if (selectedItem && selectedItem.type === 'highlight' && selectedItemOriginals) {
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
        const m = currentAyahData.ayah_markers[selectedItem.index];
        m.center_y = selectedItemOriginals.center_y;
        document.getElementById('mk-cy').value = m.center_y;
        renderBoxes();
        openRightPanel();
        autoSaveAyahData();
    }
});

document.getElementById('reset-global-y-offset').addEventListener('click', () => {
    document.getElementById('global-y-offset').value = 0;
    applyGlobalLayoutTweaks();
    autoSaveLayoutData();
});
document.getElementById('reset-global-scale').addEventListener('click', () => {
    document.getElementById('global-scale').value = 1.0;
    applyGlobalLayoutTweaks();
    autoSaveLayoutData();
});
document.getElementById('reset-global-height').addEventListener('click', () => {
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
document.getElementById('save-mk-cx').addEventListener('click', () => {
    document.getElementById('save-ayah-btn').click();
});
document.getElementById('save-mk-cy').addEventListener('click', () => {
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

// Save Actions
document.getElementById('save-ayah-btn').addEventListener('click', () => {
    if (currentAyahData) {
        const pageStr = String(currentPage).padStart(3, '0');
        const path = `databases/ayahinfo/warsh_muthamma/pages_json/page_${pageStr}.json`;
        saveToServer(path, currentAyahData, () => {
            if (selectedItem) {
                if (selectedItem.type === 'highlight') {
                    const h = currentAyahData.ayah_highlights[selectedItem.index];
                    selectedItemOriginals = { left: h.left, right: h.right };
                } else if (selectedItem.type === 'marker') {
                    const m = currentAyahData.ayah_markers[selectedItem.index];
                    selectedItemOriginals = { center_x: m.center_x, center_y: m.center_y || 0.5 };
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
    const scale = parseFloat(document.getElementById('global-scale').value) || 1.0;
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
    const scale = parseFloat(document.getElementById('global-scale').value) || 1.0;
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
    if (selectedItem && (e.key.startsWith('Arrow'))) {
        
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

        let updatedAyah = false;
        let updatedLayout = false;

        if (selectedItem.type === 'highlight') {
            const h = currentAyahData.ayah_highlights[selectedItem.index];
            const lineBand = currentLayoutData.lineBands.find(b => b.line === h.line);
            
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
            if (e.shiftKey && !e.ctrlKey && !e.altKey) {
                const step = 0.001;
                if (e.key === 'ArrowLeft') { m.center_x -= step; updatedAyah = true; }
                else if (e.key === 'ArrowRight') { m.center_x += step; updatedAyah = true; }
                else if (e.key === 'ArrowUp') { m.center_y -= step; updatedAyah = true; }
                else if (e.key === 'ArrowDown') { m.center_y += step; updatedAyah = true; }
                if (updatedAyah && typeof syncHighlightWithMarker === 'function') {
                    syncHighlightWithMarker(m);
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
    
    const padLeft = parseFloat(document.getElementById('global-pad-left').value) || 0;
    const padRight = parseFloat(document.getElementById('global-pad-right').value) || 0;
    
    if (padLeft !== 0 || padRight !== 0) {
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
    const padLeft = parseFloat(document.getElementById('global-pad-left').value) || 0;
    const padRight = parseFloat(document.getElementById('global-pad-right').value) || 0;
    
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

// Init
updatePage(currentPage);
clearRightPanel();
