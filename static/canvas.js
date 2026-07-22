// ============================================================
// GLOBAL STATE & FLASK API INTEGRATION
// ============================================================
let totalUploadedImageSizeMB = 0;
let currentLoginMethod = 'gmail';
let currentRegisterMethod = 'gmail';

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
            if (data.status === 'success' && data.posts) {
                timeline.innerHTML = ''; // Clear placeholder static content
                data.posts.forEach(post => renderPostToFeed(post));
            }
        })
        .catch(err => console.error("Error loading global feed:", err));
}

function renderPostToFeed(post) {
    const timeline = document.getElementById('timeline-feed');
    if (!timeline) return;

    // Fall back to sane defaults for posts saved before canvas_width/height existed
    const canvasWidth = post.canvas_width || 680;
    const canvasHeight = post.canvas_height || 400;

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

        <div class="post-canvas-content" style="background-color: ${post.bg_color || '#ffffff'}; display:block; padding:0; position: relative; width: 100%; aspect-ratio: ${canvasWidth} / ${canvasHeight}; overflow: hidden; border-radius: 12px; border: 1px solid #e5e0d8;">
            ${post.doodle_layer ? `<img src="${post.doodle_layer}" class="post-doodle-layer" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:1;">` : ''}
            <div class="post-2d-viewport" style="position: absolute; top: 0; left: 0; width: ${canvasWidth}px; height: ${canvasHeight}px; transform-origin: top left; z-index: 2;">
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

    // Scale the fixed-size (canvasWidth x canvasHeight) composite down to whatever
    // width the card actually renders at - uniformly, like shrinking a screenshot.
    // This is what keeps fonts/borders/padding proportional across screen sizes,
    // instead of the earlier percentage-per-element approach that let text overflow
    // its own box on narrower cards.
    const contentBox = article.querySelector('.post-canvas-content');
    const viewport = article.querySelector('.post-2d-viewport');
    if (contentBox && viewport) {
        const applyScale = () => {
            const scale = contentBox.clientWidth / canvasWidth;
            if (scale > 0 && isFinite(scale)) {
                viewport.style.transform = `scale(${scale})`;
            }
        };
        applyScale();
        if (window.ResizeObserver) {
            new ResizeObserver(applyScale).observe(contentBox);
        } else {
            window.addEventListener('resize', applyScale);
        }
    }
}

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
let currentTool = 'pen';
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

function toggleCanvasOverlay(shouldShow) {
    if (shouldShow) {
        overlay.classList.remove('hidden');
        totalUploadedImageSizeMB = 0; // Reset image quota for new post creation
        setTimeout(() => {
            initPad();
            clearDoodles();
            setDrawingTool('pen');
        }, 50);
        if (universe) universe.querySelectorAll('.canvas-direct-element').forEach(el => el.remove());
    } else {
        if (overlay) overlay.classList.add('hidden');
    }
}

function changeCanvasMoodColor(colorHex) {
    currentCanvasBgColor = colorHex;
    if (universe) universe.style.backgroundColor = colorHex;
}

function setDrawingTool(tool) {
    currentTool = tool;
    const penBtn = document.getElementById('pen-toggle-btn');
    const eraserBtn = document.getElementById('eraser-toggle-btn');

    if (penBtn) penBtn.classList.toggle('active', tool === 'pen');
    if (eraserBtn) eraserBtn.classList.toggle('active', tool === 'eraser');

    if (pad) pad.style.pointerEvents = "auto";
}

function clearDoodles() {
    if (ctx && pad) ctx.clearRect(0, 0, pad.width, pad.height);
}

// DRAWING LISTENERS
if (pad) {
    pad.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = pad.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });

    pad.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = pad.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.lineWidth = document.getElementById('pen-size').value;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (currentTool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = document.getElementById('pen-color').value;
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    });

    pad.addEventListener('mouseup', () => { isDrawing = false; ctx.beginPath(); });
    pad.addEventListener('mouseleave', () => { isDrawing = false; ctx.beginPath(); });
}

