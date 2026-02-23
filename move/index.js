
// Sample text to display; you can replace this with any text content
const sampleText = `


Yale Alert
WINTER SNOWSTORM - Yale Operations Update for Monday

To: manni.su@yale.edu
12:10 PM (12minutes ago)

This is a Yale ALERT. Today is 02-22-2026 at 15:09. 

To: Yale Community 

Governor Ned Lamont has declared a state of emergency in Connecticut in advance of the major winter storm expected to impact the state beginning Sunday evening, February 22, 2026, and continuing throughout the day on Monday, February 23, 2026. In addition, he has issued an emergency order prohibiting all commercial vehicles from traveling on limited-access highways statewide beginning at 5:00 p.m. on Sunday and remaining in effect until further notice.

As we continue to monitor conditions across the region and assess the potential impact on our campus community, we are writing to provide an update on Yale’s operations for Monday in light of the anticipated hazardous weather:

- There will be no in-person instruction on Monday. All courses that can be held remotely should be moved to an online format. We ask that faculty communicate directly with their students regarding the status and expectations for their courses.

- Yale shuttle service will be suspended until Tuesday morning at 6:00 a.m.

- Only essential staff who have been directed by their managers to report to campus should do so.

- Employees who are not essential should not come to campus. All employees should connect with their managers to confirm work arrangements. Those who are able to work remotely should do so.

As an academic and residential campus, Yale must continue to support teaching, learning, research, and patient care while maintaining critical operations. Public safety, dining, facilities, and other essential services will remain in place, supported by teams across the university working together to keep campus operating safely. We are grateful to the many staff members whose dedication ensures continuity of operations during weather events. We are also grateful to the faculty for providing continuity of educational, research and clinical missions despite the weather disruption. 

Please continue to monitor the Yale Status Board https://statusboard.apps.yale.edu/ for the most up-to-date information, including any changes to operations or transportation services.

Thank you for your flexibility and cooperation.

Best regards,
Scott Strobel
Provost and Henry Ford II Professor of Molecular Biophysics & Biochemistry
Yale University



`;

// Blink-detection + progressive masking implementation

const videoEl = document.getElementById('video');
let textEl = document.getElementById('text');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');

