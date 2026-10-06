/**
 * Compiling and linking the 3D overlay's shader programs, shared by every
 * renderer that draws on it, so a compile failure reads the same wherever it
 * happens.
 */
import { FlowRendererError } from "./FlowRenderer";

export type Uniforms = Record<string, WebGLUniformLocation | null>;

export function linkProgram3D(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string
): WebGLProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? "";
      gl.deleteShader(shader);
      throw new FlowRendererError(
        `The 3D field's shader did not compile: ${log}`
      );
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "";
    gl.deleteProgram(program);
    throw new FlowRendererError(`The 3D field's shader did not link: ${log}`);
  }
  return program;
}

/** Every active uniform's location, with arrays under their bare name. */
export function uniformsOf(
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): Uniforms {
  const out: Uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info === null) continue;
    out[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(
      program,
      info.name
    );
  }
  return out;
}
