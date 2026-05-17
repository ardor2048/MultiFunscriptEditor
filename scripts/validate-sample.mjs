import fs from "node:fs";

const samplePath = process.argv[2] || "/Users/mgm/Downloads/wlwpalyer/10min-sample.funscript";
const data = JSON.parse(fs.readFileSync(samplePath, "utf8"));
const validActions = new Set(["SS", "ZD", "JX", "XZ", "JR", "DT", "PS", "YL", "empty"]);

const errors = [];
const warnings = [];

function isSorted(points, label) {
  let previous = -1;
  const seen = new Set();
  for (const point of points) {
    if (!Number.isInteger(point.at) || point.at < 0) {
      errors.push(`${label}: invalid at ${point.at}`);
    }
    if (point.at < previous) {
      errors.push(`${label}: not sorted at ${point.at}`);
    }
    if (seen.has(point.at)) {
      warnings.push(`${label}: duplicate at ${point.at}`);
    }
    seen.add(point.at);
    previous = point.at;
  }
}

const actions = Array.isArray(data.actions) ? data.actions : [];
const timeline = Array.isArray(data.multiAction?.timeline) ? data.multiAction.timeline : [];

isSorted(actions, "actions");
isSorted(timeline, "multiAction.timeline");

for (const point of actions) {
  if (!Number.isInteger(point.pos) || point.pos < 0 || point.pos > 100) {
    errors.push(`actions: invalid pos ${point.pos} at ${point.at}`);
  }
}

const usage = {};
for (const point of timeline) {
  if (!Array.isArray(point.commands) || point.commands.length === 0) {
    errors.push(`multiAction: empty commands at ${point.at}`);
    continue;
  }
  for (const command of point.commands) {
    usage[command.action] = (usage[command.action] || 0) + 1;
    if (!validActions.has(command.action)) {
      errors.push(`multiAction: unknown action ${command.action} at ${point.at}`);
    }
    const qty = Number(command.qty);
    if (!Number.isInteger(qty) || qty < 0 || qty > 10) {
      errors.push(`multiAction: invalid qty ${command.qty} for ${command.action} at ${point.at}`);
    }
  }
}

console.log("Sample:", samplePath);
console.log("actions:", actions.length);
console.log("multiAction.timeline:", timeline.length);
console.log("durationMs:", Math.max(actions.at(-1)?.at || 0, timeline.at(-1)?.at || 0));
console.log("usage:", usage);

if (warnings.length) {
  console.warn("Warnings:");
  for (const warning of warnings) console.warn("-", warning);
}

if (errors.length) {
  console.error("Errors:");
  for (const error of errors) console.error("-", error);
  process.exit(1);
}

console.log("Validation passed.");
