import {
    HandLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

import {
    drawOverlay,
    initializeOverlay
} from './overlay.js';

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const canvas2 = document.getElementById("canvas2");
const ctx2 = canvas2.getContext("2d");

const canvasgl = document.getElementById("canvasgl");

const canvas_container = document.getElementById("container");

/* ---------------- CONFIG ---------------- */

const SMOOTHING = 0.8;
const VELOCITY_THRESHOLD = 0.02;
const VELOCITY_SMOOTHING = 0.35;
const HISTORY_SIZE = 8;

let target_width = 0;
let target_height = 0;

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];

/* ---------------- STATE ---------------- */

let settings = {
    overlay: null,
};

let handLandmarker;
let loaded;

let prevSize = null;
let prevTime = null;

const velocityHistory = [];

let smoothedVelocity = 0;

/* ---------------- UTILITIES ---------------- */

function distance(a, b) {
    return Math.sqrt(
        (a.x - b.x) ** 2 +
        (a.y - b.y) ** 2
    );
}

function smooth(prev, current) {
    if (prev === null) return current;
    return SMOOTHING * current + (1 - SMOOTHING) * prev;
}

/* ---------------- HAND METRICS ---------------- */

function estimateHandSize(hand) {

    const indexMCP = hand[5];
    const pinkyMCP = hand[17];

    return distance(indexMCP, pinkyMCP);
}

function smoothVelocity(v) {

    smoothedVelocity =
        VELOCITY_SMOOTHING * v +
        (1 - VELOCITY_SMOOTHING) * smoothedVelocity;

    return smoothedVelocity;
}

function computeVelocity(currentSize, time) {

    if (prevSize === null || prevTime === null) {
        prevSize = currentSize;
        prevTime = time;
        return 0;
    }

    const dt = (time - prevTime) / 1000;

    const delta = currentSize - prevSize;

    const velocity = delta / dt;

    prevSize = currentSize;
    prevTime = time;

    velocityHistory.push(velocity);

    if (velocityHistory.length > HISTORY_SIZE)
        velocityHistory.shift();

    const avgVelocity =
        velocityHistory.reduce((a, b) => a + b, 0) /
        velocityHistory.length;

    return smoothVelocity(avgVelocity);
}

function getMovementStatus(v) {

    if (v > VELOCITY_THRESHOLD)
        return 1;

    if (v < -VELOCITY_THRESHOLD)
        return -1;

    return 0;
}

/* ---------------- DRAWING ---------------- */

function drawVideoFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.max(target_width / video_width, target_height / video_height);

    const cropW = target_width / scale;
    const cropH = target_height / scale;

    const sx = (video_width - cropW) / 2;
    const sy = (video_height - cropH) / 2;

    ctx.drawImage(
        video,
        sx,
        sy,
        cropW,
        cropH,
        0,
        0,
        target_width,
        target_height
    );
}

function drawHand(hand) {
    drawConnectors(ctx2, hand, HAND_CONNECTIONS, {
        color: "#c84a31",
        lineWidth: 5
    });
    drawLandmarks(ctx2, hand, { color: "#20e020", lineWidth: 1, radius: () => { return 3; } });

    const scale = Math.max(target_width / video_width, target_height / video_height);

    const cropW = target_width / scale;
    const cropH = target_height / scale;

    const sx = (video_width - cropW) / 2;
    const sy = (video_height - cropH) / 2;

    ctx.drawImage(
        canvas2,
        sx,
        sy,
        cropW,
        cropH,
        0,
        0,
        target_width,
        target_height
    );
}

function drawUI(velocity, status) {

    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";

    ctx.fillText(
        `Velocity: ${velocity.toFixed(3)}`,
        20,
        40
    );

    let str_msg = "";

    if (status == 0) {
        str_msg = "Still";
    }
    if (status == -1) {
        str_msg = "Moving Away";
    }
    if (status == 1) {
        str_msg = "Moving towards";
    }

    ctx.fillText(str_msg, 20, 80);
}

function drawWaveOverlay(velocity, hand, status) {
    let middleX = (hand[5].x + hand[17].x + hand[0].x) / 3;
    let middleY = (hand[5].y + hand[17].y + hand[0].y) / 3;

    const scale = Math.max(target_width / video_width, target_height / video_height);
    const scaleX = target_width / video_width;
    const scaleY = target_height / video_height;

    const cropW = target_width / scale;
    const cropH = target_height / scale;

    const sx = (video_width - cropW) / 2;
    const sy = (video_height - cropH) / 2;

    drawOverlay(ctx2, (status != 0) ? velocity : 0, [middleX, middleY], scale);

    ctx2.drawImage(
        canvasgl,
        0,
        0,
        video_width,
        video_height,
    );

    ctx2.beginPath();

    ctx2.arc(cropW * middleX, cropH * middleY, 20, 0, 2 * Math.PI);
    ctx2.fillStyle = "red";
    ctx2.fill();
}

/* ---------------- PROCESS HAND ---------------- */

let finalfreq = 220;