// DRAGGABLE & RESIZABLE ELEMENTS ENGINE
function makeElementInteractive(element) {
    element.addEventListener('mousedown', (e) => {
        if (e.target.closest('.element-delete-btn') || e.target.closest('.element-resize-handle') || ['INPUT', 'SELECT', 'A', 'VIDEO', 'AUDIO', 'BUTTON'].includes(e.target.tagName)) return;
        activeElement = element;
        startX = e.clientX - element.offsetLeft;
        startY = e.clientY - element.offsetTop;
        element.style.zIndex = ++CanvasZIndexCounter;
    });
}

document.addEventListener('mousemove', (e) => {
    if (!activeElement) return;
    activeElement.style.left = `${e.clientX - startX}px`;
    activeElement.style.top = `${e.clientY - startY}px`;
});

document.addEventListener('mouseup', () => { activeElement = null; });

function injectCanvasNode(htmlContent) {
    const card = document.createElement('div');
    card.className = 'canvas-direct-element';
    card.style.left = `${Math.floor(Math.random() * 80) + 40}px`;
    card.style.top = `${Math.floor(Math.random() * 80) + 60}px`;
    card.style.zIndex = ++CanvasZIndexCounter;
    card.style.position = 'absolute';
    card.style.width = '260px';

    card.innerHTML = htmlContent;

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'element-delete-btn';
    delBtn.innerHTML = '&times;';
    delBtn.onclick = () => card.remove();
    card.appendChild(delBtn);

    // Resize Handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'element-resize-handle';
    resizeHandle.title = 'Drag to Resize';
    
    let isResizing = false;
    let initialWidth, initialHeight, initialX, initialY;

    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        initialWidth = card.offsetWidth;
        initialHeight = card.offsetHeight;
        initialX = e.clientX;
        initialY = e.clientY;

        const onMouseMove = (moveEvent) => {
            if (!isResizing) return;
            const newWidth = Math.max(80, initialWidth + (moveEvent.clientX - initialX));
            const newHeight = Math.max(30, initialHeight + (moveEvent.clientY - initialY));
            
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

        const onMouseUp = () => {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    card.appendChild(resizeHandle);
    universe.appendChild(card);
    makeElementInteractive(card);
}

// FORMATTING & SELECTION PRESERVATION HELPERS
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

// 1. RICH TEXT BLOCK ENGINE (EXPANDED FONTS + EMOJI)
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

                <!-- EXPANDED FONT TYPOGRAPHY SUITE -->
                <select onchange="formatDoc(this, 'fontName', this.value)" style="font-size:10px; padding:2px; max-width:110px;" title="Font Family">
                    <optgroup label="Handwriting / Cursive">
                        <option value="'Caveat', cursive" selected>Caveat</option>
                        <option value="'Pacifico', cursive">Pacifico</option>
                        <option value="'Dancing Script', cursive">Dancing Script</option>
                        <option value="'Great Vibes', cursive">Great Vibes</option>
                        <option value="'Permanent Marker', cursive">Marker</option>
                        <option value="'Sacramento', cursive">Sacramento</option>
                        <option value="'Shadows Into Light', cursive">Shadows</option>
                        <option value="'Amatic SC', cursive">Amatic SC</option>
                    </optgroup>
                    <optgroup label="Sans-Serif">
                        <option value="Arial">Arial</option>
                        <option value="'Inter', sans-serif">Inter</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Open Sans', sans-serif">Open Sans</option>
                        <option value="'Montserrat', sans-serif">Montserrat</option>
                    </optgroup>
                    <optgroup label="Serif">
                        <option value="'Times New Roman', serif">Times New Roman</option>
                        <option value="'Georgia', serif">Georgia</option>
                        <option value="'Playfair Display', serif">Playfair</option>
                        <option value="'Lora', serif">Lora</option>
                    </optgroup>
                    <optgroup label="Display / Monospace">
                        <option value="'Oswald', sans-serif">Oswald</option>
                        <option value="'Courier Prime', monospace">Courier Prime</option>
                        <option value="'Fira Code', monospace">Fira Code</option>
                        <option value="'Roboto Mono', monospace">Roboto Mono</option>
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

                <!-- META EMOJI PICKER -->
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

            <div class="docs-editable-editor" contenteditable="true" style="width: 100%; min-height: 40px; padding: 4px; outline: none; font-family: 'Caveat', cursive; font-size: 22px; color: #1c1917; background: transparent; overflow-wrap: anywhere; word-break: break-word; white-space: pre-wrap;">Type text here...</div>
        </div>
    `;
    injectCanvasNode(html);
}

// 2. VECTOR SHAPES ENGINE WITH STRICT BOUNDS
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

// 3. LINES ENGINE WITH RESIZING
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

// 4. MEDIA ATTACHMENTS WITH CUMULATIVE 25MB LIMIT & FLASK UPLOAD
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

        // Enforce 25MB cumulative upload limit
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

        // Upload images to Flask backend storage
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
                injectCanvasNode(`<div style="width:100%; height:100%;"><video src="${src}" controls style="width:100%; height:100%; border-radius:6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"></video></div>`);
            });

    } else {
        const file = files[0];
        const src = URL.createObjectURL(file);
        injectCanvasNode(`
            <div style="padding:8px 12px; display:flex; align-items:center; gap:8px; width:220px; background: #ffffff; border: 1px solid #d6d3d1; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                <span style="font-size:20px;">📄</span>
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
                    <a href="${src}" download="${file.name}" style="font-size:12px; color:#2563eb; font-weight:700;">${file.name}</a>
                    <span style="display:block; font-size:10px; color:#78716c;">${(file.size / (1024*1024)).toFixed(2)} MB</span>
                </div>
            </div>
        `);
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

// 5. PUBLISH CANVAS TO FLASK SERVER
// PUBLISH CANVAS TO FLASK SERVER WITH RESPONSIVE PERCENTAGE LAYOUT
function publishCanvasToFeed() {
    const directElements = universe.querySelectorAll('.canvas-direct-element');
    const doodleDataUrl = pad ? pad.toDataURL() : null;
    const hasDoodles = ctx ? ctx.getImageData(0, 0, pad.width, pad.height).data.some(channel => channel !== 0) : false;

    if (directElements.length === 0 && !hasDoodles) {
        alert("Please add text, shapes, doodles, or files before sharing!");
        return;
    }

    // Capture the editor's exact pixel dimensions. The doodle layer (pad.width/height)
    // is drawn at this same size. Elements below keep their ORIGINAL pixel left/top/
    // width/height - the feed rebuilds this exact box, then uniformly scales the whole
    // thing down to fit the card (like shrinking a screenshot). That keeps fonts,
    // borders, and padding all proportional instead of text overflowing its box.
    const canvasWidth = universe.clientWidth || 680;
    const canvasHeight = universe.clientHeight || 400;

    let compositeElementsHTML = '';
    directElements.forEach(element => {
        const clone = element.cloneNode(true);

        // Remove interactive editor tools
        clone.querySelectorAll('.docs-toolbar, .element-delete-btn, .element-resize-handle, select, input, button, .line-control-panel, .floating-editor-tools').forEach(ui => ui.remove());

        clone.querySelectorAll('[contenteditable="true"]').forEach(editable => {
            editable.removeAttribute('contenteditable');
            editable.style.outline = 'none';
        });

        const leftPx = parseFloat(element.style.left) || 0;
        const topPx = parseFloat(element.style.top) || 0;
        const widthPx = parseFloat(element.style.width) || element.offsetWidth || 200;
        const heightPx = element.offsetHeight || 100;

        clone.style.position = 'absolute';
        clone.style.left = `${leftPx}px`;
        clone.style.top = `${topPx}px`;
        clone.style.width = `${widthPx}px`;
        clone.style.height = `${heightPx}px`;
        clone.style.zIndex = element.style.zIndex || 10;
        if (element.style.transform) clone.style.transform = element.style.transform;
        clone.style.pointerEvents = 'none';

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
        bg_color: currentCanvasBgColor,
        doodle_layer: hasDoodles ? doodleDataUrl : null,
        html_content: compositeElementsHTML,
        canvas_width: canvasWidth,
        canvas_height: canvasHeight
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
            alert("Error posting content.");
        }
    })
    .catch(err => console.error("Error publishing post:", err));
}
