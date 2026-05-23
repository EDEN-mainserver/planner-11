#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function sh(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function createStoryboard(topic, duration, channel) {
  return `# STORYBOARD

- Topic: ${topic}
- Duration: ${duration}s
- Channel: ${channel}
- Created: ${nowIso()}

## Scene Plan
1. Hook (0-3s): attention capture
2. Problem (3-8s): what hurts now
3. Solution (8-18s): product or method reveal
4. Proof (18-26s): evidence, quick demo, or social proof
5. CTA (26-${duration}s): one clear next action
`;
}

function createMeta(projectId, duration, width, height) {
  return {
    id: projectId,
    name: projectId,
    fps: 30,
    width,
    height,
    durationInFrames: duration * 30
  };
}

function createIndexHtml(projectId, width, height, duration) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectId}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${projectId}"
      data-start="0"
      data-duration="${duration}"
      data-width="${width}"
      data-height="${height}"
    >
      <div
        data-composition-id="scene-1"
        data-composition-src="compositions/scene-1.html"
        data-start="0"
        data-duration="${(duration / 3).toFixed(2)}"
        data-track-index="1"
        data-width="${width}"
        data-height="${height}"
      ></div>
      <div
        data-composition-id="scene-2"
        data-composition-src="compositions/scene-2.html"
        data-start="${(duration / 3).toFixed(2)}"
        data-duration="${(duration / 3).toFixed(2)}"
        data-track-index="1"
        data-width="${width}"
        data-height="${height}"
      ></div>
      <div
        data-composition-id="scene-3"
        data-composition-src="compositions/scene-3.html"
        data-start="${((duration / 3) * 2).toFixed(2)}"
        data-duration="${(duration / 3).toFixed(2)}"
        data-track-index="1"
        data-width="${width}"
        data-height="${height}"
      ></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const mainTl = gsap.timeline({ paused: true });
      mainTl.set({}, {}, ${duration});
      window.__timelines["${projectId}"] = mainTl;
    </script>
  </body>
</html>
`;
}

function createSceneHtml(sceneId, title, bg, width, height, duration) {
  return `<template id="${sceneId}-template">
  <div
    data-composition-id="${sceneId}"
    data-start="0"
    data-width="${width}"
    data-height="${height}"
    data-duration="${duration}"
  >
    <div class="${sceneId}-stage">
      <div class="${sceneId}-title">${title}</div>
    </div>

    <style>
      [data-composition-id="${sceneId}"] {
        position: absolute;
        inset: 0;
      }
      [data-composition-id="${sceneId}"] .${sceneId}-stage {
        width: ${width}px;
        height: ${height}px;
        display: grid;
        place-items: center;
        background: ${bg};
        color: #fff;
        font-family: "Segoe UI", sans-serif;
      }
      [data-composition-id="${sceneId}"] .${sceneId}-title {
        font-size: ${Math.round(width * 0.08)}px;
        font-weight: 800;
        letter-spacing: 0.04em;
        opacity: 0;
        transform: scale(0.96);
      }
    </style>

    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      (function () {
        const tl = gsap.timeline({ paused: true });
        const target = '[data-composition-id="${sceneId}"] .${sceneId}-title';
        tl.to(target, { opacity: 1, scale: 1, duration: 0.45, ease: "power2.out" }, 0);
        tl.to(target, { opacity: 1, duration: ${Math.max(0.1, duration - 0.9).toFixed(2)}, ease: "none" }, 0.45);
        tl.to(target, { opacity: 0, duration: 0.45, ease: "power2.in" }, ${Math.max(0.45, duration - 0.45).toFixed(2)});
        tl.set({}, {}, ${duration});
        window.__timelines = window.__timelines || {};
        window.__timelines["${sceneId}"] = tl;
      })();
    </script>
  </div>
