// ============================================================
// GLOBAL STATE & FLASK API INTEGRATION
// ============================================================
let totalUploadedImageSizeMB = 0;

// UNDO & REDO STATE MANAGEMENT
let undoStack = [];
let redoStack = [];

document.addEventListener("DOMContentLoaded", () => {
    loadGlobalFeedFromBackend();
});

// FETCH GLOBAL POSTS FROM FLASK BACKEND
function loadGlobalFeedFromBackend() {
    const timeline = document.getElementById('timeline-feed');
    if (!timeline) return;

    fetch('/api/posts')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && Array.isArray(data.posts)) {
                timeline.innerHTML = '';
                if (data.posts.length === 0) {
                    timeline.innerHTML = '<p style="text-align:center; color:#94a3b8; margin-top:2rem;">No posts yet. Be the first to express yourself!</p>';
                    return;
                }
                data.posts.forEach(post => renderPostToFeed(post));
            }
        })
        .catch(err => console.error("Error loading community feed:", err));
}

function renderPostToFeed(post) {
    const timeline = document.getElementById('timeline-feed');
    if (!timeline) return;

    const baseWidth = post.canvas_width || 1000;
    const baseHeight = post.canvas_height || 500;

    const article = document.createElement('article');
    article.className = 'feed-post dynamic-new-post-animation';
    article.innerHTML = `
        <div class="post-header">
            <div class="post-user-info">
                <span class="post-avatar-fallback">${post.avatar_initials || 'US'}</span>
                <div>
                    <span class="post-author">${post.author || '@username'}</span>
                    <div class="post-timestamp">${post.formatted_date || 'Just now'}</div>
                </div>
            </div>
        </div>

        <div class="post-canvas-content" data-base-width="${baseWidth}" data-base-height="${baseHeight}" style="background-color: ${post.bg_color || '#ffffff'}; position: relative; width: 100%; aspect-ratio: ${baseWidth} / ${baseHeight}; overflow: hidden; border-radius: 12px; border: 1px solid #e5e0d8;">
            ${post.doodle_layer ? `<img src="${post.doodle_layer}" class="post-doodle-layer" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain; pointer-events:none; z-index:1;">` : ''}
            <div class="post-2d-viewport" style="position: absolute; top:0; left:0; width: ${baseWidth}px; height: ${baseHeight}px; z-index: 2; transform-origin: 0 0;">
                ${post.html_content}
            </div>
        </div>

        <div class="post-actions-bar">
            <button class="like-btn" onclick="toggleLike(this, ${post.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="like-count">${post.likes || 0}</span>
            </button>
            <button class="share-btn" onclick="sharePost()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                <span>Share</span>
            </button>
        </div>
    `;
    timeline.appendChild(article);
    
    setTimeout(applyResponsiveFeedScaling, 20);
}

function applyResponsiveFeedScaling() {
    const postContainers = document.querySelectorAll('.post-canvas-content');
    postContainers.forEach(container => {
        const baseWidth = parseFloat(container.getAttribute('data-base-width')) || 1000;
        const currentWidth = container.clientWidth;

        if (currentWidth > 0 && baseWidth > 0) {
            const scaleFactor = currentWidth / baseWidth;
            const viewport = container.querySelector('.post-2d-viewport');

            if (viewport) {
                viewport.style.transform = `scale(${scaleFactor})`;
                viewport.style.webkitTransform = `scale(${scaleFactor})`;
                viewport.style.transformOrigin = '0 0';
                viewport.style.webkitTransformOrigin = '0 0';
            }
        }
    });
}

window.addEventListener('resize', applyResponsiveFeedScaling);
window.addEventListener('orientationchange', applyResponsiveFeedScaling);

// NOTIFICATIONS & SETTINGS MODALS
function toggleNotificationsMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
});

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    const handle = localStorage.getItem("ss_handle") || "@username";
    const bio = localStorage.getItem("ss_bio") || "";
    const isHiGreeting = localStorage.getItem("ss_display_greeting") === "true";
    const links = JSON.parse(localStorage.getItem("ss_links") || "[]");

    document.getElementById('settings-username').value = handle.replace('@', '');
    document.getElementById('settings-bio').value = bio;
    document.getElementById('toggle-display-mode').checked = isHiGreeting;

    const linksContainer = document.getElementById('links-container');
    linksContainer.innerHTML = '';
    if (links.length > 0) {
        links.forEach(link => addLinkInput(link.title, link.url));
    } else {
        addLinkInput();
    }

    modal.classList.remove('hidden');
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
}

function addLinkInput(title = '', url = '') {
    const container = document.getElementById('links-container');
    if (!container) return;
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '6px';
    row.innerHTML = `
        <input type="text" placeholder="Title (e.g. Portfolio)" value="${title}" class="link-title-input" style="flex:1; padding:6px 10px; border-radius:6px; border:1px solid var(--card-border); background:var(--input-bg); color:#fff; font-size:12px;">
        <input type="url" placeholder="https://..." value="${url}" class="link-url-input" style="flex:2; padding:6px 10px; border-radius:6px; border:1px solid var(--card-border); background:var(--input-bg); color:#fff; font-size:12px;">
        <button type="button" onclick="this.parentNode.remove()" style="background:none; border:none; color:var(--danger); font-size:16px; cursor:pointer;">&times;</button>
    `;
    container.appendChild(row);
}

function previewDisplayToggle(checkbox) {
    localStorage.setItem("ss_display_greeting", checkbox.checked);
}

function saveUserSettings(event) {
    event.preventDefault();

    const newHandle = '@' + document.getElementById('settings-username').value.trim().replace('@', '');
    const newBio = document.getElementById('settings-bio').value.trim();
    const newPassword = document.getElementById('settings-password').value.trim();
    const isHiGreeting = document.getElementById('toggle-display-mode').checked;

    const linkTitles = document.querySelectorAll('.link-title-input');
    const linkUrls = document.querySelectorAll('.link-url-input');
    const links = [];
    linkTitles.forEach((el, idx) => {
        const title = el.value.trim();
        const url = linkUrls[idx].value.trim();
        if (title && url) links.push({ title, url });
    });

    localStorage.setItem("ss_handle", newHandle);
    localStorage.setItem("ss_bio", newBio);
    localStorage.setItem("ss_display_greeting", isHiGreeting);
    localStorage.setItem("ss_links", JSON.stringify(links));

    if (newPassword) localStorage.setItem("ss_password", newPassword);

    closeSettingsModal();
    alert("Profile settings updated successfully!");
}

function logoutUser() {
    localStorage.removeItem("ss_name");
    localStorage.removeItem("ss_handle");
    window.location.href = '/';
}

// ============================================================
// CANVAS DRAWING & SKETCH ENGINE
// ============================================================
const universe = document.getElementById('canvas-universe');
const assetGate = document.getElementById('secure-asset-gate');
const overlay = document.getElementById('creator-canvas-overlay');
const timeline = document.getElementById('timeline-feed');
const pad = document.getElementById('sketch-pad');
const ctx = pad ? pad.getContext('2d') : null;

let isDrawing = false;
let currentTool = 'select'; // DEFAULT TO SELECT / MOVE TOOL (PEN DISABLED BY DEFAULT)
let targetUploadType = '';
let activeElement = null;
let startX = 0, startY = 0;
let CanvasZIndexCounter = 100;
let currentCanvasBgColor = '#ffffff';

function initPad() {
    if (!universe || !pad) return;
    pad.width = universe.clientWidth;
    pad.height = universe.clientHeight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

window.addEventListener('resize', () => { if (overlay && !overlay.classList.contains('hidden')) initPad(); });

function saveCanvasState() {
    if (!pad) return;
    const doodleData = ctx.getImageData(0, 0, pad.width, pad.height);
    
    // Save DOM elements snapshot
    const elementsSnapshot = [];
    if (universe) {
        universe.querySelectorAll('.canvas-direct-element').forEach(el => {
            elementsSnapshot.push(el.outerHTML);
        });
    }

    undoStack.push({
        doodle: doodleData,
        elements: elementsSnapshot
    });

    // Limit undo stack to 25 states
    if (undoStack.length > 25) undoStack.shift();
    
    // Clear redo stack on new action
    redoStack = [];
}

function undoCanvasState() {
    if (undoStack.length === 0) return;

    // Save current state to redo stack
    const currentDoodle = ctx.getImageData(0, 0, pad.width, pad.height);
    const currentElements = [];
    if (universe) {
        universe.querySelectorAll('.canvas-direct-element').forEach(el => currentElements.push(el.outerHTML));
    }
    redoStack.push({ doodle: currentDoodle, elements: currentElements });

    // Restore previous state
    const previousState = undoStack.pop();
    ctx.putImageData(previousState.doodle, 0, 0);

    // Re-render HTML elements
    if (universe) {
        universe.querySelectorAll('.canvas-direct-element').forEach(el => el.remove());
        previousState.elements.forEach(html => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const restoredNode = tempDiv.firstElementChild;
            universe.appendChild(restoredNode);
            makeElementInteractive(restoredNode);
        });
    }
}

function redoCanvasState() {
    if (redoStack.length === 0) return;

    // Save current state to undo stack
    const currentDoodle = ctx.getImageData(0, 0, pad.width, pad.height);
    const currentElements = [];
    if (universe) {
        universe.querySelectorAll('.canvas-direct-element').forEach(el => currentElements.push(el.outerHTML));
    }
    undoStack.push({ doodle: currentDoodle, elements: currentElements });

    // Restore redo state
    const nextState = redoStack.pop();
    ctx.putImageData(nextState.doodle, 0, 0);

    // Re-render HTML elements
    if (universe) {
        universe.querySelectorAll('.canvas-direct-element').forEach(el => el.remove());
        nextState.elements.forEach(html => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const restoredNode = tempDiv.firstElementChild;
            universe.appendChild(restoredNode);
            makeElementInteractive(restoredNode);
        });
    }
}

function toggleCanvasOverlay(shouldShow) {
    if (shouldShow) {
        overlay.classList.remove('hidden');
        totalUploadedImageSizeMB = 0;
        undoStack = [];
        redoStack = [];
        
        currentCanvasBgColor = '#ffffff';
        if (universe) universe.style.setProperty('background-color', '#ffffff', 'important');
        const colorPicker = document.getElementById('canvas-bg-picker');
        if (colorPicker) colorPicker.value = '#ffffff';

        setTimeout(() => {
            initPad();
            clearDoodles();
            setDrawingTool('select'); // Default to Select mode on canvas open
        }, 50);
        
        if (universe) universe.querySelectorAll('.canvas-direct-element').forEach(el => el.remove());
    } else {
        if (overlay) overlay.classList.add('hidden');
    }
}

function changeCanvasMoodColor(colorHex) {
    currentCanvasBgColor = colorHex;
    const universeEl = document.getElementById('canvas-universe');
    if (universeEl) {
        universeEl.style.setProperty('background-color', colorHex, 'important');
    }
}

function setDrawingTool(tool) {
    const penBtn = document.getElementById('pen-toggle-btn');
    const eraserBtn = document.getElementById('eraser-toggle-btn');

    // Toggle off if clicking the currently active tool
    if (currentTool === tool) {
        currentTool = 'none';
        if (penBtn) penBtn.classList.remove('active');
        if (eraserBtn) eraserBtn.classList.remove('active');
        if (pad) pad.style.pointerEvents = 'none'; // Disables drawing, unlocks clicking elements
        return;
    }

    // Activate selected tool
    currentTool = tool;
    if (penBtn) penBtn.classList.toggle('active', tool === 'pen');
    if (eraserBtn) eraserBtn.classList.toggle('active', tool === 'eraser');

    // Enable sketch pad for drawing
    if (pad) pad.style.pointerEvents = 'auto';
}

function clearDoodles() {
    saveCanvasState();
    if (ctx && pad) ctx.clearRect(0, 0, pad.width, pad.height);
}

function getPointerPos(e) {
    const rect = pad.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function startStroke(e) {
    if (e.target !== pad || currentTool === 'none') return;
    saveCanvasState();
    isDrawing = true;
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function drawStroke(e) {
    if (!isDrawing || currentTool === 'none') return;
    if (e.cancelable) e.preventDefault();
    const pos = getPointerPos(e);

    ctx.lineWidth = document.getElementById('pen-size').value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    } else if (currentTool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = document.getElementById('pen-color').value;
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }
}

// VERTICAL TOOLBOX DROPDOWN CONTROLLERS
// VERTICAL TOOLBOX DROPDOWN CONTROLLERS
function toggleToolboxMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('vertical-toolbox-menu');
    if (menu) menu.classList.toggle('hidden');
}

function closeToolboxMenu() {
    const menu = document.getElementById('vertical-toolbox-menu');
    if (menu) menu.classList.add('hidden');
}

// Close menu when clicking on the workspace
document.addEventListener('click', (event) => {
    const container = document.querySelector('.studio-toolbox-dropdown-container');
    if (container && !container.contains(event.target)) {
        closeToolboxMenu();
    }
});

function endStroke() {
    isDrawing = false;
    if (ctx) ctx.beginPath();
}

if (pad) {
    pad.addEventListener('mousedown', startStroke);
    pad.addEventListener('mousemove', drawStroke);
    pad.addEventListener('mouseup', endStroke);
    pad.addEventListener('mouseleave', endStroke);

    pad.addEventListener('touchstart', startStroke, { passive: false });
    pad.addEventListener('touchmove', drawStroke, { passive: false });
    pad.addEventListener('touchend', endStroke);
}

function makeElementInteractive(element) {
    const startDrag = (e) => {
        if (e.target.closest('.element-delete-btn') || e.target.closest('.element-resize-handle') || ['INPUT', 'SELECT', 'OPTION'].includes(e.target.tagName)) return;

        saveCanvasState(); // Save state before moving an element

        const dragOverlay = element.querySelector('.audio-drag-overlay');
        if (dragOverlay && e.detail > 1) {
            dragOverlay.style.pointerEvents = 'none';
            setTimeout(() => { dragOverlay.style.pointerEvents = 'auto'; }, 3000);
            return;
        }

        activeElement = element;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX - element.offsetLeft;
        startY = clientY - element.offsetTop;
        element.style.zIndex = ++CanvasZIndexCounter;
    };

    element.addEventListener('mousedown', startDrag);
    element.addEventListener('touchstart', startDrag, { passive: true });
}

function moveActiveElement(e) {
    if (!activeElement) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - startX;
    const y = clientY - startY;

    activeElement.style.left = `${x}px`;
    activeElement.style.top = `${y}px`;
}

function stopActiveElement() {
    activeElement = null;
}

document.addEventListener('mousemove', moveActiveElement);
document.addEventListener('mouseup', stopActiveElement);

document.addEventListener('touchmove', moveActiveElement, { passive: true });
document.addEventListener('touchend', stopActiveElement);

function injectCanvasNode(htmlContent) {
    saveCanvasState(); // Save state before inserting new element
    
    const card = document.createElement('div');
    card.className = 'canvas-direct-element';
    card.style.left = `${Math.floor(Math.random() * 60) + 30}px`;
    card.style.top = `${Math.floor(Math.random() * 60) + 40}px`;
    card.style.zIndex = ++CanvasZIndexCounter;
    card.style.position = 'absolute';
    card.style.width = '240px';

    card.innerHTML = htmlContent;

    const delBtn = document.createElement('button');
    delBtn.className = 'element-delete-btn';
    delBtn.innerHTML = '&times;';
    delBtn.onclick = () => {
        saveCanvasState();
        card.remove();
    };
    card.appendChild(delBtn);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'element-resize-handle';
    resizeHandle.title = 'Drag to Resize';
    
    let isResizing = false;
    let initialWidth, initialHeight, initialX, initialY;

    const startResize = (e) => {
        e.stopPropagation();
        saveCanvasState();
        isResizing = true;
        initialWidth = card.offsetWidth;
        initialHeight = card.offsetHeight;
        initialX = e.touches ? e.touches[0].clientX : e.clientX;
        initialY = e.touches ? e.touches[0].clientY : e.clientY;

        const onMove = (moveEvent) => {
            if (!isResizing) return;
            const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const newWidth = Math.max(80, initialWidth + (currentX - initialX));
            const newHeight = Math.max(30, initialHeight + (currentY - initialY));
            
            card.style.width = `${newWidth}px`;
            card.style.height = `${newHeight}px`;

            const imageWrapper = card.querySelector('.resizable-image-wrapper');
            if (imageWrapper) {
                imageWrapper.style.width = '100%';
                imageWrapper.style.height = '100%';
            }

            const textWrapper = card.querySelector('.rich-text-wrapper');
            if (textWrapper) textWrapper.style.width = '100%';

            const shapeTarget = card.querySelector('.vector-shape-element');
            if (shapeTarget) {
                shapeTarget.style.width = '100%';
                shapeTarget.style.height = `${Math.max(30, newHeight - 10)}px`;
            }

            const lineTarget = card.querySelector('.custom-line-wrapper');
            if (lineTarget) {
                lineTarget.style.width = '100%';
                lineTarget.style.height = `${Math.max(15, newHeight - 10)}px`;
            }
        };

        const onEnd = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onEnd);
    };

    resizeHandle.addEventListener('mousedown', startResize);
    resizeHandle.addEventListener('touchstart', startResize, { passive: true });

    card.appendChild(resizeHandle);
    if (universe) universe.appendChild(card);
    makeElementInteractive(card);
}

function formatDoc(btnElement, cmd, value = null) {
    if (btnElement && btnElement.closest) {
        const wrapper = btnElement.closest('.rich-text-wrapper, .vector-shape-element');
        if (wrapper) {
            const editor = wrapper.querySelector('.docs-editable-editor, .shape-editable-text');
            if (editor) editor.focus();
        }
    }
    document.execCommand(cmd, false, value);
}

function changeFontSizePx(selectEl, sizeVal) {
    const wrapper = selectEl.closest('.rich-text-wrapper');
    const editor = wrapper ? wrapper.querySelector('.docs-editable-editor') : null;
    if (editor) {
        editor.focus();
        editor.style.fontSize = sizeVal;
    }
}

function applyTextStyle(selectEl, tag) {
    const wrapper = selectEl.closest('.rich-text-wrapper');
    const editor = wrapper ? wrapper.querySelector('.docs-editable-editor') : null;
    if (editor) {
        editor.focus();
        document.execCommand('formatBlock', false, `<${tag}>`);
    }
}

function insertEmoji(selectEl, emojiChar) {
    if (!emojiChar) return;
    formatDoc(selectEl, 'insertText', emojiChar);
    selectEl.value = "";
}

function createRichTextNode() {
    const html = `
        <div class="rich-text-wrapper" style="display: flex; flex-direction: column; gap: 4px; padding: 2px; background: transparent; border: none; box-shadow: none; width: 100%; box-sizing: border-box;">
            <div class="docs-toolbar" style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap; padding: 4px; border-bottom: 1px solid #e2e8f0; background: #ffffff; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                
                <select onchange="applyTextStyle(this, this.value)" style="font-size:10px; padding:2px;" title="Text Style">
                    <option value="p">Normal text</option>
                    <option value="h1">Title</option>
                    <option value="h2">Subtitle</option>
                    <option value="h3">Heading 1</option>
                </select>

                <select onchange="applyFontFamily(this, this.value)" style="font-size:10px; padding:2px; max-width:110px;" title="Font Family">
                    <optgroup label="Handwriting / Cursive">
                        <option value="Caveat, cursive" selected>Caveat</option>
                        <option value="Pacifico, cursive">Pacifico</option>
                        <option value="Dancing Script, cursive">Dancing Script</option>
                        <option value="Great Vibes, cursive">Great Vibes</option>
                        <option value="Permanent Marker, cursive">Marker</option>
                        <option value="Sacramento, cursive">Sacramento</option>
                        <option value="Shadows Into Light, cursive">Shadows</option>
                        <option value="Amatic SC, cursive">Amatic SC</option>
                    </optgroup>
                    <optgroup label="Sans-Serif">
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Inter, sans-serif">Inter</option>
                        <option value="Roboto, sans-serif">Roboto</option>
                        <option value="Open Sans, sans-serif">Open Sans</option>
                        <option value="Montserrat, sans-serif">Montserrat</option>
                    </optgroup>
                    <optgroup label="Serif">
                        <option value="Times New Roman, serif">Times New Roman</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Playfair Display, serif">Playfair</option>
                        <option value="Lora, serif">Lora</option>
                    </optgroup>
                    <optgroup label="Display / Monospace">
                        <option value="Oswald, sans-serif">Oswald</option>
                        <option value="Courier Prime, monospace">Courier Prime</option>
                        <option value="Fira Code, monospace">Fira Code</option>
                        <option value="Roboto Mono, monospace">Roboto Mono</option>
                    </optgroup>
                </select>

                <select onchange="changeFontSizePx(this, this.value)" style="font-size:10px; padding:2px;" title="Font Size">
                    <option value="12px">12</option>
                    <option value="16px">16</option>
                    <option value="18px">18</option>
                    <option value="22px" selected>22</option>
                    <option value="28px">28</option>
                    <option value="36px">36</option>
                    <option value="48px">48</option>
                </select>

                <select onchange="insertEmoji(this, this.value)" style="font-size:10px; padding:2px; width:45px;" title="Insert Emoji">
                    <option value="">😀</option>
                    <option value="❤️">❤️ Heart</option>
                    <option value="✨">✨ Sparkles</option>
                    <option value="🔥">🔥 Fire</option>
                    <option value="✏️">✏️ Pencil</option>
                    <option value="💭">💭 Thought</option>
                    <option value="💡">💡 Idea</option>
                    <option value="🌿">🌿 Nature</option>
                    <option value="⭐">⭐ Star</option>
                    <option value="🌙">🌙 Moon</option>
                    <option value="☁️">☁️ Cloud</option>
                    <option value="📌">📌 Pin</option>
                    <option value="🎉">🎉 Party</option>
                    <option value="🎯">🎯 Target</option>
                    <option value="👀">👀 Eyes</option>
                    <option value="💯">💯 100</option>
                    <option value="🙏">🙏 Folded Hands</option>
                </select>

                <button type="button" onmousedown="event.preventDefault()" onclick="formatDoc(this, 'bold')" style="font-weight:bold; font-size:11px; padding:2px 5px; cursor:pointer;" title="Bold">B</button>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatDoc(this, 'italic')" style="font-style:italic; font-size:11px; padding:2px 5px; cursor:pointer;" title="Italic">I</button>
                <button type="button" onmousedown="event.preventDefault()" onclick="formatDoc(this, 'underline')" style="text-decoration:underline; font-size:11px; padding:2px 5px; cursor:pointer;" title="Underline">U</button>

                <input type="color" value="#1c1917" onchange="formatDoc(this, 'foreColor', this.value)" style="width:16px; height:16px; border:none; background:none; cursor:pointer;" title="Text Color">
                <input type="color" value="#fef08a" onchange="formatDoc(this, 'hiliteColor', this.value)" style="width:16px; height:16px; border:none; background:none; cursor:pointer;" title="Highlight Color">
            </div>

            <div class="docs-editable-editor" contenteditable="true" style="width: 100%; min-height: 40px; padding: 4px; outline: none; font-family: Caveat, cursive; font-size: 22px; color: #1c1917; background: transparent; overflow-wrap: anywhere; word-break: break-word; white-space: pre-wrap;">Type text here...</div>
        </div>
    `;
    injectCanvasNode(html);
}

function createShapeNode() {
    const shapeId = 'shape-' + Date.now();
    const html = `
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; width: 100%; box-sizing: border-box;">
            <div id="${shapeId}" class="vector-shape-element" style="width: 100%; min-height: 100px; background-color: transparent; border: 2px solid #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 12px; box-sizing: border-box; overflow: hidden; position: relative;">
                <div class="shape-editable-text" contenteditable="true" style="outline: none; text-align: center; font-family: 'Caveat', cursive; font-size: 20px; color: #1c1917; width: 100%; max-height: 100%; overflow-y: auto; overflow-wrap: anywhere; word-break: break-word; white-space: pre-wrap;">Text inside shape...</div>
            </div>
            
            <div style="display: flex; gap: 4px; align-items: center; background: #ffffff; padding: 3px 6px; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">
                <select onchange="applyShapeType('${shapeId}', this.value)" style="font-size:10px; padding:2px;">
                    <option value="box">Box Frame</option>
                    <option value="rounded">Rounded Box</option>
                    <option value="circle">Circle</option>
                    <option value="cloud">Cloud / Bubble</option>
                </select>
                <input type="color" value="#6366f1" onchange="document.getElementById('${shapeId}').style.borderColor = this.value;" style="width:16px; height:16px; border:none; background:none; cursor:pointer;" title="Shape Color">
            </div>
        </div>
    `;
    injectCanvasNode(html);
}

function applyShapeType(elementId, shapeType) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (shapeType === 'box') {
        el.style.borderRadius = '0px';
        el.style.padding = '12px';
    } else if (shapeType === 'rounded') {
        el.style.borderRadius = '14px';
        el.style.padding = '12px';
    } else if (shapeType === 'circle') {
        el.style.borderRadius = '50%';
        el.style.padding = '18% 14%';
    } else if (shapeType === 'cloud') {
        el.style.borderRadius = '32px';
        el.style.padding = '16px 20px';
    }
}

function createLineNode() {
    const lineId = 'line-' + Date.now();
    const html = `
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; padding: 4px; width: 100%; box-sizing: border-box;">
            <div id="${lineId}" class="custom-line-wrapper" style="width: 100%; height: 30px; display: flex; align-items: center; justify-content: center; transform-origin: center;">
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
                    <path id="${lineId}-path" d="M 0 50 L 100 50" stroke="#4338ca" stroke-width="4" stroke-linecap="round" vector-effect="non-scaling-stroke" />
                </svg>
            </div>
            
            <div class="line-control-panel" style="display: flex; gap: 4px; align-items: center; background: rgba(255,255,255,0.92); padding: 4px; border-radius: 6px; border: 1px solid #cbd5e1; flex-wrap: wrap;">
                <select onchange="updateLinePath('${lineId}', this.value)" style="font-size:10px; padding:2px;" title="Line Type">
                    <option value="horizontal">Horizontal Line</option>
                    <option value="vertical">Vertical Line</option>
                    <option value="curved">Curved Arc</option>
                    <option value="arrow">Arrow Line</option>
                </select>

                <select onchange="document.getElementById('${lineId}-path').setAttribute('stroke-width', this.value)" style="font-size:10px; padding:2px;" title="Thickness">
                    <option value="2">Thin (2px)</option>
                    <option value="4" selected>Medium (4px)</option>
                    <option value="8">Thick (8px)</option>
                </select>

                <input type="range" min="0" max="360" value="0" oninput="document.getElementById('${lineId}').style.transform = 'rotate(' + this.value + 'deg)'" style="width:45px;" title="Rotate Angle">
                <input type="color" value="#4338ca" onchange="document.getElementById('${lineId}-path').setAttribute('stroke', this.value)" style="width:16px; height:16px; border:none; background:none; cursor:pointer;" title="Line Color">
            </div>
        </div>
    `;
    injectCanvasNode(html);
}

function updateLinePath(lineId, styleType) {
    const path = document.getElementById(`${lineId}-path`);
    if (!path) return;

    if (styleType === 'horizontal') path.setAttribute('d', 'M 0 50 L 100 50');
    else if (styleType === 'vertical') path.setAttribute('d', 'M 50 0 L 50 100');
    else if (styleType === 'curved') path.setAttribute('d', 'M 0 80 Q 50 0 100 80');
    else if (styleType === 'arrow') path.setAttribute('d', 'M 0 50 L 92 50 M 80 35 L 98 50 L 80 65');
}

function triggerAssetUpload(mime) {
    if (!assetGate) return;
    assetGate.accept = mime;
    targetUploadType = mime;
    
    if (mime.includes('image')) {
        assetGate.setAttribute('multiple', 'true');
    } else {
        assetGate.removeAttribute('multiple');
    }
    assetGate.click();
}

function handleAssetCapture(event) {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    if (targetUploadType.includes('image')) {
        const newBatchSizeMB = files.reduce((acc, file) => acc + (file.size / (1024 * 1024)), 0);

        if (totalUploadedImageSizeMB + newBatchSizeMB > 25) {
            const remainingMB = Math.max(0, 25 - totalUploadedImageSizeMB).toFixed(2);
            alert(`Upload rejected! Image limit is 25MB total across all images.\n\nCurrently Used: ${totalUploadedImageSizeMB.toFixed(2)} MB\nRemaining Space: ${remainingMB} MB\nAttempted Upload: ${newBatchSizeMB.toFixed(2)} MB`);
            assetGate.value = '';
            return;
        }

        let createCollage = false;
        if (files.length > 1) {
            createCollage = confirm(`You selected ${files.length} images.\n\nClick "OK" to insert as a unified Collage Grid.\nClick "Cancel" to insert as individual draggable images.`);
        }

        const uploadPromises = files.map(file => {
            const formData = new FormData();
            formData.append('file', file);
            return fetch('/api/upload', { method: 'POST', body: formData })
                .then(res => res.json())
                .then(data => data.url || URL.createObjectURL(file))
                .catch(() => URL.createObjectURL(file));
        });

        Promise.all(uploadPromises).then(imageUrls => {
            if (createCollage) {
                let collageGridHTML = `<div class="resizable-image-wrapper" style="width: 100%; height: 100%; display: grid; grid-template-columns: repeat(${Math.min(imageUrls.length, 3)}, 1fr); gap: 4px; padding: 4px; background: transparent; border-radius: 8px;">`;
                imageUrls.forEach(url => {
                    collageGridHTML += `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; display: block; pointer-events: none;">`;
                });
                collageGridHTML += `</div>`;
                injectCanvasNode(collageGridHTML);
            } else {
                imageUrls.forEach(url => {
                    injectCanvasNode(`
                        <div class="resizable-image-wrapper" style="width: 100%; height: 100%; display: flex;">
                            <img src="${url}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 6px; display: block; pointer-events: none;">
                        </div>
                    `);
                });
            }
            totalUploadedImageSizeMB += newBatchSizeMB;
        });

    } else if (targetUploadType.includes('video')) {
        const file = files[0];
        if (file.size / (1024 * 1024) > 10) { alert("Video capped at 10MB (30s max limit)."); return; }
        
        const formData = new FormData();
        formData.append('file', file);
        fetch('/api/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                const src = data.url || URL.createObjectURL(file);
                const fileType = file.type || 'video/mp4';
                injectCanvasNode(`
                    <div class="resizable-media-wrapper" style="width: 100%; height: 100%; position: relative;">
                        <video controls playsinline webkit-playsinline preload="metadata" style="width: 100%; height: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); object-fit: cover;">
                            <source src="${src}" type="${fileType}">
                            <source src="${src}" type="video/mp4">
                            Your browser does not support this video format.
                        </video>
                    </div>
                `);
            });

    } else if (targetUploadType.includes('audio')) {
        const file = files[0];
        const formData = new FormData();
        formData.append('file', file);
        fetch('/api/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                const src = data.url || URL.createObjectURL(file);
                injectCanvasNode(`
                    <div class="clean-audio-wrapper" style="width: 100%; position: relative; background: #ffffff; padding: 6px; border-radius: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div class="audio-drag-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 5; cursor: move;"></div>
                        <audio src="${src}" controls playsinline webkit-playsinline style="width: 100%; height: 40px; display: block; position: relative; z-index: 1; border-radius: 30px; touch-action: auto;"></audio>
                    </div>
                `);
            });

    } else {
        const file = files[0];
        const formData = new FormData();
        formData.append('file', file);
        fetch('/api/upload', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                const src = data.url || URL.createObjectURL(file);
                injectCanvasNode(`
                    <div class="resizable-file-wrapper" style="padding: 8px 12px; display: flex; align-items: center; gap: 8px; width: 100%; background: #ffffff; border: 1px solid #d6d3d1; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                        <span style="font-size: 20px;">📄</span>
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                            <a href="${src}" target="_blank" style="font-size: 12px; color: #2563eb; font-weight: 700;">${file.name}</a>
                            <span style="display: block; font-size: 10px; color: #78716c;">${(file.size / (1024*1024)).toFixed(2)} MB</span>
                        </div>
                    </div>
                `);
            });
    }

    assetGate.value = '';
}

