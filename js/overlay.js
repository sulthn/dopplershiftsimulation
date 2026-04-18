let cgl = null;
let gl = null;

const vertex_shader = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment_shader = `
precision mediump float;

uniform vec2 resolution;
uniform float time;
uniform float frequency;
uniform vec2 pos;

#define MAX_SOURCES 32
uniform vec3 sources[MAX_SOURCES]; // x, y, start
uniform vec2 source_p[MAX_SOURCES]; // wavelength, color

const float PI = 3.1415926535897932384626433832795;
const float twoPI = 2.0 * PI;

float ripple(vec2 uv, vec3 src, vec2 src_p) {
    if (src.z <= 0.0) return 0.0;

    vec2 p = uv - src.xy;
    float d = length(p);

    float age = time - src.z;
    if (age < 0.0) return 0.0;

    float radius = age * 0.5;
    float diff = d - radius;

    float k = twoPI / src_p.x; // per-source wavelength

    float envelope = exp(-diff * diff * 10.0);
    float wave = sin(diff * k);

    return wave * envelope;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;

    float omega = twoPI * frequency;

    float sum = 0.0;
    float e = 0.0;
    vec3 cur_col = vec3(0.0);
    vec3 colorSum = vec3(0.0);

    // discrete ripples (each has own λ)
    for (int i = 0; i < MAX_SOURCES; i++) {
        float w = ripple(uv, sources[i], source_p[i]);

        float velocity = source_p[i].y;

        if (velocity < -0.008) {
            cur_col = vec3(min(10.0 * (abs(velocity)), 1.0), 0.0, 0.0);
        }
        else if (velocity > 0.01) {
            cur_col = vec3(0.0, 0.0, min(10.0 * (abs(velocity)), 1.0));
        }
        else {
            cur_col = vec3(0.0, 0.0, 0.0);
        }
        
        float intensity = abs(w);

        colorSum += cur_col * intensity;
        e += intensity;
        sum += w;
    }

    vec3 col = colorSum / (e + 0.001);

    // continuous wave (uses current wavelength)
    vec2 p = uv - pos;
    float d = length(p);

    float k = twoPI / 0.05; // base wavelength for continuous
    float wave = sin(d * k - omega * time);
    float envelope = exp(-d * 1.5);

    col += vec3(1.0) * wave * envelope * 0.2;
    col = pow(col, vec3(0.6));

    sum += wave * envelope * 2.0;

    float trans = 0.5 + 0.5 * (sum / (1.0 + abs(sum)));
    if (trans < 0.3)
        trans = 0.0;

    gl_FragColor = vec4(col, trans);
}
`;

function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
    }
    return s;
}

function createProgram(vsSrc, fsSrc) {
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;

    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);

    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(p));
        return null;
    }
    return p;
}

export function initializeOverlay() {
    cgl = document.getElementById("canvasgl");
    gl = cgl.getContext("webgl");

    const program = createProgram(vertex_shader, fragment_shader);
    if (!program) throw new Error("Shader failed");

    console.log(cgl.width, cgl.height);

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1, 1, 1
    ]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    uRes = gl.getUniformLocation(program, "resolution");
    uTime = gl.getUniformLocation(program, "time");
    uSources = gl.getUniformLocation(program, "sources");
    uSourcesP = gl.getUniformLocation(program, "source_p");
    uFrequency = gl.getUniformLocation(program, "frequency");
    uMouse = gl.getUniformLocation(program, "pos");
}

let uRes = null;
let uTime = null;
let uSources = null;
let uSourcesP = null;
let uFrequency = null;
let uMouse = null;

// ---------- PARAMETERS ----------

const MAX = 32;
const EMIT_INTERVAL = 200;
let wavelength = 0.2;
let frequency = 0.2;

// ---------- DRAW ------------

let sources = [];
let lastEmit = 0;

function toShaderCoords(coordinate, scale) {
    /*    (x - 0.5) / cgl.height,
        (cgl.height * 0.5 - y) / cgl.height
    */
    
    return [
        (coordinate[0] - 0.5) / (cgl.height / cgl.width),
        (0.5 - coordinate[1])
    ];
}

export function drawOverlay(context, velocity, coords, scale) {
    let t = performance.now() / 1000;
    let now = performance.now();

    wavelength = 0.2 - 1000.0 * velocity;
    wavelength = Math.max(0.1, Math.min(16.0, wavelength));

    if (now - lastEmit > EMIT_INTERVAL) {
        lastEmit = now;

        const [sx, sy] = toShaderCoords(coords, scale);

        if (isFinite(sx) && isFinite(sy)) {
            sources.push([sx, sy, now/1000, wavelength, velocity]);
            if (sources.length > MAX) sources.shift();
        }
    }

    const [mx, my] = toShaderCoords(coords, scale);

    gl.uniform2f(uRes, cgl.width, cgl.height);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uFrequency, frequency);
    gl.uniform2f(uMouse, mx, my);

    let arr = new Float32Array(MAX * 3);
    let arr2 = new Float32Array(MAX * 2);
    for (let i = 0; i < sources.length; i++) {
        arr[i*3+0] = sources[i][0];
        arr[i*3+1] = sources[i][1];
        arr[i*3+2] = sources[i][2];
        arr2[i*2+0] = sources[i][3]; // wavelength
        arr2[i*2+1] = sources[i][4];
    }

    gl.uniform3fv(uSources, arr);
    gl.uniform2fv(uSourcesP, arr2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}