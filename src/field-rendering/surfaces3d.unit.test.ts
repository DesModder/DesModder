import { EMPTY_ENVIRONMENT } from "./latexToGLSL";
import { scanSurfaces3D, splitTopLevel, type SurfaceItem } from "./surfaces3d";

/** Item models shaped as the probe of desmos.com/3d found them. */
function item(
  id: string,
  latex: string,
  expressionType: string,
  extra: Partial<SurfaceItem["formula"]> = {},
  hidden = false
): SurfaceItem {
  return {
    type: "expression",
    id,
    latex,
    hidden,
    formula: { expression_type: expressionType, ...extra },
  };
}

describe("finding the surfaces a field can hide behind", () => {
  test("z = f(x, y), a bare f(x, y) and a definition are all graphs over x, y", () => {
    const scan = scanSurfaces3D(
      [
        item("a", String.raw`z=3e^{-\frac{x^{2}+y^{2}}{6}}-1`, "SURFACE", {
          assignment: "z",
        }),
        item("b", String.raw`\frac{x^{2}-y^{2}}{8}`, "SURFACE"),
        item("c", String.raw`f\left(x,y\right)=xy`, "SURFACE", {
          defined_name: "f",
        }),
      ],
      EMPTY_ENVIRONMENT
    );
    expect(scan.skipped).toEqual([]);
    expect(
      scan.surfaces.map((s) => [s.id, s.kind, s.kind === "graph" && s.axis])
    ).toEqual([
      ["a", "graph", 2],
      ["b", "graph", 2],
      ["c", "graph", 2],
    ]);
  });

  test("x = g(y, z) is a graph over y and z", () => {
    const scan = scanSurfaces3D(
      [item("d", "x=y^{2}", "SURFACE_AMBIGUOUS", { assignment: "x" })],
      EMPTY_ENVIRONMENT
    );
    const [surface] = scan.surfaces;
    expect(surface.kind === "graph" && surface.axis).toBe(0);
    expect(surface.kind === "graph" && surface.body).toContain("p.y");
  });

  test("a parametric surface keeps its u and v ranges, and u, v are not graph values", () => {
    const scan = scanSurfaces3D(
      [
        item("e", String.raw`\left(\cos u,\sin u,v\right)`, "SURFACE_xyz_uv", {
          domains: [
            {
              variable: "u",
              minNumber: 0,
              maxNumber: 6.28,
              minValid: true,
              maxValid: true,
            },
            {
              variable: "v",
              minNumber: -2,
              maxNumber: 2,
              minValid: true,
              maxValid: true,
            },
          ],
        }),
      ],
      EMPTY_ENVIRONMENT
    );
    const [surface] = scan.surfaces;
    expect(surface.kind).toBe("uv");
    if (surface.kind !== "uv") return;
    expect(surface.u).toEqual([0, 6.28]);
    expect(surface.v).toEqual([-2, 2]);
    expect(surface.params).toEqual([]);
    expect(surface.xyz[0]).toContain("u_vp_u");
  });

  test("an implicit surface is named, not drawn; hidden items and curves are ignored", () => {
    const scan = scanSurfaces3D(
      [
        item("f", "x^{2}+y^{2}+z^{2}=9", "IMPLICIT_SURFACE"),
        item("g", "z=x", "SURFACE", { assignment: "z" }, true),
        item("h", String.raw`\left(\cos t,\sin t,t\right)`, "CURVE3D_xyz_t"),
      ],
      EMPTY_ENVIRONMENT
    );
    expect(scan.surfaces).toEqual([]);
    expect(scan.skipped.map((s) => s.id)).toEqual(["f"]);
    expect(scan.skipped[0].reason).toContain("implicit");
  });

  test("a surface reading a slider takes it as a uniform, as the field does", () => {
    const scan = scanSurfaces3D(
      [item("i", "z=ax", "SURFACE", { assignment: "z" })],
      { ...EMPTY_ENVIRONMENT, scalars: new Set(["a"]) }
    );
    expect(scan.surfaces[0].params).toEqual(["a"]);
  });

  test("one that does not compile is skipped with the compiler's reason", () => {
    const scan = scanSurfaces3D(
      [item("j", "z=q", "SURFACE", { assignment: "z" })],
      EMPTY_ENVIRONMENT
    );
    expect(scan.surfaces).toEqual([]);
    expect(scan.skipped[0].reason).toContain('"q" is not defined');
  });
});

describe("splitTopLevel", () => {
  test("splits only where no bracket is open", () => {
    expect(splitTopLevel(String.raw`a,\left(b,c\right),d`, ",")).toEqual([
      "a",
      String.raw`\left(b,c\right)`,
      "d",
    ]);
    expect(splitTopLevel(String.raw`z=x\left\{x=1:2,3\right\}`, "=")).toEqual([
      "z",
      String.raw`x\left\{x=1:2,3\right\}`,
    ]);
  });
});
