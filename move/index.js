
// Sample text to display; you can replace this with any text content
const sampleText = `

Saturday, February 14
* Meet Me in Paris: A Clandestine Cabaret, Brooklyn
* Rubulad’s for Lovers, Brooklyn
* Besos, Bromas y Breakups, Manhattan
* Valentine's Day Garbage and Rats in NYC Walking Tour, Manhattan
* The Trash King: A Valentine's Day Spectacular, Manhattan
* Verse4Verse, Queens
* Draw-a-Clown, Brooklyn
* Annual PALentine's Day Party, Queens
* For Your Ears Only: Valentine's Day Dance Party, Brooklyn
* Plus 1s Sketch Comedy Matinée, Manhattan
* Str8 to DVD: Psychic Polycule, Brooklyn
* Punk Rope, Manhattan
* Live at the Inn! Valentine's Day Special, Manhattan
* Smells Like Love, Manhattan


`;

// Blink-detection + progressive masking implementation

const videoEl = document.getElementById('video');
const textEl = document.getElementById('text');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');

let faceMesh = null;
let camera = null;
let reading = false;
let blinkCount = 0;
let maskedIndices = new Set();
const maskChar = '▯';

// Per-character deformation state (persistent)
let charStates = [];
let charBase = [];
// Sound detection state
let audioContext = null;
let analyser = null;
let microphone = null;
let speaking = false;
let speakerCount = 0;
let popupShown = false;
const popupLinks = [
    // Add image popups
    { url: '../images/meme1.jpg', text: 'COME ON', type: 'image' },
    { url: 'https://www.amazon.com/', text: 'Shop Now', type: 'link' },
    { url: '../images/meme2.jpg', text: 'Do not stop', type: 'image' },
    { url: 'https://www.youtube.com/', text: 'Watch Videos', type: 'link' },
    { url: '../images/meme3.jpg', text: 'Look at meme', type: 'image' },
    { url: 'https://www.tiktok.com/', text: 'TikTok Fun', type: 'link' },
    { url: 'https://www.ebay.com/', text: 'Deals on eBay', type: 'link' },
];
let charRects = [];
const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, moved: false, active: false };

// interaction parameters (tweak for desired feel)
const interactionRadius = 140; // px
const interactionStrength = 2.2;
const damping = 0.9;
const spring = 0.08;
const captureStrength = 0.2; // how much of transient motion is captured per frame
const perpFlow = 0.9; // perpendicular flow multiplier


// Prepare text as spans so individual characters can be masked
let chars = [];
function renderText() {
    textEl.innerHTML = '';
    chars = sampleText.split('');
    chars.forEach((ch, i) => {
        const span = document.createElement('span');
        span.dataset.index = i;
        span.classList.add('char');
        span.textContent = ch;
        if (ch === '\n') {
            span.style.display = 'block';
        }
        if (ch.trim() === '') {
            span.classList.add('whitespace');
        }
        textEl.appendChild(span);
    });
    // initialize measurement and state on next frame
    requestAnimationFrame(initCharStates);
}

function initCharStates() {
    const spans = Array.from(textEl.querySelectorAll('span'));
    // preserve existing base offsets and transient states if available
    const prevBase = charBase.slice();
    const prevStates = charStates.slice();

    // measure client rects
    charRects = spans.map(s => {
        const r = s.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
    });

    // ensure arrays cover all chars
    charBase = spans.map((s, i) => prevBase[i] || { bx: 0, by: 0 });
    charStates = spans.map((s, i) => prevStates[i] || { x: 0, y: 0, vx: 0, vy: 0 });
}

function getMaskableIndices() {
    const indices = [];
    chars.forEach((ch, i) => {
        if (ch.trim() !== '') indices.push(i);
    });
    return indices;
}