// Email interface state
let emails = [];
let currentEmailIndex = 0;

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
    // Build a two-column Outlook-like UI inside #container
    const container = document.getElementById('container');
    container.innerHTML = '';

    const left = document.createElement('div');
    left.id = 'emailList';
    left.style.width = '34%';
    left.style.maxWidth = '280px';
    left.style.overflowY = 'auto';
    left.style.borderRight = '1px solid #ddd';
    left.style.padding = '12px';

    const right = document.createElement('div');
    right.id = 'emailPane';
    right.style.flex = '1';
    right.style.padding = '18px';
    right.style.overflow = 'auto';

    container.style.display = 'flex';
    container.style.gap = '0';
    container.appendChild(left);
    container.appendChild(right);

    // create inner text area (keep id 'text' so rest of code can use it)
    right.innerHTML = '<div id="text" style="font-size:12pt;line-height:16pt;"></div>';
    // Re-acquire textEl reference because we replaced DOM
    textEl = document.getElementById('text');

    // Use a single Yale Alert email for the right column (explicit content)
    const title = `Yale Alert\nWINTER SNOWSTORM - Yale Operations Update for Monday`;
    const meta = `To: manni.su@yale.edu\n12:10 PM (12minutes ago)`;
    const bodyMain = `\n\n
\nGovernor Ned Lamont has declared a state of emergency in Connecticut in advance of the major winter storm expected to impact the state beginning Sunday evening, February 22, 2026, and continuing throughout the day on Monday, February 23, 2026. In addition, he has issued an emergency order prohibiting all commercial vehicles from traveling on limited-access highways statewide beginning at 5:00 p.m. on Sunday and remaining in effect until further notice.

As we continue to monitor conditions across the region and assess the potential impact on our campus community, we are writing to provide an update on Yale’s operations for Monday in light of the anticipated hazardous weather:

- There will be no in-person instruction on Monday. All courses that can be held remotely should be moved to an online format. We ask that faculty communicate directly with their students regarding the status and expectations for their courses.

- Yale shuttle service will be suspended until Tuesday morning at 6:00 a.m.

- Only essential staff who have been directed by their managers to report to campus should do so.

- Employees who are not essential should not come to campus. All employees should connect with their managers to confirm work arrangements. Those who are able to work remotely should do so.

As an academic and residential campus, Yale must continue to support teaching, learning, research, and patient care while maintaining critical operations. Public safety, dining, facilities, and other essential services will remain in place, supported by teams across the university working together to keep campus operating safely. We are grateful to the many staff members whose dedication ensures continuity of operations during weather events. We are also grateful to the faculty for providing continuity of educational, research and clinical missions despite the weather disruption. 

Please continue to monitor the Yale Status Board https://statusboard.apps.yale.edu/ for the most up-to-date information, including any changes to operations or transportation services.

Thank you for your flexibility and cooperation.

Best regards,
Scott Strobel
Provost and Henry Ford II Professor of Molecular Biophysics & Biochemistry
Yale University`;

    const fullBody = `${title}\n\n${meta}\n\n${bodyMain}`;
    // Additional emails: Ben Weathers (provided) + two placeholders
    const benBody = `benjamin.weathers@yale.edu\nTo-gather Opening Reception | Friday, Feb 20 6-8PM\n\nTo: hongting.zhu@yale.edu, becca.cheng@yale.edu, xy.chen@yale.edu\n\nHi All,\n\nPlease join me in celebrating the opening of To-gather @ 32 Edgewood. Public Reception is tomorrow! Friday February 20 6-8pm.\n\nWarmly,\n\nBen Weathers he/him\nGallery + Exhibitions Manager / Yale School of Art\n\nTo-gather\nStudent-organized exhibition\nOpen to the Yale community: February 20 - March 2, 2026\n\nPublic reception: Friday, February 20th from 6-8PM\nOrigami Workshop by Sok Song: Friday, February 20th at 4:30 PM\nPanel Discussion: Monday, March 2nd from 6-7PM\n\nA collective identity rooted in community and conversation, To-Gather invites closeness and shared understanding while confronting misrepresentation and cultural misreadings. The exhibition approaches collective identity not as a fixed definition, but as an evolving space where differences coexist and resonate. Within the American landscape, Asian and Asian diaspora voices are often subject to misreading, misunderstanding, and misrepresentation; here, the artists reclaim the terms of visibility by assembling their individual practices into a larger chorus, one that resists erasure, stereotype, and simplification.\n\nParticipating artists are Alec Dai, Amy Fang, Amy Wang, Camille Gwise, David Jung, Grace Han, Hasti Kasraei, Heejae Kim, Hongting Zhu, Izza Alyssa, Jocelyn Tsui, Le Liu, Manni Su, Mi Chen, Mingge Zhong, Ningxin Yao, Philip Falino, Priscilla Young, Rebecca Cheng, Shagnik Chakraborty, Shellie Zhang, Sok Song, Su Ji Kim, Wenqing Zhai, Xiangyun Chen, Xin Tan, Xing Zhang, Yinan Lin, Young Cho, and Yuwei Tu.\n\nOrganized by Hongting Zhu, Graphic Design MFA '26, Rebecca Cheng, Graphic Design MFA '26, and Xiangyun Chen, Photography MFA '26.`;

    const placeholder1 = `art.school@yale.edu\nAll-School Town Hall w/ Open Studios alum panel, Feb 25\n\nTo: yale-students@yale.edu\n\n`;

    const placeholder2 = `dannika.avent@yale.edu\nCommunity Lunch @ 1:15pm - Edgewood\n\nTo: soa_staff_admin@mailman.yale.edu\nsoa_mfa_students@mailman.yale.edu\n`;

    emails = [
        { subject: title, snippet: bodyMain.slice(0, 120), body: fullBody },
        { subject: 'To-gather Opening Reception | Friday, Feb 20 6-8PM', snippet: benBody.slice(0, 120), body: benBody },
        { subject: 'All-School Town Hall w/ Open Studios alum panel, Feb 25', snippet: placeholder1.slice(0, 120), body: placeholder1 },
        { subject: 'Community Lunch @ 1:15pm - Edgewood', snippet: placeholder2.slice(0, 120), body: placeholder2 }
    ];

    // render list
    left.innerHTML = '';
    emails.forEach((em, idx) => {
        const item = document.createElement('div');
        item.className = 'emailItem';
        item.style.padding = '10px 8px';
        item.style.borderBottom = '1px solid #f0f0f0';
        item.style.cursor = 'pointer';
        item.style.fontSize = '13px';
        item.style.lineHeight = '1.2';
        item.innerHTML = `<div style="font-weight:600;margin-bottom:6px">${em.subject}</div><div style="color:#666;font-size:12px">${em.snippet}</div>`;
        item.addEventListener('click', () => {
            currentEmailIndex = idx;
            renderEmailContent(idx);
            // highlight selection
            Array.from(left.querySelectorAll('.emailItem')).forEach((el, i) => el.style.background = i === idx ? '#f5f7fb' : '');
        });
        left.appendChild(item);
    });

    // select first email by default
    if (emails.length > 0) {
        currentEmailIndex = 0;
        // mark first item
        const first = left.querySelector('.emailItem');
        if (first) first.style.background = '#f5f7fb';
        renderEmailContent(0);
    } else {
        textEl.textContent = sampleText;
        requestAnimationFrame(initCharStates);
    }
}

