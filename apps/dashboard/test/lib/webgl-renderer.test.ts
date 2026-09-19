import { WebglGraphRenderer, type RendererPalette } from "@/components/graph/webgl-renderer";

const PALETTE: RendererPalette = {
  appFill: [0, 0, 0],
  packageFill: [0, 0, 0],
  appStroke: [0, 0, 0],
  packageStroke: [0, 0, 0],
  selectedStroke: [0, 0, 0],
  hoverStroke: [0, 0, 0],
  edge: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
};

function installWebGLMock() {
  const attribs: WebGLContextAttributes[] = [];
  const viewport = jest.fn();
  const clear = jest.fn();
  const gl: Record<string, unknown> = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    ARRAY_BUFFER: 34962,
    FLOAT: 5126,
    TRIANGLES: 4,
    LINES: 1,
    COLOR_BUFFER_BIT: 16384,
    DEPTH_TEST: 2929,
    BLEND: 3042,
    SRC_ALPHA: 770,
    ONE_MINUS_SRC_ALPHA: 771,
    ONE: 1,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    DYNAMIC_DRAW: 35048,
    STATIC_DRAW: 35044,
    canvas: null as HTMLCanvasElement | null,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    deleteShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    deleteProgram: () => {},
    getUniformLocation: (_p: unknown, name: string) => name,
    getAttribLocation: () => 0,
    createVertexArray: () => ({}),
    bindVertexArray: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    vertexAttribDivisor: () => {},
    bufferData: () => {},
    disable: () => {},
    enable: () => {},
    blendFuncSeparate: () => {},
    viewport,
    clearColor: () => {},
    clear,
    useProgram: () => {},
    uniform2f: () => {},
    uniform1f: () => {},
    uniform3f: () => {},
    uniform3fv: () => {},
    drawArrays: () => {},
    drawArraysInstanced: () => {},
    deleteBuffer: () => {},
    deleteVertexArray: () => {},
  };

  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(function (
      this: HTMLCanvasElement,
      type: string,
      options?: WebGLContextAttributes,
    ) {
      if (type !== "webgl2") return null;
      attribs.push(options ?? {});
      gl.canvas = this;
      return gl as unknown as WebGL2RenderingContext;
    });

  return { gl, attribs, viewport, clear };
}

describe("WebglGraphRenderer", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not request a desynchronized drawing buffer", () => {
    const { attribs } = installWebGLMock();
    const canvas = document.createElement("canvas");
    new WebglGraphRenderer(canvas, PALETTE);

    expect(attribs).toHaveLength(1);
    expect(attribs[0]!.desynchronized).not.toBe(true);
    expect(attribs[0]!.preserveDrawingBuffer).toBe(false);
    expect(attribs[0]!.alpha).toBe(true);
  });

  it("does not reassign canvas.width when the backing store already matches", () => {
    installWebGLMock();
    const canvas = document.createElement("canvas");
    const renderer = new WebglGraphRenderer(canvas, PALETTE);

    renderer.resize(1800, 1100);
    expect(canvas.width).toBe(1800);
    expect(canvas.height).toBe(1100);

    let widthWrites = 0;
    let heightWrites = 0;
    const widthDesc = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "width",
    )!;
    const heightDesc = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      "height",
    )!;
    Object.defineProperty(canvas, "width", {
      configurable: true,
      get: () => 1800,
      set: () => {
        widthWrites++;
      },
    });
    Object.defineProperty(canvas, "height", {
      configurable: true,
      get: () => 1100,
      set: () => {
        heightWrites++;
      },
    });

    renderer.resize(1800, 1100);
    expect(widthWrites).toBe(0);
    expect(heightWrites).toBe(0);

    Object.defineProperty(canvas, "width", widthDesc);
    Object.defineProperty(canvas, "height", heightDesc);
  });
});
