const irisL = document.getElementById('irisL');
const irisR = document.getElementById('irisR');

const eyeL = document.getElementById('eyeL');
const eyeR = document.getElementById('eyeR');

const lidTop = document.getElementById('lidTop');
const lidBottom = document.getElementById('lidBottom');

const video = document.getElementById('video');

let gazeX = 0;
let gazeY = 0;

// 眼睛控制
let faceMesh;

function initFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
    });

    faceMesh.onResults(onResults);
}

window.onload = () => {
    initFaceMesh();
    startCamera();
    updateEye();
};

function getEyeCenter(landmarks, indices) {
    let x = 0, y = 0;
    indices.forEach(i => {
        x += landmarks[i].x;
        y += landmarks[i].y;
    });
    return {
        x: x / indices.length,
        y: y / indices.length
    };
}

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

function onResults(results) {
    if (!results.multiFaceLandmarks.length) return;

    const landmarks = results.multiFaceLandmarks[0];

    const left = getEyeCenter(landmarks, LEFT_EYE);
    const right = getEyeCenter(landmarks, RIGHT_EYE);

    // 平均 gaze
    gazeX = (left.x + right.x) / 2;
    gazeY = (left.y + right.y) / 2;

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        gazeX = 0.5;
        gazeY = 0.5;
        return;
    }
}

async function startCamera() {

    const camera = new Camera(video, {
        onFrame: async () => {
            await faceMesh.send({ image: video });
        },
        width: 640,
        height: 480
    });

    camera.start();
}

let currentX = 0;
let currentY = 0;

function updateEye() {

    const targetX = -(gazeX - 0.5) * 2;
    const targetY = (gazeY - 0.5) * 2;

    currentX += (targetX - currentX) * 0.15;
    currentY += (targetY - currentY) * 0.15;

    moveIris(eyeL, irisL, currentX, currentY);
    moveIris(eyeR, irisR, currentX, currentY);

    requestAnimationFrame(updateEye);
}


function moveIris(eye, iris, gx, gy) {

    const max = 25;

    // 直接用归一化值控制
    const dx = gx * max;
    const dy = gy * max;

    iris.setAttribute("transform", `translate(${dx}, ${dy})`);
}