function applyMasking() {
    const maskable = getMaskableIndices();
    const total = maskable.length;
    // Each blink increases masked fraction (5% per blink, cap at 100%)
    const fraction = Math.min(1, blinkCount * 0.05);
    const toMask = Math.floor(total * fraction);

    // choose random indices to mask (but keep previously masked)
    while (maskedIndices.size < toMask) {
        const idx = maskable[Math.floor(Math.random() * maskable.length)];
        maskedIndices.add(idx);
    }

    // Update spans: apply masked class which draws a solid square
    const spans = textEl.querySelectorAll('span');
    spans.forEach((s) => {
        const i = Number(s.dataset.index);
        if (maskedIndices.has(i)) {
            // preserve transient displacement into base so masking doesn't reset deformation
            if (charStates[i] && charBase[i]) {
                charBase[i].bx += charStates[i].x * 0.6;
                charBase[i].by += charStates[i].y * 0.6;
                charStates[i].x *= 0.4; charStates[i].y *= 0.4;
            }
            // lock width to avoid reflow when replacing character with block
            const center = charRects[i];
            if (center && center.w) {
                s.style.width = center.w + 'px';
                s.style.display = 'inline-block';
            }
            s.classList.add('masked');
            s.textContent = '\u00A0';
        }
    });
}
// recompute measurements next frame in case sizes changed
requestAnimationFrame(initCharStates);

renderText();

// mouse interaction handlers
textEl.addEventListener('mouseenter', () => { mouse.active = true; });
textEl.addEventListener('mouseleave', () => { mouse.active = false; });
textEl.addEventListener('mousemove', (e) => {
    mouse.px = mouse.x; mouse.py = mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.moved = true;
});

function animateChars() {
    const spans = Array.from(textEl.querySelectorAll('span'));
    if (!charRects || charRects.length === 0) {
        requestAnimationFrame(animateChars);
        return;
    }

    // Sound detection: adjust font size based on volume
    if (analyser && microphone && reading) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        // Estimate speaker count (simple threshold logic)
        if (avg > 30) {
            speaking = true;
            // If volume is very high, assume multiple speakers
            speakerCount = avg > 80 ? 2 : 1;
        } else {
            speaking = false;
            speakerCount = 0;
        }
        // Font size scaling
        if (speaking && speakerCount === 1) {
            textEl.style.fontSize = (18 + avg / 3) + 'px';
        } else {
            textEl.style.fontSize = '18px';
        }
        // Pop-up for multiple speakers
        if (speakerCount > 1 && !popupShown) {
            showPopup();
        }
    }
    // apply mouse influence when moved
    if (mouse.moved && mouse.active) {
        const mvx = mouse.x - mouse.px;
        const mvy = mouse.y - mouse.py;
        for (let i = 0; i < charStates.length; i++) {
            const rect = charRects[i];
            if (!rect) continue;
            const base = charBase[i] || { bx: 0, by: 0 };
            const st = charStates[i];
            const curX = rect.cx + base.bx + st.x;
            const curY = rect.cy + base.by + st.y;
            const dx = curX - mouse.x;
            const dy = curY - mouse.y;
            const d = Math.hypot(dx, dy);
            if (d < interactionRadius) {
                const influence = (1 - d / interactionRadius);
                // perpendicular flow to mouse movement
                const perpX = -mvy * perpFlow;
                const perpY = mvx * perpFlow;
                const plen = Math.hypot(perpX, perpY) || 1;
                const nx = perpX / plen;
                const ny = perpY / plen;
                st.vx += nx * interactionStrength * influence;
                st.vy += ny * interactionStrength * influence;
                // radial push away from pointer
                const rx = dx, ry = dy; const rlen = Math.hypot(rx, ry) || 1;
                st.vx += (rx / rlen) * (interactionStrength * 0.3) * influence;
                st.vy += (ry / rlen) * (interactionStrength * 0.3) * influence;
                // gradually capture small portion into base offset
                const capX = st.x * captureStrength * influence * 0.02;
                const capY = st.y * captureStrength * influence * 0.02;
                charBase[i].bx += capX;
                charBase[i].by += capY;
            }
        }
        mouse.moved = false;
    }

    // integrate physics
    for (let i = 0; i < charStates.length; i++) {
        const st = charStates[i];
        // spring back small toward zero transient displacement
        st.vx += -st.x * spring;
        st.vy += -st.y * spring;
        st.vx *= damping; st.vy *= damping;
        st.x += st.vx; st.y += st.vy;
        const base = charBase[i] || { bx: 0, by: 0 };
        const s = spans[i];
        if (s) {
            s.style.transform = `translate(${base.bx + st.x}px, ${base.by + st.y}px)`;
            const mag = Math.hypot(base.bx + st.x, base.by + st.y);
            if (mag > 6) s.classList.add('moving'); else s.classList.remove('moving');
        }
    }

    requestAnimationFrame(animateChars);
}