function toggleLike(btn, postId) {
    btn.classList.toggle('liked');
    const countSpan = btn.querySelector('.like-count');
    let count = parseInt(countSpan.innerText) || 0;
    
    if (btn.classList.contains('liked')) {
        countSpan.innerText = count + 1;
        if (postId) fetch(`/api/posts/${postId}/like`, { method: 'POST' });
    } else {
        countSpan.innerText = Math.max(0, count - 1);
    }
}

function sharePost() {
    alert('Post link copied to clipboard!');
}

// 5. PUBLISH CANVAS DIRECT TO FEED (SAFE EXECUTION ENGINE)
function publishCanvasToFeed() {
    const universeElement = document.getElementById('canvas-universe');
    if (!universeElement) {
        alert("Error: Workspace canvas not found!");
        return;
    }

    const directElements = universeElement.querySelectorAll('.canvas-direct-element');
    const sketchPad = document.getElementById('sketch-pad');
    const doodleContext = sketchPad ? sketchPad.getContext('2d') : null;
    
    const doodleDataUrl = sketchPad ? sketchPad.toDataURL() : null;
    const hasDoodles = doodleContext ? doodleContext.getImageData(0, 0, sketchPad.width, sketchPad.height).data.some(channel => channel !== 0) : false;

    if (directElements.length === 0 && !hasDoodles) {
        alert("Please add text, shapes, doodles, or files before sharing!");
        return;
    }

    const currentStudioWidth = universeElement.clientWidth || 360;
    const currentStudioHeight = universeElement.clientHeight || 500;
    
    const VIRTUAL_BASE_WIDTH = 1000;
    const deviceRatio = VIRTUAL_BASE_WIDTH / currentStudioWidth;

    let maxBottomPx = 400;
    let compositeElementsHTML = '';

    directElements.forEach(element => {
        const clone = element.cloneNode(true);

        // Strip editor toolbars & drag overlays (Preserving <audio> tag)
        clone.querySelectorAll('.docs-toolbar, .element-delete-btn, .element-resize-handle, select, input, button, .line-control-panel, .floating-editor-tools, .media-drag-header, .audio-drag-overlay').forEach(ui => ui.remove());

        clone.querySelectorAll('[contenteditable="true"]').forEach(editable => {
            editable.removeAttribute('contenteditable');
            editable.style.outline = 'none';
        });

        const leftStyle = element.style.left || '';
        const topStyle = element.style.top || '';
        const widthStyle = element.style.width || '';
        const heightStyle = element.style.height || '';

        let rawLeft = parseFloat(leftStyle);
        if (isNaN(rawLeft)) rawLeft = element.offsetLeft || 0;
        if (leftStyle.includes('%')) rawLeft = (rawLeft / 100) * currentStudioWidth;

        let rawTop = parseFloat(topStyle);
        if (isNaN(rawTop)) rawTop = element.offsetTop || 0;
        if (topStyle.includes('%')) rawTop = (rawTop / 100) * currentStudioHeight;

        let rawWidth = parseFloat(widthStyle);
        if (isNaN(rawWidth) || rawWidth <= 0) rawWidth = element.offsetWidth || 200;
        if (widthStyle.includes('%')) rawWidth = (rawWidth / 100) * currentStudioWidth;

        let rawHeight = parseFloat(heightStyle);
        if (isNaN(rawHeight) || rawHeight <= 0) rawHeight = element.offsetHeight || 100;
        if (heightStyle.includes('%')) rawHeight = (rawHeight / 100) * currentStudioHeight;

        const virtualLeft = rawLeft * deviceRatio;
        const virtualTop = rawTop * deviceRatio;
        const virtualWidth = rawWidth * deviceRatio;
        const virtualHeight = rawHeight * deviceRatio;

        if (virtualTop + virtualHeight > maxBottomPx) {
            maxBottomPx = virtualTop + virtualHeight + 40;
        }

        clone.style.position = 'absolute';
        clone.style.left = `${virtualLeft}px`;
        clone.style.top = `${virtualTop}px`;
        clone.style.width = `${virtualWidth}px`;
        clone.style.height = `${virtualHeight}px`;
        clone.style.zIndex = element.style.zIndex || 10;
        if (element.style.transform) clone.style.transform = element.style.transform;
        
        clone.querySelectorAll('video, audio').forEach(media => {
            media.setAttribute('playsinline', 'true');
            media.setAttribute('webkit-playsinline', 'true');
            media.setAttribute('controls', 'true');
            media.style.pointerEvents = 'auto';
            media.style.touchAction = 'manipulation';
            media.style.display = 'block';
        });

        const audioWrapper = clone.querySelector('.clean-audio-wrapper');
        if (audioWrapper) {
            audioWrapper.style.pointerEvents = 'auto';
        }

        clone.style.pointerEvents = 'auto';
        compositeElementsHTML += clone.outerHTML;
    });

    const now = new Date();
    const formattedTimestamp = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isHiGreeting = localStorage.getItem("ss_display_greeting") === "true";
    const name = localStorage.getItem("ss_name") || "User";
    const handle = localStorage.getItem("ss_handle") || "@username";
    const activeUser = isHiGreeting ? `Hi, ${name.split(' ')[0]}` : handle;

    const payload = {
        author: activeUser,
        avatar_initials: name.substring(0, 2).toUpperCase(),
        formatted_date: formattedTimestamp,
        bg_color: currentCanvasBgColor || '#ffffff',
        doodle_layer: hasDoodles ? doodleDataUrl : null,
        html_content: compositeElementsHTML,
        canvas_width: VIRTUAL_BASE_WIDTH,
        canvas_height: Math.max(500, maxBottomPx)
    };

    fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            toggleCanvasOverlay(false);
            loadGlobalFeedFromBackend();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert("Error publishing post: " + (data.message || "Failed to save post."));
        }
    })
    .catch(err => {
        console.error("Error publishing post:", err);
        alert("Failed to reach server. Please check your network connection.");
    });
}

function applyFontFamily(selectEl, fontFamilyValue) {
    if (!fontFamilyValue) return;
    
    const wrapper = selectEl.closest('.rich-text-wrapper');
    const editor = wrapper ? wrapper.querySelector('.docs-editable-editor') : null;
    
    if (editor) {
        editor.focus();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            document.execCommand('fontName', false, fontFamilyValue);
        } else {
            editor.style.fontFamily = fontFamilyValue;
        }
    }
}