function renderEmailContent(index) {
    const em = emails[index];
    // Render structured email: title, metadata, then body (body kept as per-character spans)
    const emailPane = document.getElementById('emailPane');
    if (!emailPane) return;
    emailPane.innerHTML = '';

    const titleEl = document.createElement('div');
    // Use first two header lines as the full title when available
    const headerLines = (em.body || '').split('\n').map(l => l.trim()).filter(Boolean);
    const titleText = headerLines.length >= 2 ? `${headerLines[0]}\n${headerLines[1]}` : (em.subject || 'No Subject');
    titleEl.textContent = titleText;
    titleEl.style.fontWeight = '500';
    titleEl.style.fontSize = '14pt';
    titleEl.style.color = 'rgb(0, 0, 0)';
    titleEl.style.whiteSpace = 'pre-wrap';
    titleEl.style.marginBottom = '8px';

    const infoEl = document.createElement('div');
    // show To: and time lines if available
    const metaLines = headerLines; // already computed
    let infoText = '';
    if (metaLines.length >= 4) {
        infoText = `${metaLines[2]}\n${metaLines[3]}`;
    } else if (metaLines.length >= 3) {
        infoText = `${metaLines[2]}`;
    }
    infoEl.textContent = infoText;
    infoEl.style.color = '#666';
    infoEl.style.fontSize = '11pt';
    infoEl.style.whiteSpace = 'pre-wrap';
    infoEl.style.marginBottom = '12px';

    const bodyContainer = document.createElement('div');
    bodyContainer.style.fontSize = '12pt';
    bodyContainer.style.lineHeight = '16pt';
    bodyContainer.style.whiteSpace = 'pre-wrap';
    bodyContainer.id = 'text';

    emailPane.appendChild(titleEl);
    emailPane.appendChild(infoEl);
    emailPane.appendChild(bodyContainer);

    // Re-acquire textEl reference because we replaced DOM
    textEl = document.getElementById('text');

    // Prepare body-only content by removing the subject and metadata lines
    // Find start of body: look for the first blank line after the header lines
    const raw = em.body || '';
    const parts = raw.split(/\n\s*\n/);
    const bodyText = parts.slice(1).join('\n\n') || parts[0] || '';

    // clear and render per-character spans for body
    textEl.innerHTML = '';
    chars = bodyText.split('');
    chars.forEach((ch, i) => {
        const span = document.createElement('span');
        span.dataset.index = i;
        span.classList.add('char');
        span.textContent = ch;
        if (ch === '\n') span.style.display = 'block';
        if (ch.trim() === '') span.classList.add('whitespace');
        textEl.appendChild(span);
    });
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




