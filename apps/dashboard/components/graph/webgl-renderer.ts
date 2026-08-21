/**
 * WebGL2 renderer for the graph.
 *
 * Edges are drawn as three batched `LINES` calls (one per edge type) and node
 * cards as a single instanced draw, so a frame is four draw calls no matter how
 * large the graph is. Vertex data is uploaded straight from the views the Rust
 * module exposes over wasm memory — nothing is copied or rebuilt in JS.
 */

const EDGE_VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
in vec2 a_start;
in float a_alpha;
uniform vec2 u_viewOrigin;
uniform vec2 u_viewSize;
out float v_alpha;
out vec2 v_world;
out vec2 v_start;
void main() {
  vec2 unit = (a_pos - u_viewOrigin) / u_viewSize;
  gl_Position = vec4(unit.x * 2.0 - 1.0, 1.0 - unit.y * 2.0, 0.0, 1.0);
  v_alpha = a_alpha;
  v_world = a_pos;
  v_start = a_start;
}`;

const EDGE_FRAG = `#version 300 es
precision highp float;
in float v_alpha;
in vec2 v_world;
in vec2 v_start;
uniform vec3 u_color;
uniform vec2 u_dash;   // (dash length, gap length) in screen px; x <= 0 disables
uniform float u_scale; // world units -> screen px
out vec4 outColor;
void main() {
  if (u_dash.x > 0.0) {
    float travelled = length(v_world - v_start) * u_scale;
    float period = u_dash.x + u_dash.y;
    if (mod(travelled, period) > u_dash.x) discard;
  }
  outColor = vec4(u_color, v_alpha);
}`;

const NODE_VERT = `#version 300 es
precision highp float;
in vec2 a_corner;      // unit quad, -1..1
in vec2 a_center;      // per instance
in float a_kind;
in float a_state;
in float a_alpha;
uniform vec2 u_viewOrigin;
uniform vec2 u_viewSize;
uniform vec2 u_half;   // card half extents in world units
out vec2 v_corner;
out float v_kind;
out float v_state;
out float v_alpha;
void main() {
  vec2 world = a_center + a_corner * u_half;
  vec2 unit = (world - u_viewOrigin) / u_viewSize;
  gl_Position = vec4(unit.x * 2.0 - 1.0, 1.0 - unit.y * 2.0, 0.0, 1.0);
  v_corner = a_corner;
  v_kind = a_kind;
  v_state = a_state;
  v_alpha = a_alpha;
}`;

/**
 * Rounded-rectangle fill plus a 1px-ish border, evaluated as a signed distance
 * field so cards stay crisp at any zoom without extra geometry.
 */
const NODE_FRAG = `#version 300 es
precision highp float;
in vec2 v_corner;
in float v_kind;
in float v_state;
in float v_alpha;
uniform vec2 u_half;
uniform float u_radius;
uniform float u_scale;
uniform vec3 u_appFill;
uniform vec3 u_packageFill;
uniform vec3 u_appStroke;
uniform vec3 u_packageStroke;
uniform vec3 u_selectedStroke;
uniform vec3 u_hoverStroke;
out vec4 outColor;

