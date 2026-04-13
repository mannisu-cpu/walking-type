// =====================
// GLOBAL STATE
// =====================
let maskedIndices = new Set();
let blinkCount = 0;
let chars = [];
let maskedMap = {}; // index → 固定字符

let charStates = [];
let charBase = [];
let charRects = [];

let faceMesh = null;
let camera = null;
let reading = false;

let audioContext = null;
let analyser = null;
let microphone = null;

let speaking = false;
let speakerCount = 0;

const mouse = { x: -9999, y: -9999, px: -9999, py: -9999 };

// =====================
// DOM
// =====================
const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const textEl = document.getElementById('text');
const videoEl = document.getElementById('video');
const startBtn = document.getElementById('startBtn');
const statusEl = document.getElementById('status');

// =====================
// LOAD URL → FLASK
// =====================
loadBtn.addEventListener('click', loadURL);

async function loadURL() {
    let url = urlInput.value.trim();
    if (!url) return;

    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }

    try {
        const res = await fetch(`http://172.16.1.103:5000/scrape?url=${encodeURIComponent(url)}`);
        const data = await res.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        injectText(data.text);

    } catch (err) {
        console.error(err);
        alert('Scraping failed');
    }
}

// =====================
// INJECT TEXT
// =====================
function injectText(newText) {

    maskedIndices.clear();
    blinkCount = 0;
    chars = [];

    textEl.innerHTML = '';

    renderText(newText);
    requestAnimationFrame(initCharStates);

    // 自动启动交互系统
    if (!reading) {
        reading = true;

        if (startBtn) startBtn.textContent = "Stop";
        if (statusEl) statusEl.textContent = "Reading...";

        startCamera();
        startAudio();
    }

}

// =====================
// RENDER TEXT（核心）
// =====================
function renderText(bodyText) {

    chars = [];
    textEl.innerHTML = '';

    const words = bodyText.split(/(\s+)/);
    let index = 0;

    words.forEach(word => {

        if (word.trim() === '') {
            const span = document.createElement('span');
            span.textContent = word;
            span.classList.add('whitespace');

            if (word.includes('\n')) span.style.display = 'block';

            textEl.appendChild(span);
            return;
        }

        const wordSpan = document.createElement('span');
        wordSpan.classList.add('word');

        [...word].forEach(ch => {
            const charSpan = document.createElement('span');

            charSpan.dataset.index = index;
            charSpan.classList.add('char');
            charSpan.textContent = ch;

            chars.push(ch);
            index++;

            wordSpan.appendChild(charSpan);
        });

        textEl.appendChild(wordSpan);
    });
}

// =====================
// INIT CHAR STATES
// =====================
function initCharStates() {
    const spans = Array.from(textEl.querySelectorAll('span'));

    charRects = spans.map(s => {
        const r = s.getBoundingClientRect();
        return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
    });

    charBase = spans.map(() => ({ bx: 0, by: 0 }));
    charStates = spans.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
}

// =====================
// MASKING（眨眼控制）
// =====================
function getMaskableIndices() {
    return chars.map((ch, i) => ch.trim() !== '' ? i : null).filter(i => i !== null);
}

function applyMasking() {

    const maskChars = ['¤', '¦', '§', '░', '▒', '▓', '■', '\u25C6', '\u25FC'];

    const maskable = getMaskableIndices();

    const newMasks = Math.floor(Math.random() * 6) + 15;

    let added = 0;
    let attempts = 0;

    while (added < newMasks && attempts < 200) {
        const idx = maskable[Math.floor(Math.random() * maskable.length)];

        // 👉 只处理“第一次被选中”的字符
        if (!maskedIndices.has(idx)) {
            maskedIndices.add(idx);

            // ✅ 在这里决定它“永远变成什么”
            maskedMap[idx] = maskChars[Math.floor(Math.random() * maskChars.length)];

            added++;
        }

        attempts++;
    }

    const spans = textEl.querySelectorAll('span');

    spans.forEach((s) => {
        const i = Number(s.dataset.index);

        if (maskedIndices.has(i)) {

            // 👉 只在第一次的时候设置（不会闪）
            if (!s.classList.contains('masked')) {

                // 保留你原来的物理效果
                if (charStates[i] && charBase[i]) {
                    charBase[i].bx += charStates[i].x * 0.6;
                    charBase[i].by += charStates[i].y * 0.6;
                    charStates[i].x *= 0.4;
                    charStates[i].y *= 0.4;
                }

                const rect = charRects[i];
                if (rect && rect.w) {
                    s.style.width = rect.w + 'px';
                    s.style.display = 'inline-block';
                }

                s.classList.add('masked');
                s.textContent = maskedMap[i]; // ✅ 固定值
            }
        }
    });
}

