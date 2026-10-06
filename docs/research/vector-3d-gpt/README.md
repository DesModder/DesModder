# GPT's 3D research round (2026-10-05)

Answers to `../../VECTOR_TOOLS_3D_RESEARCH_BRIEF.md`. The report is
`VECTOR_TOOLS_3D_RESEARCH_RESULTS.md`. The zip's copies of our own sources and
briefs were dropped; they were older copies of files in this repo.

Two files were patched on arrival: `vector3d_webgl2_bench.html` and
`vector3d_visual_prototype.html` named a variable `half`, a reserved word in
GLSL ES, so neither compiled. `vector3d_webgl2_bench.iris-xe.json` is the
benchmark's output after that patch, on the Iris Xe. It reads 0 ms throughout
because `gl.finish()` does not wait for the GPU in Chrome. See
`../../mockups/vector-3d-arrows/README.md` for timer-query measurements and
how the round was folded into the mock-up.