// Note: 'half' is a reserved word in GLSL ES, hence halfSize.
float roundedBoxSdf(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - (halfSize - radius);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

void main() {
  vec2 p = v_corner * u_half;
  float dist = roundedBoxSdf(p, u_half, u_radius);

  // One screen pixel expressed in world units, for antialiasing.
  float px = 1.0 / max(u_scale, 0.0001);
  float fill = 1.0 - smoothstep(-px, px, dist);
  if (fill <= 0.001) discard;

  bool isApp = v_kind < 0.5;
  vec3 fillColor = isApp ? u_appFill : u_packageFill;
  vec3 strokeColor = isApp ? u_appStroke : u_packageStroke;
  float strokeWidth = px;
  if (v_state > 2.5) { strokeColor = u_selectedStroke; strokeWidth = px * 1.5; }
  else if (v_state > 1.5) { strokeColor = u_hoverStroke; }

  float border = 1.0 - smoothstep(-strokeWidth - px, -strokeWidth + px, dist);
  vec3 color = mix(strokeColor, fillColor, border);
  outColor = vec4(color, fill * v_alpha);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader allocation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
  const program = gl.createProgram();
  if (!program) throw new Error("program allocation failed");
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${log}`);
  }
  return program;
}

export interface RendererPalette {
  appFill: [number, number, number];
  packageFill: [number, number, number];
  appStroke: [number, number, number];
  packageStroke: [number, number, number];
  selectedStroke: [number, number, number];
  hoverStroke: [number, number, number];
  edge: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
}

export interface FrameInput {
  view: { x: number; y: number; width: number; height: number };
  /** World units per screen pixel. */
  scale: number;
  edges: {
    verts: Float32Array;
    alpha: Float32Array;
    start: Float32Array;
  }[];
  nodeInstances: Float32Array;
  cardHalf: [number, number];
  cardRadius: number;
}

/** Dash pattern per edge type, in screen pixels. Zero means solid. */
const EDGE_DASH: [number, number][] = [
  [0, 0],
  [6, 4],
  [2, 3],
];

export class WebglGraphRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly edgeProgram: WebGLProgram;
  private readonly nodeProgram: WebGLProgram;

  private readonly edgeVao: WebGLVertexArrayObject;
  private readonly edgePosBuffer: WebGLBuffer;
  private readonly edgeStartBuffer: WebGLBuffer;
  private readonly edgeAlphaBuffer: WebGLBuffer;

  private readonly nodeVao: WebGLVertexArrayObject;
  private readonly nodeInstBuffer: WebGLBuffer;

  private readonly edgeUniforms: Record<string, WebGLUniformLocation | null>;
  private readonly nodeUniforms: Record<string, WebGLUniformLocation | null>;

  constructor(
    canvas: HTMLCanvasElement,
    private palette: RendererPalette,
  ) {
    const gl = canvas.getContext("webgl2", {
      // Transparent so the themed surface behind the canvas shows through; the
      // shaders emit straight alpha, hence the un-premultiplied buffer.
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      // The renderer repaints every frame it is asked for; nothing reads back.
      preserveDrawingBuffer: false,
      desynchronized: true,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;

    this.edgeProgram = link(gl, EDGE_VERT, EDGE_FRAG);
    this.nodeProgram = link(gl, NODE_VERT, NODE_FRAG);

    this.edgeUniforms = {
      viewOrigin: gl.getUniformLocation(this.edgeProgram, "u_viewOrigin"),
      viewSize: gl.getUniformLocation(this.edgeProgram, "u_viewSize"),
      color: gl.getUniformLocation(this.edgeProgram, "u_color"),
      dash: gl.getUniformLocation(this.edgeProgram, "u_dash"),
      scale: gl.getUniformLocation(this.edgeProgram, "u_scale"),
    };
    this.nodeUniforms = {
      viewOrigin: gl.getUniformLocation(this.nodeProgram, "u_viewOrigin"),
      viewSize: gl.getUniformLocation(this.nodeProgram, "u_viewSize"),
      half: gl.getUniformLocation(this.nodeProgram, "u_half"),
      radius: gl.getUniformLocation(this.nodeProgram, "u_radius"),
      scale: gl.getUniformLocation(this.nodeProgram, "u_scale"),
      appFill: gl.getUniformLocation(this.nodeProgram, "u_appFill"),
      packageFill: gl.getUniformLocation(this.nodeProgram, "u_packageFill"),
      appStroke: gl.getUniformLocation(this.nodeProgram, "u_appStroke"),
      packageStroke: gl.getUniformLocation(this.nodeProgram, "u_packageStroke"),
      selectedStroke: gl.getUniformLocation(
        this.nodeProgram,
        "u_selectedStroke",
      ),
      hoverStroke: gl.getUniformLocation(this.nodeProgram, "u_hoverStroke"),
    };

    // --- edge VAO ---
    this.edgeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.edgeVao);
    this.edgePosBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePosBuffer);
    const aPos = gl.getAttribLocation(this.edgeProgram, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.edgeStartBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeStartBuffer);
    const aStart = gl.getAttribLocation(this.edgeProgram, "a_start");
    gl.enableVertexAttribArray(aStart);
    gl.vertexAttribPointer(aStart, 2, gl.FLOAT, false, 0, 0);

    this.edgeAlphaBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeAlphaBuffer);
    const aAlpha = gl.getAttribLocation(this.edgeProgram, "a_alpha");
    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 0, 0);

    // --- node VAO: one unit quad, instanced per card ---
    this.nodeVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.nodeVao);
    const cornerBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aCorner = gl.getAttribLocation(this.nodeProgram, "a_corner");
    gl.enableVertexAttribArray(aCorner);
    gl.vertexAttribPointer(aCorner, 2, gl.FLOAT, false, 0, 0);

    this.nodeInstBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeInstBuffer);
    const stride = 5 * 4;
    const instanceAttribs: [string, number, number][] = [
      ["a_center", 2, 0],
      ["a_kind", 1, 8],
      ["a_state", 1, 12],
      ["a_alpha", 1, 16],
    ];
    for (const [name, size, offset] of instanceAttribs) {
      const location = gl.getAttribLocation(this.nodeProgram, name);
      if (location < 0) continue;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(location, 1);
    }

    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // Separate alpha blending: over a transparent buffer, folding src alpha into
    // the destination twice would make dimmed geometry fade to alpha squared.
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
  }

  setPalette(palette: RendererPalette) {
    this.palette = palette;
  }

  resize(pixelWidth: number, pixelHeight: number) {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);
  }

  draw(frame: FrameInput) {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const origin = [frame.view.x, frame.view.y] as const;
    const size = [frame.view.width, frame.view.height] as const;

    // --- edges: one batched LINES call per type ---
    gl.useProgram(this.edgeProgram);
    gl.bindVertexArray(this.edgeVao);
    gl.uniform2f(this.edgeUniforms.viewOrigin!, origin[0], origin[1]);
    gl.uniform2f(this.edgeUniforms.viewSize!, size[0], size[1]);
    gl.uniform1f(this.edgeUniforms.scale!, frame.scale);

    for (let bucket = 0; bucket < frame.edges.length; bucket++) {
      const data = frame.edges[bucket]!;
      const vertexCount = data.verts.length / 2;
      if (vertexCount === 0) continue;

      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgePosBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.verts, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeStartBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.start, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeAlphaBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.alpha, gl.DYNAMIC_DRAW);

      const color = this.palette.edge[bucket] ?? this.palette.edge[0];
      gl.uniform3f(this.edgeUniforms.color!, color[0], color[1], color[2]);
      const dash = EDGE_DASH[bucket] ?? EDGE_DASH[0]!;
      gl.uniform2f(this.edgeUniforms.dash!, dash[0], dash[1]);

      gl.drawArrays(gl.LINES, 0, vertexCount);
    }

    // --- nodes: one instanced call ---
    const instances = frame.nodeInstances.length / 5;
    if (instances > 0) {
      gl.useProgram(this.nodeProgram);
      gl.bindVertexArray(this.nodeVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeInstBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, frame.nodeInstances, gl.DYNAMIC_DRAW);

      gl.uniform2f(this.nodeUniforms.viewOrigin!, origin[0], origin[1]);
      gl.uniform2f(this.nodeUniforms.viewSize!, size[0], size[1]);
      gl.uniform2f(
        this.nodeUniforms.half!,
        frame.cardHalf[0],
        frame.cardHalf[1],
      );
      gl.uniform1f(this.nodeUniforms.radius!, frame.cardRadius);
      gl.uniform1f(this.nodeUniforms.scale!, frame.scale);
      const p = this.palette;
      gl.uniform3fv(this.nodeUniforms.appFill!, p.appFill);
      gl.uniform3fv(this.nodeUniforms.packageFill!, p.packageFill);
      gl.uniform3fv(this.nodeUniforms.appStroke!, p.appStroke);
      gl.uniform3fv(this.nodeUniforms.packageStroke!, p.packageStroke);
      gl.uniform3fv(this.nodeUniforms.selectedStroke!, p.selectedStroke);
      gl.uniform3fv(this.nodeUniforms.hoverStroke!, p.hoverStroke);

      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instances);
    }

    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.edgeProgram);
    gl.deleteProgram(this.nodeProgram);
    gl.deleteBuffer(this.edgePosBuffer);
    gl.deleteBuffer(this.edgeStartBuffer);
    gl.deleteBuffer(this.edgeAlphaBuffer);
    gl.deleteBuffer(this.nodeInstBuffer);
    gl.deleteVertexArray(this.edgeVao);
    gl.deleteVertexArray(this.nodeVao);
  }
}