// =====================
// ANIMATION LOOP
// =====================
function animateChars() {

    const spans = Array.from(textEl.querySelectorAll('span'));

    // 🎤 AUDIO CONTROL
    // ✅ 改成用 time-domain（更适合语音）
    if (analyser && microphone && reading) {

        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);

        analyser.getByteTimeDomainData(dataArray);

        // 👉 计算 RMS（真实音量）
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = (dataArray[i] - 128) / 128; // normalize to [-1,1]
            sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // 👉 平滑（关键！）
        if (!window.smoothVolume) window.smoothVolume = 0;
        window.smoothVolume = window.smoothVolume * 0.8 + rms * 0.2;

        const volume = window.smoothVolume;

        // 👉 更敏感阈值
        if (volume > 0.02) {
            speaking = true;
        } else {
            speaking = false;
        }

        // 👉 字体响应（更自然）
        const baseSize = 18;
        const scale = 1 + Math.min(volume * 2, 1.5); // 1 ~ 2.5倍
        textEl.style.transform = `scale(${scale})`;
        textEl.style.transformOrigin = 'top left';

        // 👉 多人讲话 detection（更合理）
        if (volume > 0.08 && !popupShown) {
            showPopup();
        }

        // debug
        // console.log("volume:", volume.toFixed(4));
    }

    // 🧠 CHAR PHYSICS
    for (let i = 0; i < charStates.length; i++) {
        const st = charStates[i];

        st.vx *= 0.9;
        st.vy *= 0.9;

        st.x += st.vx;
        st.y += st.vy;

        const base = charBase[i] || { bx: 0, by: 0 };
        const s = spans[i];

        if (s) {
            s.style.transform = `translate(${base.bx + st.x}px, ${base.by + st.y}px)`;
        }
    }

    requestAnimationFrame(animateChars);
}

requestAnimationFrame(animateChars);

// =====================
// 👁️ BLINK DETECTION
// =====================
const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(lm, eye) {
    const [p0, p1, p2, p3, p4, p5] = eye.map(i => lm[i]);
    return (dist(p1, p5) + dist(p2, p4)) / (2 * dist(p0, p3));
}

let closed = false;
let lastBlink = 0;

function onResults(results) {

    if (!results.multiFaceLandmarks?.length) return;

    const lm = results.multiFaceLandmarks[0];
    const ear = (eyeAspectRatio(lm, LEFT_EYE) + eyeAspectRatio(lm, RIGHT_EYE)) / 2;

    const now = performance.now();

    if (ear < 0.22 && !closed) closed = true;

    if (ear > 0.27 && closed) {
        closed = false;

        if (now - lastBlink > 150) {
            lastBlink = now;
            blinkCount++;
            applyMasking();
        }
    }
}

// =====================
// CAMERA
// =====================
function initFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true
    });

    faceMesh.onResults(onResults);
}

function startCamera() {
    if (!faceMesh) initFaceMesh();

    camera = new Camera(videoEl, {
        onFrame: async () => { await faceMesh.send({ image: videoEl }); },
        width: 640, height: 480
    });

    camera.start();
}

function stopCamera() {
    if (camera) camera.stop();
}

// =====================
// AUDIO
// =====================
function startAudio() {
    audioContext = new AudioContext();

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        microphone.connect(analyser);
    });
}

function stopAudio() {
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
}

// =====================
// START BUTTON
// =====================
startBtn.addEventListener('click', () => {

    if (!reading) {
        reading = true;
        startBtn.textContent = "Stop";
        statusEl.textContent = "Reading...";

        maskedIndices.clear();
        blinkCount = 0;

        startCamera();
        startAudio();

    } else {
        reading = false;
        startBtn.textContent = "Start";
        statusEl.textContent = "Stopped";

        stopCamera();
        stopAudio();
    }
});