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
    clearTimeout(ayahSaveTimeout);
    ayahSaveTimeout = setTimeout(() => {
        document.getElementById('save-ayah-btn').click();
    }, 800);
}

function autoSaveLayoutData() {
    clearTimeout(layoutSaveTimeout);
    layoutSaveTimeout = setTimeout(() => {
        document.getElementById('save-layout-btn').click();
    }, 800);
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
    DOM.pageText.textContent = currentPage;
    DOM.jumpInput.value = ''; 
    
    localStorage.setItem('warsh_muthamma_last_page', currentPage);
    closeRightPanel();
    
    // Reset left panel inputs
    document.getElementById('global-y-offset').value = 0;
    document.getElementById('global-scale').value = 1.0;

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
        currentAyahData.ayah_highlights.forEach((h, index) => {
            const band = lineMap[h.line];
            if (band) {
                const div = document.createElement('div');
                div.className = 'highlight-box';
                const leftPct = Math.min(h.left, h.right) * 100;
                const rightPct = Math.max(h.left, h.right) * 100;
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
                div.style.height = '3.5%';
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
        m.center_x = dragStartCX + deltaX;
        
        const lineBand = currentLayoutData.lineBands.find(b => b.line === m.line);
        if (lineBand) {
            const bandHeightInPx = ((lineBand.bottom - lineBand.top) / currentLayoutData.imageHeight) * imgRect.height;
            const deltaYBand = (e.clientY - dragStartMouseY) / bandHeightInPx;
            m.center_y = dragStartCY + deltaYBand;
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
        document.getElementById('hl-left').value = h.left;
        document.getElementById('hl-right').value = h.right;

        // Compare values
        const origLeft = selectedItemOriginals ? selectedItemOriginals.left : h.left;
        const origRight = selectedItemOriginals ? selectedItemOriginals.right : h.right;
        document.getElementById('hl-left-orig').textContent = origLeft.toFixed(4);
        document.getElementById('hl-left-curr').textContent = h.left.toFixed(4);
        document.getElementById('hl-right-orig').textContent = origRight.toFixed(4);
        document.getElementById('hl-right-curr').textContent = h.right.toFixed(4);

        // Update badge state
        const isChanged = Math.abs(h.left - origLeft) > 0.00001 || Math.abs(h.right - origRight) > 0.00001;
        if (isChanged) {
            badge.textContent = "غير محفوظ ⚠️";
            badge.className = "badge badge-unsaved";
        } else {
            badge.textContent = "تم الحفظ ✓";
            badge.className = "badge badge-saved";
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
        document.getElementById('mk-cx').value = m.center_x;
        document.getElementById('mk-cy').value = m.center_y || 0.5;

        // Compare values
        const origCX = selectedItemOriginals ? selectedItemOriginals.center_x : m.center_x;
        const origCY = selectedItemOriginals ? selectedItemOriginals.center_y : (m.center_y || 0.5);
        const currCY = m.center_y || 0.5;

        document.getElementById('mk-cx-orig').textContent = origCX.toFixed(4);
        document.getElementById('mk-cx-curr').textContent = m.center_x.toFixed(4);
        document.getElementById('mk-cy-orig').textContent = origCY.toFixed(4);
        document.getElementById('mk-cy-curr').textContent = currCY.toFixed(4);

        // Update badge state
        const isChanged = Math.abs(m.center_x - origCX) > 0.00001 || Math.abs(currCY - origCY) > 0.00001;
        if (isChanged) {
            badge.textContent = "غير محفوظ ⚠️";
            badge.className = "badge badge-unsaved";
        } else {
            badge.textContent = "تم الحفظ ✓";
            badge.className = "badge badge-saved";
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

    // Show empty input fields but disabled
    document.getElementById('highlight-value-fields').style.display = 'flex';
    document.getElementById('marker-value-fields').style.display = 'flex';

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
        autoSaveAyahData();
    }
});
document.getElementById('hl-right').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'highlight') {
        currentAyahData.ayah_highlights[selectedItem.index].right = parseFloat(e.target.value) || 0;
        renderBoxes();
        autoSaveAyahData();
    }
});
document.getElementById('mk-cx').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'marker') {
        currentAyahData.ayah_markers[selectedItem.index].center_x = parseFloat(e.target.value) || 0;
        renderBoxes();
        autoSaveAyahData();
    }
});
document.getElementById('mk-cy').addEventListener('input', (e) => {
    if (selectedItem && selectedItem.type === 'marker') {
        currentAyahData.ayah_markers[selectedItem.index].center_y = parseFloat(e.target.value) || 0;
        renderBoxes();
        autoSaveAyahData();
    }
});

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
            }
            document.getElementById('global-y-offset').value = 0;
            document.getElementById('global-scale').value = 1.0;
        });
    }
});

// Left Panel (Global Layout Tweaks)
function applyGlobalLayoutTweaks() {
    if (!originalLineBands || !currentLayoutData) return;
    const yOffset = parseInt(document.getElementById('global-y-offset').value) || 0;
    const scale = parseFloat(document.getElementById('global-scale').value) || 1.0;

    currentLayoutData.lineBands = originalLineBands.map(orig => {
        const center = orig.center + yOffset;
        const halfHeight = ((orig.bottom - orig.top) / 2) * scale;
        return {
            line: orig.line,
            top: Math.round(center - halfHeight),
            bottom: Math.round(center + halfHeight),
            center: center
        };
    });
    renderBoxes();
}

document.getElementById('global-y-offset').addEventListener('input', () => {
    applyGlobalLayoutTweaks();
    autoSaveLayoutData();
});
document.getElementById('global-scale').addEventListener('input', () => {
    applyGlobalLayoutTweaks();
    autoSaveLayoutData();
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

document.getElementById('jump-btn').addEventListener('click', () => {
    const val = parseInt(DOM.jumpInput.value);
    if (!isNaN(val) && val >= 1 && val <= TOTAL_PAGES) updatePage(val);
});

document.getElementById('refresh-btn').addEventListener('click', () => {
    const pageStr = String(currentPage).padStart(3, '0');
    DOM.img.src = `${IMAGE_BASE_PATH}${pageStr}.png?t=${new Date().getTime()}`;
});

// Help Modal
document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').style.display = 'block';
});
document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').style.display = 'none';
});

// Init
updatePage(currentPage);
clearRightPanel();
