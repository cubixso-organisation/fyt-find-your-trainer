"use client";

/**
 * GradientWave: an animated WebGL mesh gradient.
 *
 * Source: "Gradient Wave" on 21st.dev (https://21st.dev), a React port of the
 * minigl mesh-gradient technique Stripe uses on stripe.com: a finely
 * subdivided plane under an orthographic camera, its vertices lifted by 3D
 * simplex noise, and its colour built per vertex from a base colour plus one
 * noise-driven wave layer per extra colour, blended with `smoothstep`. The
 * shader structure (`u_global`, `u_vertDeform`, `u_waveLayers` struct
 * uniforms, `blendNormal`, the Ashima simplex noise) follows that technique.
 *
 * Rebuilt for the FYT console rather than pasted. Changes from the source:
 *  - sizes to its container with a ResizeObserver (the source used the
 *    window), with a device-pixel-ratio cap for a crisp but affordable canvas;
 *    no window resize listener to leak;
 *  - initialises WebGL once; later prop changes (colours included) update
 *    uniforms in place, compared by value, and a colour change crossfades;
 *  - loses the GL context and cancels the animation frame on unmount;
 *  - pauses while the tab is hidden or the element is off screen;
 *  - prefers-reduced-motion renders one still frame and stops;
 *  - if WebGL is unavailable, a shader fails or the context is lost, the
 *    container keeps a static CSS gradient in the same colours;
 *  - typed throughout, SSR-safe (canvas created in an effect), and the
 *    shader source joins with "\n" (the paste had a broken string literal).
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------------ */
/* Types                                                                    */
/* ------------------------------------------------------------------------ */

type Vec2 = [number, number];
type Vec3 = [number, number, number];
type ShaderStage = "vertex" | "fragment";

export type GradientDeform = {
  /** Tilt of the plane, as a fraction of its width. */
  incline: number;
  /** Height (CSS px) the noise can lift the surface by. */
  noiseAmp: number;
  noiseFrequency: Vec2;
  /** How fast the surface noise travels sideways. */
  noiseFlow: number;
  noiseSpeed: number;
  noiseSeed: number;
  offsetTop: number;
  offsetBottom: number;
};

export type GradientWaveProps = {
  /** Hex colours: the first is the base, each further one a wave layer. */
  colors: readonly string[];
  isPlaying?: boolean;
  className?: string;
  style?: React.CSSProperties;
  shadowPower?: number;
  darkenTop?: boolean;
  /** Global time scale. Stripe uses 5e-6; lower drifts, higher churns. */
  noiseSpeed?: number;
  noiseFrequency?: Vec2;
  deform?: Partial<GradientDeform>;
  /** Device-pixel-ratio cap. */
  maxPixelRatio?: number;
  /** Cap used when the element is narrower than 640px (battery). */
  smallScreenPixelRatio?: number;
  /** Paint a static CSS gradient behind the canvas (and in its place when WebGL fails). */
  cssFallback?: boolean;
  /** Crossfade length for colour changes, in ms. */
  colorTransitionMs?: number;
};

type Config = {
  colors: Vec3[];
  shadowPower: number;
  darkenTop: boolean;
  noiseSpeed: number;
  noiseFrequency: Vec2;
  deform: GradientDeform;
  maxPixelRatio: number;
  smallScreenPixelRatio: number;
  colorTransitionMs: number;
};

const DEFAULT_DEFORM: GradientDeform = {
  incline: 0,
  noiseAmp: 320,
  noiseFrequency: [3, 4],
  noiseFlow: 3,
  noiseSpeed: 10,
  noiseSeed: 5,
  offsetTop: -0.5,
  offsetBottom: -0.5,
};

/** Stripe starts its clock here; the field looks settled at this point. */
const START_TIME = 1253106;
/** Where the still frame for reduced motion is taken. */
const STILL_TIME = START_TIME + 5200;

/* ------------------------------------------------------------------------ */
/* Colour                                                                   */
/* ------------------------------------------------------------------------ */

function hexToRgb(hex: string): Vec3 {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n) || h.length < 6) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mix3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/* ------------------------------------------------------------------------ */
/* minigl                                                                    */
/* ------------------------------------------------------------------------ */

