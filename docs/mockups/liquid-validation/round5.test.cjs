const test = require("node:test");
const assert = require("node:assert/strict");
const cp = require("node:child_process");
const {
  Liquid,
  plicFaceFractions,
  physicalSliceDrag,
} = require("./liquid.cjs");

test("PLIC face geometry has the expected half-cell cuts", () => {
  const x = plicFaceFractions(0.5, 1, 0);
  assert.ok(Math.abs(x[0] - 1) < 1e-12);
  assert.ok(Math.abs(x[1] - 0.5) < 2e-3);
  assert.ok(Math.abs(x[2]) < 1e-12);
  assert.ok(Math.abs(x[3] - 0.5) < 2e-3);
});

test("physical slice drag conversion is pinned", () => {
  const dx = 1 / 160;
  const dt = Math.sqrt((3e-5 * dx) / 9.81);
  const q = physicalSliceDrag({
    nu: 1e-6,
    depth: 0.15,
    dx,
    dt,
    quadratic: 0.2,
  });
  assert.ok(Math.abs(q.linear - 7.373350181457747e-8) < 1e-18);
  assert.ok(Math.abs(q.quadratic - 0.00125) < 1e-15);
});

test("new features are opt-in: default dam oracle output is unchanged", () => {
  const a = cp
    .execFileSync(process.execPath, ["dam.cjs", "15"], {
      encoding: "utf8",
      cwd: __dirname,
    })
    .trim();
  const b = cp
    .execFileSync(
      process.execPath,
      [
        "-e",
        `
    const {Liquid}=require('./liquid.round4.cjs');
    const a=15,g=9e-4/a,nx=Math.ceil(4.4*a)+2,ny=2*a+8;
    const mm=[[.41,1.11],[.84,1.22],[1.19,1.44],[1.43,1.67],[1.63,1.89],[1.83,2.11],[1.98,2.33],[2.2,2.56],[2.32,2.78],[2.51,3],[2.65,3.22],[2.83,3.44],[2.97,3.67],[3.11,3.89],[3.33,4.11]];
    const s=new Liquid({nx,ny,gravity:g,tau:.53,smagorinsky:.1,solid:(x,y)=>x===0||x===nx-1||y===0,fill:(x,y)=>x>=1&&x<=a&&y>=1&&y<=2*a?1:0});
    const start=s.totalMass();let i=0,err=0,xs=[];const rows=Math.max(1,Math.round(a/10));
    for(let n=1;i<mm.length;n++){s.step(1);const T=n*Math.sqrt((2*g)/a);if(T>=mm[i][0]){let f=0;for(let x=1;x<nx-1;x++)for(let y=1;y<=rows;y++)if(s.phi[y*nx+x]>=.5)f=Math.max(f,x);err+=Math.abs(f/a-mm[i][1])/mm[i][1];xs.push((f/a).toFixed(2));i++;}}
    const slope=(xs[14]-xs[6])/(3.33-1.98);
    console.log(\`speed \${slope.toFixed(2)} √(gH) a \${a} mean err \${((100*err)/mm.length).toFixed(1)}% Mach \${(s.peakSpeed*Math.sqrt(3)).toFixed(2)} drift \${((s.totalMass()-start)/start).toExponential(1)} last X \${xs.slice(-3).join(' ')}\`);
  `,
      ],
      { encoding: "utf8", cwd: __dirname }
    )
    .trim();
  assert.equal(a, b);
});

test("mass ledger remains conservative with PLIC exchange", () => {
  const s = new Liquid({
    nx: 40,
    ny: 24,
    gravity: 1e-4,
    tau: 0.53,
    smagorinsky: 0.1,
    interfaceFlux: "plic",
    solid: (x, y) => x === 0 || x === 39 || y === 0,
    fill: (x, y) => (x > 0 && x < 12 && y > 0 && y < 18 ? 1 : 0),
  });
  const m = s.totalMass();
  s.step(200);
  assert.ok(Math.abs((s.totalMass() - m) / m) < 1e-12);
  assert.ok(Number.isFinite(s.peakSpeed));
});

test("capillary pressure jump stays finite and conservative in a coarse drop", () => {
  const nx = 40,
    ny = 40,
    dx = 0.00625,
    dt = Math.sqrt((3e-5 * dx) / 9.81);
  const capillaryCoeff = (3 * 0.072 * dt * dt) / (1000 * dx ** 3);
  const s = new Liquid({
    nx,
    ny,
    tau: 0.5001,
    smagorinsky: 0,
    gravity: 0,
    bubbles: false,
    capillaryCoeff,
    solid: (x, y) => x === 0 || x === nx - 1 || y === 0 || y === ny - 1,
    fill: (x, y) => ((x - 20) ** 2 + (y - 20) ** 2 < 25 ? 1 : 0),
  });
  const m = s.totalMass();
  s.step(100);
  assert.ok(Math.abs((s.totalMass() - m) / m) < 1e-12);
  assert.ok(s.peakSpeed < 0.02);
});