function processHand(hand, time) {

    let size = estimateHandSize(hand);

    size = smooth(prevSize, size);

    const velocity = computeVelocity(size, time);

    const status = getMovementStatus(velocity);

    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
    if (settings.overlay)
        drawWaveOverlay(velocity, hand, status);
    drawHand(hand);
    drawUI(velocity, status);

    if (status != 0) {
        drawGraph(4 + 25 * velocity);
        finalfreq = 220 + 100 * velocity;
    }
    else {
        drawGraph(4);
        finalfreq = 220;
    }
}

/* ---------------- DETECTION LOOP ---------------- */

function detectLoop() {

    const now = performance.now();

    drawVideoFrame();

    const results = handLandmarker.detectForVideo(video, now);

    drawGraph(4);
    finalfreq = 220;

    if (results.landmarks.length > 0) {

        const hand = results.landmarks[0];

        processHand(hand, now);
    }

    changeFrequency(finalfreq);

    requestAnimationFrame(detectLoop);
}

/* ---------------- CAMERA ---------------- */

let video_width = null;
let video_height = null;

const video_element = document.getElementById('video');

async function startCamera() {

    var constraints = {
        video: {
            width: { min: 1280 },
            height: { min: 720 },
            aspectRatio: 1.777777778
        }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    video.srcObject = stream;

    video.onloadedmetadata = () => {
        const track = stream.getVideoTracks()[0];
        document.getElementsByClassName("loading")[0].style.display = 'none';

        console.log(track.getSettings());

        video_width = track.getSettings().width;//video_element.videoWidth;
        video_height = track.getSettings().height;//video_element.videoHeight;

        canvas2.width = video_width;
        canvas2.height = video_height;

        canvasgl.width = video_width;
        canvasgl.height = video_height;

        canvas.width = target_width;
        canvas.height = target_height;

        console.log(canvas2.width, canvas2.height);
        console.log(canvas.width, canvas.height);

        initializeOverlay();

        requestAnimationFrame(detectLoop);
    };
}

/* ---------------- MEDIAPIPE SETUP ---------------- */

async function createHandLandmarker() {

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    handLandmarker =
        await HandLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
                },
                runningMode: "VIDEO",
                numHands: 1,
                minHandDetectionConfidence: 0.8,
                minHandPresenceConfidence: 0.8,
                minTrackingConfidence: 0.8
            }
        );
}

/* ---------------- AUDIO --------------- */

let audio = {
    audioctx: null,
    osc: null,
    gain: null,
    running: null
};

const audio_element = document.getElementById("mute");

function startAudio() {
    audio.audioctx = new AudioContext();
    audio.osc = audio.audioctx.createOscillator();
    audio.gain = audio.audioctx.createGain();

    audio.osc.type = "sine";
    audio.osc.frequency.value = 220;

    audio.gain.gain.setValueAtTime(0, audio.audioctx.currentTime);
    audio.gain.gain.linearRampToValueAtTime(0.2, audio.audioctx.currentTime + 0.1);

    audio.osc.connect(audio.gain);
    audio.gain.connect(audio.audioctx.destination);

    audio.osc.start();
    audio.running = true;
}

function changeFrequency(freq) {
    audio.osc.frequency.value = freq;
}

function stopAudio() {
    audio.osc.stop();
    audio.running = false;
}

export function toggleAudio() {
    if (audio.running) {
        stopAudio();
        audio_element.innerHTML = "volume_off";
    }
    else {
        startAudio();
        audio_element.innerHTML = "volume_up";
    }
}

/* ---------------- UTILITIES ---------------- */

const ack_btn = document.getElementById("ack_");
const ack = document.getElementById("acknowledgements");

const waves_en = document.getElementById("waves_en");

function toggleAck() {
    if (ack.style.display == 'flex')
        ack.style.display = 'none';
    else
        ack.style.display = 'flex';
}

function toggleWaves() {
    if (settings.overlay == false) {
        settings.overlay = true;
        waves_en.innerHTML = "circle_circle";
    }
    else {
        settings.overlay = false;
        waves_en.innerHTML = "hand_bones";
    }
}

function resize() {
    if (window.innerWidth < 650) {
        document.getElementsByClassName("loading")[0].style.display = 'block';
        document.getElementById("loading_msg").innerHTML = "Your display is too small!";
    }
    else {
        document.getElementsByClassName("loading")[0].style.display = 'none';
    }

    target_width = canvas.clientWidth - 40;
    target_height = canvas.clientHeight - 40;

    canvas.width = target_width;
    canvas.height = target_height;

    resizeGraph();
}

async function init() {

    await createHandLandmarker();

    target_width = canvas.clientWidth - 40;
    target_height = canvas.clientHeight - 40;

    await startCamera();

    settings.overlay = false;

    setupGraph();
    startAudio();
    stopAudio();

    onboarding();
}

init();

window.toggleAudio = toggleAudio;

window.addEventListener("resize", resize);
audio_element.addEventListener("click", toggleAudio);
ack_btn.addEventListener("click", toggleAck);
waves_en.addEventListener("click", toggleWaves);