type ScalarType = "float" | "int" | "vec2" | "vec3" | "vec4" | "mat4";
type LeafUniform = { type: ScalarType; value: number | number[] | Float32Array; excludeFrom?: ShaderStage };
type StructUniform = { type: "struct"; value: Record<string, LeafUniform>; excludeFrom?: ShaderStage };
type ArrayUniform = { type: "array"; value: StructUniform[]; excludeFrom?: ShaderStage };
type Uniform = LeafUniform | StructUniform | ArrayUniform;

/** `u_waveLayers` -> `WaveLayers`, as in minigl. */
const structName = (name: string) => {
  const bare = name.replace(/^u_/, "");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
};

function structBody(fields: Record<string, LeafUniform>) {
  return Object.entries(fields)
    .map(([n, u]) => `  ${u.type} ${n};`)
    .join("\n");
}

function declareUniform(name: string, u: Uniform, stage: ShaderStage): string {
  if (u.excludeFrom === stage) return "";
  if (u.type === "struct") {
    const t = structName(name);
    return `struct ${t} {\n${structBody(u.value)}\n};\nuniform ${t} ${name};`;
  }
  if (u.type === "array") {
    const t = structName(name);
    const n = u.value.length;
    return `struct ${t} {\n${structBody(u.value[0]?.value ?? {})}\n};\nuniform ${t} ${name}[${n}];\nconst int ${name}_length = ${n};`;
  }
  return `uniform ${u.type} ${name};`;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log ?? ""}`);
  }
  return shader;
}

class Material {
  readonly program: WebGLProgram;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private readonly gl: WebGLRenderingContext,
    vertexBody: string,
    fragmentBody: string,
    readonly uniforms: Record<string, Uniform>,
  ) {
    const declare = (stage: ShaderStage) =>
      Object.entries(uniforms)
        .map(([n, u]) => declareUniform(n, u, stage))
        .filter(Boolean)
        .join("\n");

    const vertexSource = [
      "precision highp float;",
      "attribute vec4 position;",
      "attribute vec2 uv;",
      "attribute vec2 uvNorm;",
      declare("vertex"),
      vertexBody,
    ].join("\n");
    const fragmentSource = ["precision mediump float;", declare("fragment"), fragmentBody].join("\n");

    const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`program link failed: ${log ?? ""}`);
    }
    this.program = program;
  }

  private locate(name: string) {
    let loc = this.locations.get(name);
    if (loc === undefined) {
      loc = this.gl.getUniformLocation(this.program, name);
      this.locations.set(name, loc);
    }
    return loc;
  }

  private uploadLeaf(name: string, u: LeafUniform) {
    const loc = this.locate(name);
    if (!loc) return;
    const gl = this.gl;
    const v = u.value;
    switch (u.type) {
      case "float":
        gl.uniform1f(loc, typeof v === "number" ? v : v[0]);
        break;
      case "int":
        gl.uniform1i(loc, typeof v === "number" ? v : v[0]);
        break;
      case "vec2":
        gl.uniform2fv(loc, v as Float32List);
        break;
      case "vec3":
        gl.uniform3fv(loc, v as Float32List);
        break;
      case "vec4":
        gl.uniform4fv(loc, v as Float32List);
        break;
      case "mat4":
        gl.uniformMatrix4fv(loc, false, v as Float32List);
        break;
    }
  }

  upload() {
    for (const [name, u] of Object.entries(this.uniforms)) {
      if (u.type === "struct") {
        for (const [f, leaf] of Object.entries(u.value)) this.uploadLeaf(`${name}.${f}`, leaf);
      } else if (u.type === "array") {
        u.value.forEach((item, i) => {
          for (const [f, leaf] of Object.entries(item.value)) this.uploadLeaf(`${name}[${i}].${f}`, leaf);
        });
      } else {
        this.uploadLeaf(name, u);
      }
    }
  }

  dispose() {
    this.gl.deleteProgram(this.program);
  }
}

class Attribute {
  readonly buffer: WebGLBuffer | null;
  values: Float32Array | Uint16Array;

  constructor(
    private readonly gl: WebGLRenderingContext,
    readonly size: number,
    readonly target: number,
  ) {
    this.buffer = gl.createBuffer();
    this.values = target === gl.ELEMENT_ARRAY_BUFFER ? new Uint16Array(0) : new Float32Array(0);
  }

  update() {
    this.gl.bindBuffer(this.target, this.buffer);
    this.gl.bufferData(this.target, this.values, this.gl.STATIC_DRAW);
  }

  attach(program: WebGLProgram, name: string) {
    const gl = this.gl;
    const loc = gl.getAttribLocation(program, name);
    if (loc < 0) return;
    gl.bindBuffer(this.target, this.buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, this.size, gl.FLOAT, false, 0, 0);
  }

  dispose() {
    this.gl.deleteBuffer(this.buffer);
  }
}

/**
 * A plane lying in XZ, as in minigl: the vertex shader supplies Y from the
 * tilt term and the noise, so the surface can fold upwards.
 */
class PlaneGeometry {
  xSegCount = 0;
  ySegCount = 0;
  readonly attributes: { position: Attribute; uv: Attribute; uvNorm: Attribute; index: Attribute };

  constructor(gl: WebGLRenderingContext) {
    this.attributes = {
      position: new Attribute(gl, 3, gl.ARRAY_BUFFER),
      uv: new Attribute(gl, 2, gl.ARRAY_BUFFER),
      uvNorm: new Attribute(gl, 2, gl.ARRAY_BUFFER),
      index: new Attribute(gl, 1, gl.ELEMENT_ARRAY_BUFFER),
    };
  }

  get vertexCount() {
    return (this.xSegCount + 1) * (this.ySegCount + 1);
  }

  get indexCount() {
    return this.attributes.index.values.length;
  }

  setTopology(xSegCount: number, ySegCount: number) {
    if (xSegCount === this.xSegCount && ySegCount === this.ySegCount) return;
    this.xSegCount = xSegCount;
    this.ySegCount = ySegCount;
    const uv = new Float32Array(2 * this.vertexCount);
    const uvNorm = new Float32Array(2 * this.vertexCount);
    const index = new Uint16Array(6 * xSegCount * ySegCount);
    for (let y = 0; y <= ySegCount; y++) {
      for (let x = 0; x <= xSegCount; x++) {
        const v = y * (xSegCount + 1) + x;
        uv[2 * v] = x / xSegCount;
        uv[2 * v + 1] = 1 - y / ySegCount;
        uvNorm[2 * v] = (x / xSegCount) * 2 - 1;
        uvNorm[2 * v + 1] = 1 - (y / ySegCount) * 2;
        if (x < xSegCount && y < ySegCount) {
          const q = y * xSegCount + x;
          index[6 * q] = v;
          index[6 * q + 1] = v + 1 + xSegCount;
          index[6 * q + 2] = v + 1;
          index[6 * q + 3] = v + 1;
          index[6 * q + 4] = v + 1 + xSegCount;
          index[6 * q + 5] = v + 2 + xSegCount;
        }
      }
    }
    this.attributes.uv.values = uv;
    this.attributes.uvNorm.values = uvNorm;
    this.attributes.index.values = index;
    this.attributes.uv.update();
    this.attributes.uvNorm.update();
    this.attributes.index.update();
  }

  setSize(width: number, height: number) {
    const position = new Float32Array(3 * this.vertexCount);
    const x0 = width / -2;
    const y0 = height / -2;
    const sw = width / this.xSegCount;
    const sh = height / this.ySegCount;
    for (let y = 0; y <= this.ySegCount; y++) {
      for (let x = 0; x <= this.xSegCount; x++) {
        const v = y * (this.xSegCount + 1) + x;
        position[3 * v] = x0 + x * sw; // x
        position[3 * v + 2] = -(y0 + y * sh); // z
      }
    }
    this.attributes.position.values = position;
    this.attributes.position.update();
  }

  dispose() {
    Object.values(this.attributes).forEach((a) => a.dispose());
  }
}

class Mesh {
  constructor(
    private readonly gl: WebGLRenderingContext,
    readonly geometry: PlaneGeometry,
    readonly material: Material,
  ) {}

  draw() {
    const gl = this.gl;
    gl.useProgram(this.material.program);
    this.material.upload();
    const { position, uv, uvNorm, index } = this.geometry.attributes;
    position.attach(this.material.program, "position");
    uv.attach(this.material.program, "uv");
    uvNorm.attach(this.material.program, "uvNorm");
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index.buffer);
    gl.drawElements(gl.TRIANGLES, this.geometry.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* ------------------------------------------------------------------------ */
/* Shaders                                                                  */
/* ------------------------------------------------------------------------ */

// Ashima Arts 3D simplex noise (MIT), as used by minigl.
const NOISE = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const BLEND = `
vec3 blendNormal(vec3 base, vec3 blend) { return blend; }
vec3 blendNormal(vec3 base, vec3 blend, float opacity) {
  return blendNormal(base, blend) * opacity + base * (1.0 - opacity);
}
`;

const VERTEX = `
varying vec3 v_color;
${NOISE}
${BLEND}
void main() {
  float time = u_time * u_global.noiseSpeed;
  vec2 noiseCoord = resolution * uvNorm * u_global.noiseFreq;

  // Tilt the plane.
  float tilt = resolution.y / 2.0 * uvNorm.y;
  float incline = resolution.x * uvNorm.x / 2.0 * u_vertDeform.incline;
  float offset = resolution.x / 2.0 * u_vertDeform.incline * mix(u_vertDeform.offsetBottom, u_vertDeform.offsetTop, uv.y);

  // Vertex noise, faded to zero at the top and bottom edges, never below 0.
  float noise = snoise(vec3(
    noiseCoord.x * u_vertDeform.noiseFreq.x + time * u_vertDeform.noiseFlow,
    noiseCoord.y * u_vertDeform.noiseFreq.y,
    time * u_vertDeform.noiseSpeed + u_vertDeform.noiseSeed
  )) * u_vertDeform.noiseAmp;
  noise *= 1.0 - pow(abs(uvNorm.y), 2.0);
  noise = max(0.0, noise);

  vec3 pos = vec3(position.x, position.y + tilt + incline + noise - offset, position.z);

  v_color = u_baseColor;
  for (int i = 0; i < u_waveLayers_length; i++) {
    WaveLayers layer = u_waveLayers[i];
    float layerNoise = smoothstep(
      layer.noiseFloor,
      layer.noiseCeil,
      snoise(vec3(
        noiseCoord.x * layer.noiseFreq.x + time * layer.noiseFlow,
        noiseCoord.y * layer.noiseFreq.y,
        time * layer.noiseSpeed + layer.noiseSeed
      )) / 2.0 + 0.5
    );
    v_color = blendNormal(v_color, layer.color, pow(layerNoise, 4.0));
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAGMENT = `
varying vec3 v_color;
void main() {
  vec3 color = v_color;
  if (u_darken_top == 1.0) {
    vec2 st = gl_FragCoord.xy / u_canvas.xy;
    color.g -= pow(max(0.0, st.y + sin(-12.0) * st.x), u_shadow_power) * 0.4;
  }
  gl_FragColor = vec4(color, 1.0);
}
`;

/* ------------------------------------------------------------------------ */
/* Gradient                                                                 */
/* ------------------------------------------------------------------------ */

type GradientCallbacks = { onFirstFrame: () => void; onFailure: () => void };

class Gradient {
  private readonly gl: WebGLRenderingContext;
  private readonly mesh: Mesh;
  private readonly u: {
    time: LeafUniform;
    resolution: LeafUniform;
    canvas: LeafUniform;
    projection: LeafUniform;
    shadowPower: LeafUniform;
    darkenTop: LeafUniform;
    global: StructUniform;
    vertDeform: StructUniform;
    baseColor: LeafUniform;
    layers: ArrayUniform;
  };

  private config: Config;
  private width = 0;
  private height = 0;
  private t = START_TIME;
  private raf = 0;
  private last = 0;
  private shown = false;
  private dead = false;

  // Pause inputs.
  private playing = true;
  private visible = true;
  private onScreen = true;
  private reduced = false;

  // Colour crossfade.
  private shownColors: Vec3[];
  private fadeFrom: Vec3[] | null = null;
  private fadeTo: Vec3[] = [];
  private fadeStart = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    config: Config,
    private readonly callbacks: GradientCallbacks,
  ) {
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false, depth: false, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL unavailable");
    this.gl = gl;
    this.config = config;
    this.shownColors = config.colors.map((c) => [...c] as Vec3);

    const layerCount = Math.max(1, config.colors.length - 1);
    const layers: StructUniform[] = Array.from({ length: layerCount }, (_, k) => this.layerUniform(k + 1, config));

    this.u = {
      time: { type: "float", value: this.t, excludeFrom: "fragment" },
      resolution: { type: "vec2", value: [1, 1], excludeFrom: "fragment" },
      canvas: { type: "vec2", value: [1, 1], excludeFrom: "vertex" },
      projection: { type: "mat4", value: new Float32Array(16), excludeFrom: "fragment" },
      shadowPower: { type: "float", value: config.shadowPower, excludeFrom: "vertex" },
      darkenTop: { type: "float", value: config.darkenTop ? 1 : 0, excludeFrom: "vertex" },
      global: {
        type: "struct",
        excludeFrom: "fragment",
        value: {
          noiseFreq: { type: "vec2", value: [...config.noiseFrequency] },
          noiseSpeed: { type: "float", value: config.noiseSpeed },
        },
      },
      vertDeform: {
        type: "struct",
        excludeFrom: "fragment",
        value: {
          incline: { type: "float", value: config.deform.incline },
          offsetTop: { type: "float", value: config.deform.offsetTop },
          offsetBottom: { type: "float", value: config.deform.offsetBottom },
          noiseFreq: { type: "vec2", value: [...config.deform.noiseFrequency] },
          noiseAmp: { type: "float", value: config.deform.noiseAmp },
          noiseSpeed: { type: "float", value: config.deform.noiseSpeed },
          noiseFlow: { type: "float", value: config.deform.noiseFlow },
          noiseSeed: { type: "float", value: config.deform.noiseSeed },
        },
      },
      baseColor: { type: "vec3", value: [...(config.colors[0] ?? [0, 0, 0])], excludeFrom: "fragment" },
      layers: { type: "array", value: layers, excludeFrom: "fragment" },
    };

    const material = new Material(gl, VERTEX, FRAGMENT, {
      projectionMatrix: this.u.projection,
      modelViewMatrix: {
        type: "mat4",
        value: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
        excludeFrom: "fragment",
      },
      resolution: this.u.resolution,
      u_canvas: this.u.canvas,
      u_time: this.u.time,
      u_shadow_power: this.u.shadowPower,
      u_darken_top: this.u.darkenTop,
      u_global: this.u.global,
      u_vertDeform: this.u.vertDeform,
      u_baseColor: this.u.baseColor,
      u_waveLayers: this.u.layers,
    });
    this.mesh = new Mesh(gl, new PlaneGeometry(gl), material);

    gl.disable(gl.DEPTH_TEST);
    canvas.addEventListener("webglcontextlost", this.handleLost);
  }

  /** Wave layer k (1-based), with minigl's per-layer spread. */
  private layerUniform(k: number, config: Config): StructUniform {
    const n = config.colors.length;
    return {
      type: "struct",
      value: {
        color: { type: "vec3", value: [...(config.colors[k] ?? config.colors[0] ?? [0, 0, 0])] },
        noiseFreq: { type: "vec2", value: [2 + k / n, 3 + k / n] },
        noiseSpeed: { type: "float", value: 11 + 0.3 * k },
        noiseFlow: { type: "float", value: 6.5 + 0.3 * k },
        noiseSeed: { type: "float", value: config.deform.noiseSeed + 10 * k },
        noiseFloor: { type: "float", value: 0.1 },
        noiseCeil: { type: "float", value: 0.63 + 0.07 * k },
      },
    };
  }

  private handleLost = (e: Event) => {
    e.preventDefault();
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.callbacks.onFailure();
  };

  private get animating() {
    return this.playing && this.visible && this.onScreen && !this.reduced;
  }

  /* ---- inputs -------------------------------------------------------- */

  setConfig(next: Config) {
    const prev = this.config;
    this.config = next;
    const g = this.u.global.value;
    g.noiseSpeed.value = next.noiseSpeed;
    g.noiseFreq.value = [...next.noiseFrequency];
    const d = this.u.vertDeform.value;
    d.incline.value = next.deform.incline;
    d.offsetTop.value = next.deform.offsetTop;
    d.offsetBottom.value = next.deform.offsetBottom;
    d.noiseFreq.value = [...next.deform.noiseFrequency];
    d.noiseAmp.value = next.deform.noiseAmp;
    d.noiseSpeed.value = next.deform.noiseSpeed;
    d.noiseFlow.value = next.deform.noiseFlow;
    d.noiseSeed.value = next.deform.noiseSeed;
    this.u.layers.value.forEach((layer, i) => {
      layer.value.noiseSeed.value = next.deform.noiseSeed + 10 * (i + 1);
    });
    this.u.shadowPower.value = next.shadowPower;
    this.u.darkenTop.value = next.darkenTop ? 1 : 0;

    const colorsChanged = next.colors.some((c, i) => c.some((v, j) => v !== prev.colors[i]?.[j]));
    if (colorsChanged) {
      if (!this.shown || this.reduced || next.colorTransitionMs <= 0) {
        this.fadeFrom = null;
        this.shownColors = next.colors.map((c) => [...c] as Vec3);
      } else {
        this.fadeFrom = this.shownColors.map((c) => [...c] as Vec3);
        this.fadeTo = next.colors.map((c) => [...c] as Vec3);
        this.fadeStart = performance.now();
      }
    }
    if (prev.maxPixelRatio !== next.maxPixelRatio || prev.smallScreenPixelRatio !== next.smallScreenPixelRatio) {
      this.resize(this.width, this.height);
    }
    this.request();
  }

  setPlaying(v: boolean) {
    this.playing = v;
    this.request();
  }
  setVisible(v: boolean) {
    this.visible = v;
    this.request();
  }
  setOnScreen(v: boolean) {
    this.onScreen = v;
    this.request();
  }
  setReduced(v: boolean) {
    this.reduced = v;
    if (v) this.t = STILL_TIME;
    this.request();
  }

  resize(width: number, height: number) {
    if (this.dead || width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    const cap = width < 640 ? this.config.smallScreenPixelRatio : this.config.maxPixelRatio;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, cap));
    const bw = Math.round(width * dpr);
    const bh = Math.round(height * dpr);
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.gl.viewport(0, 0, bw, bh);

    // Orthographic camera centred on the plane, in CSS pixels (minigl).
    const p = this.u.projection.value as Float32Array;
    p.fill(0);
    p[0] = 2 / width;
    p[5] = 2 / height;
    p[10] = 2 / (-2000 - 2000);
    p[15] = 1;
    this.u.resolution.value = [width, height];
    this.u.canvas.value = [bw, bh];

    // minigl's mesh density: ~0.06 segments per px across, 0.16 down.
    // Kept under the 16-bit index limit.
    let xs = Math.max(2, Math.ceil(width * 0.06));
    let ys = Math.max(2, Math.ceil(height * 0.16));
    while ((xs + 1) * (ys + 1) > 65000) {
      xs = Math.ceil(xs * 0.9);
      ys = Math.ceil(ys * 0.9);
    }
    this.mesh.geometry.setTopology(xs, ys);
    this.mesh.geometry.setSize(width, height);
    // Resizing clears the drawing buffer: always repaint, even when paused.
    this.request();
  }

  /* ---- loop ---------------------------------------------------------- */

  private request() {
    if (this.dead || this.raf || this.width === 0) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stepColors(now: number): boolean {
    if (!this.fadeFrom) return false;
    const k = Math.min(1, (now - this.fadeStart) / Math.max(1, this.config.colorTransitionMs));
    const e = easeOutCubic(k);
    const from = this.fadeFrom;
    this.shownColors = this.fadeTo.map((c, i) => mix3(from[i] ?? c, c, e));
    if (k >= 1) this.fadeFrom = null;
    return k < 1;
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.dead) return;
    const running = this.animating;
    if (running && this.last) this.t += Math.min(now - this.last, 1000 / 15);
    this.last = running ? now : 0;
    const fading = this.stepColors(now);

    this.u.time.value = this.t;
    this.u.baseColor.value = [...(this.shownColors[0] ?? [0, 0, 0])];
    this.u.layers.value.forEach((layer, i) => {
      layer.value.color.value = [...(this.shownColors[i + 1] ?? this.shownColors[0] ?? [0, 0, 0])];
    });

    const gl = this.gl;
    const base = this.shownColors[0] ?? [0, 0, 0];
    gl.clearColor(base[0], base[1], base[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.mesh.draw();

    if (!this.shown) {
      this.shown = true;
      this.callbacks.onFirstFrame();
    }
    if (running || fading) this.request();
  };

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.removeEventListener("webglcontextlost", this.handleLost);
    this.mesh.dispose();
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/* ------------------------------------------------------------------------ */
/* React                                                                    */
/* ------------------------------------------------------------------------ */

function toConfig(props: Required<Pick<GradientWaveProps, "colors">> & GradientWaveProps): Config {
  return {
    colors: props.colors.map(hexToRgb),
    shadowPower: props.shadowPower ?? 5,
    darkenTop: props.darkenTop ?? false,
    noiseSpeed: props.noiseSpeed ?? 5e-6,
    noiseFrequency: props.noiseFrequency ?? [14e-5, 29e-5],
    deform: { ...DEFAULT_DEFORM, ...props.deform },
    maxPixelRatio: props.maxPixelRatio ?? 2,
    smallScreenPixelRatio: props.smallScreenPixelRatio ?? 1,
    colorTransitionMs: props.colorTransitionMs ?? 450,
  };
}

/** A still CSS approximation of the field, in the same colours. */
function fallbackBackground(colors: readonly string[]): React.CSSProperties {
  const [base = "#000000", ...rest] = colors;
  const spots = ["18% 22%", "82% 30%", "30% 82%", "78% 86%", "55% 50%"];
  const layers = rest.map(
    (c, i) => `radial-gradient(60% 55% at ${spots[i % spots.length]}, ${c} 0%, transparent 70%)`,
  );
  return { backgroundColor: base, backgroundImage: layers.join(", ") || undefined };
}

export function GradientWave({
  colors,
  isPlaying = true,
  className,
  style,
  shadowPower,
  darkenTop,
  noiseSpeed,
  noiseFrequency,
  deform,
  maxPixelRatio,
  smallScreenPixelRatio,
  cssFallback = true,
  colorTransitionMs,
}: GradientWaveProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const gradientRef = React.useRef<Gradient | null>(null);
  const configRef = React.useRef<Config | null>(null);

  // Props arrive as fresh arrays/objects every render; compare them by value.
  const configKey = JSON.stringify(
    toConfig({
      colors,
      shadowPower,
      darkenTop,
      noiseSpeed,
      noiseFrequency,
      deform,
      maxPixelRatio,
      smallScreenPixelRatio,
      colorTransitionMs,
    }),
  );
  const colorCount = colors.length;

  // Declared first so it runs before the init effect on mount.
  React.useEffect(() => {
    const config = JSON.parse(configKey) as Config;
    configRef.current = config;
    gradientRef.current?.setConfig(config);
  }, [configKey]);

  const playingRef = React.useRef(isPlaying);
  React.useEffect(() => {
    playingRef.current = isPlaying;
    gradientRef.current?.setPlaying(isPlaying);
  }, [isPlaying]);

  // Initialise once (again only if the number of colours changes, since the
  // layer count is compiled into the shader).
  React.useEffect(() => {
    const host = hostRef.current;
    const config = configRef.current;
    if (!host || !config || colorCount < 1) return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      opacity: "0",
      transition: "opacity 700ms cubic-bezier(0.25, 1, 0.5, 1)",
    } satisfies Partial<CSSStyleDeclaration>);

    let gradient: Gradient;
    try {
      gradient = new Gradient(canvas, config, {
        onFirstFrame: () => {
          // Commit the starting opacity so the change below transitions.
          void canvas.getBoundingClientRect();
          canvas.style.opacity = "1";
        },
        onFailure: () => {
          canvas.style.opacity = "0";
        },
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[GradientWave] WebGL unavailable, showing the CSS fallback.", err);
      }
      return;
    }
    host.appendChild(canvas);
    gradientRef.current = gradient;
    gradient.setPlaying(playingRef.current);

    // Reduced motion: one still frame, and follow the setting live.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => gradient.setReduced(mq.matches);
    onMotion();
    mq.addEventListener("change", onMotion);

    // Pause in a hidden tab.
    const onVisibility = () => gradient.setVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    // Pause off screen.
    const io = new IntersectionObserver(([entry]) => gradient.setOnScreen(entry?.isIntersecting ?? true));
    io.observe(host);

    // Size to the container, not the window.
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      gradient.resize(width, height);
    });
    ro.observe(host);
    const rect = host.getBoundingClientRect();
    gradient.resize(rect.width, rect.height);

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onMotion);
      gradient.dispose();
      gradientRef.current = null;
      canvas.remove();
    };
  }, [colorCount]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={cn("relative overflow-hidden", className)}
      style={{ ...(cssFallback ? fallbackBackground(colors) : null), ...style }}
    />
  );
}