requestAnimationFrame(animateChars);

// Pop-up window logic
function showPopup() {
    popupShown = true;
    // Show pop-ups in batches at random positions
    const batchSize = 2; // Number of pop-ups per batch
    let batchIndex = 0;
    function openBatch() {
        const links = popupLinks.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
        links.forEach(link => {
            // Random position within viewport
            const left = Math.floor(Math.random() * (window.innerWidth - 600));
            const top = Math.floor(Math.random() * (window.innerHeight - 400));
            const features = `width=600,height=400,left=${left},top=${top}`;
            if (link.type === 'link') {
                window.open(link.url, '_blank', features);
            } else if (link.type === 'image') {
                // Open a new window and write an <img> tag
                const imgWin = window.open('', '_blank', features);
                if (imgWin) {
                    imgWin.document.write(`<!DOCTYPE html><html><head><title>${link.text}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;background:#222;"><img src="${link.url}" alt="${link.text}" style="max-width:100%;max-height:100%;border-radius:12px;box-shadow:0 4px 24px #000;" /></body></html>`);
                }
            }
        });
        batchIndex++;
        if (batchIndex * batchSize < popupLinks.length) {
            setTimeout(openBatch, 1200); // Delay between batches
        } else {
            setTimeout(() => { popupShown = false; }, 5000);
        }
    }
    openBatch();
}

// Geometry helpers
function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
}

// Eye landmark groups for MediaPipe FaceMesh
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function eyeAspectRatio(landmarks, eyeIndices) {
    const p0 = landmarks[eyeIndices[0]];
    const p1 = landmarks[eyeIndices[1]];
    const p2 = landmarks[eyeIndices[2]];
    const p3 = landmarks[eyeIndices[3]];
    const p4 = landmarks[eyeIndices[4]];
    const p5 = landmarks[eyeIndices[5]];

    const vert1 = dist(p1, p5);
    const vert2 = dist(p2, p4);
    const hor = dist(p0, p3) || 1e-6;
    return (vert1 + vert2) / (2.0 * hor);
}

// Blink detection state
let closed = false;
let lastBlinkTime = 0;
const closedThreshold = 0.22;
const openThreshold = 0.27;

function onResults(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;
    const landmarks = results.multiFaceLandmarks[0];

    const leftEAR = eyeAspectRatio(landmarks, LEFT_EYE);
    const rightEAR = eyeAspectRatio(landmarks, RIGHT_EYE);
    const ear = (leftEAR + rightEAR) / 2;

    const now = performance.now();

    if (ear < closedThreshold && !closed) {
        closed = true;
    }
    if (ear > openThreshold && closed) {
        closed = false;
        if (now - lastBlinkTime > 150) {
            lastBlinkTime = now;
            blinkCount += 1;
            applyMasking();
            const maskable = getMaskableIndices();
            if (maskedIndices.size >= maskable.length) {
                statusEl.textContent = 'Unreadable';
            }
        }
    }
}

// Initialize MediaPipe FaceMesh
function initFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });
    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    faceMesh.onResults(onResults);
}

function startCamera() {
    if (!faceMesh) initFaceMesh();
    camera = new Camera(videoEl, {
        onFrame: async () => {
            await faceMesh.send({ image: videoEl });
        },
        width: 640,
        height: 480
    });
    camera.start();
}

// Start audio detection
function startAudioDetection() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        microphone.connect(analyser);
    }).catch(e => {
        console.error('Audio detection failed:', e);
    });
}

function stopAudioDetection() {
    if (audioContext) {
        audioContext.close();
        audioContext = null;
        analyser = null;
        microphone = null;
    }
}

function stopCamera() {
    try {
        if (camera && camera.stop) camera.stop();
    } catch (e) { }
}

startBtn.addEventListener('click', () => {
    if (!reading) {
        reading = true;
        startBtn.textContent = 'Stop Reading';
        statusEl.textContent = 'Reading...';
        maskedIndices.clear();
        blinkCount = 0;
        renderText();
        // hide the camera preview while the reading session runs
        if (videoEl) videoEl.style.display = 'none';
        startCamera();
        startAudioDetection();
    } else {
        reading = false;
        startBtn.textContent = 'Reading Now';
        statusEl.textContent = 'Stop Reading';
        stopCamera();
        stopAudioDetection();
        if (videoEl) videoEl.style.display = '';
    }
});