</template>
`;
}

function writeJson(path, obj) {
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function qualityGate(projectDir, reportPath) {
  const checks = [];
  const required = ["index.html", "meta.json", "STORYBOARD.md", "hyperframes.json"];
  for (const file of required) {
    checks.push({
      check: `exists:${file}`,
      passed: existsSync(join(projectDir, file))
    });
  }
  const score = checks.filter((c) => c.passed).length;
  const result = {
    createdAt: nowIso(),
    score,
    maxScore: checks.length,
    passed: score === checks.length,
    checks
  };
  writeJson(reportPath, result);
  if (!result.passed) {
    throw new Error(`Quality gate failed (${score}/${checks.length}). See ${reportPath}`);
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const step = args.step || "run";
  const project = args.project || "video-projects/auto-mg";
  const topic = args.topic || "Automation Promo";
  const duration = Number(args.duration || "30");
  const channel = args.channel || "shorts";
  const root = resolve(process.cwd());
  const projectDir = resolve(root, project);
  const compositionsDir = join(projectDir, "compositions");
  const rendersDir = join(projectDir, "renders");
  const reportsDir = join(projectDir, "reports");
  const width = channel === "shorts" || channel === "reels" ? 1080 : 1920;
  const height = channel === "shorts" || channel === "reels" ? 1920 : 1080;

  const steps = [
    "plan",
    "generate",
    "preflight",
    "preview",
    "quality",
    "render",
    "package"
  ];
  const toRun = step === "run" ? steps : [step];

  for (const s of toRun) {
    console.log(`\n== ${s.toUpperCase()} ==`);
    if (s === "plan") {
      ensureDir(projectDir);
      writeFileSync(join(projectDir, "STORYBOARD.md"), createStoryboard(topic, duration, channel), "utf8");
      console.log("Wrote STORYBOARD.md");
    } else if (s === "generate") {
      ensureDir(projectDir);
      ensureDir(compositionsDir);
      ensureDir(rendersDir);
      ensureDir(reportsDir);
      writeJson(join(projectDir, "meta.json"), createMeta(projectDir.split(/[\\/]/).pop(), duration, width, height));
      writeFileSync(join(projectDir, "index.html"), createIndexHtml(projectDir.split(/[\\/]/).pop(), width, height, duration), "utf8");
      const sceneDuration = (duration / 3).toFixed(2);
      writeFileSync(
        join(compositionsDir, "scene-1.html"),
        createSceneHtml("scene-1", "HOOK", "linear-gradient(135deg,#0f172a,#1e3a8a)", width, height, sceneDuration),
        "utf8"
      );
      writeFileSync(
        join(compositionsDir, "scene-2.html"),
        createSceneHtml("scene-2", "SOLUTION", "linear-gradient(135deg,#111827,#065f46)", width, height, sceneDuration),
        "utf8"
      );
      writeFileSync(
        join(compositionsDir, "scene-3.html"),
        createSceneHtml("scene-3", "CTA", "linear-gradient(135deg,#3f1d2e,#7c2d12)", width, height, sceneDuration),
        "utf8"
      );
      if (!existsSync(join(projectDir, "hyperframes.json"))) {
        const hyperframes = {
          $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
          registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
          paths: {
            blocks: "compositions",
            components: "compositions/components",
            assets: "assets"
          }
        };
        writeJson(join(projectDir, "hyperframes.json"), hyperframes);
      }
      console.log("Generated base composition files");
    } else if (s === "preflight") {
      sh(`node "${join(root, "scripts", "preflight.mjs")}" "${projectDir}"`, root);
    } else if (s === "preview") {
      sh("npx hyperframes preview", projectDir);
    } else if (s === "quality") {
      const report = join(reportsDir, "quality-gate.json");
      const result = qualityGate(projectDir, report);
      console.log(`Quality gate passed (${result.score}/${result.maxScore})`);
    } else if (s === "render") {
      sh('npx hyperframes render --quality draft --output renders/draft.mp4', projectDir);
      sh('npx hyperframes render --quality standard --output renders/final.mp4', projectDir);
    } else if (s === "package") {
      const pkg = {
        createdAt: nowIso(),
        project: projectDir,
        outputs: [
          "renders/draft.mp4",
          "renders/final.mp4",
          "reports/quality-gate.json",
          "STORYBOARD.md",
          "meta.json"
        ]
      };
      writeJson(join(projectDir, "reports", "delivery-package.json"), pkg);
      console.log("Wrote reports/delivery-package.json");
    } else {
      throw new Error(`Unknown step: ${s}`);
    }
  }
}

main();
