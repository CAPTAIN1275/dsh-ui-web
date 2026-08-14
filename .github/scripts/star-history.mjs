#!/usr/bin/env node
// Star history 鐢熸垚鍣紙dsh-web-ui 鑷墭绠?star 鍥捐〃锛夈€?//
// 鑳屾櫙锛欸itHub 鑷?2026-06-30 璧烽檺鍒?GET /repos/{owner}/{repo}/stargazers 鎺ュ彛锛?// 浠呬粨搴撶鐞嗗憳涓庡崗浣滆€呭彲璇伙紝star-history.com 鐨勫叕鍏卞浘琛ㄥ洜姝や笉鍙敤銆?// 鏈剼鏈敼涓轰粨搴撹嚜鎵樼锛歜ootstrap 涓€娆℃€ф媺鍏ㄩ噺鍘嗗彶锛宻napshot 姣忔棩杩藉姞
// stargazers_count锛堝叕寮€瀛楁锛夊揩鐓э紝閲嶇粯 star-history.svg 渚?README 寮曠敤銆?//
// 鐢ㄦ硶锛?//   node star-history.mjs bootstrap --out <dir>   # 鎷夊叏閲?stargazers锛岀敓鎴愬垵濮嬫暟鎹笌鍥?//   node star-history.mjs snapshot  --out <dir>   # 杩藉姞褰撳ぉ蹇収骞堕噸缁橈紱鏃犲彉鍖栬緭鍑?"unchanged"
//
// 璁よ瘉锛氫紭鍏?GITHUB_TOKEN / GH_TOKEN 鐜鍙橀噺锛沚ootstrap 蹇呴』涓轰粨搴?// owner/collaborator 鐨?token锛宻napshot 浠呴渶鍏紑鎺ュ彛锛堟湁 token 鏇寸ǔ锛夈€?
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const REPO = process.env.GITHUB_REPOSITORY || "CAPTAIN1275/dsh-ui-web";
const API = "https://api.github.com";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const W = 800;
const H = 348;
const PAD = { left: 66, right: 30, top: 34, bottom: 50 };

function die(msg) {
  console.error("error: " + msg);
  process.exit(1);
}

function authHeaders(extra = {}) {
  const h = { ...extra, "User-Agent": "dsh-web-ui-star-history" };
  if (token) h.Authorization = "Bearer " + token;
  return h;
}

async function apiGet(path, accept) {
  const headers = authHeaders();
  if (accept) headers.Accept = accept;
  const res = await fetch(API + path, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error("GET " + path + ": HTTP " + res.status + " " + body.slice(0, 300));
  }
  return res;
}

// ---------- 鏁版嵁 ----------

function utcDateStr(iso) {
  return iso.slice(0, 10);
}

async function fetchAllStargazers() {
  const items = [];
  let page = 1;
  for (;;) {
    const res = await apiGet(
      "/repos/" + REPO + "/stargazers?per_page=100&page=" + page,
      "application/vnd.github.star+json"
    );
    const batch = await res.json();
    if (!Array.isArray(batch)) die("stargazers 杩斿洖寮傚父: " + JSON.stringify(batch).slice(0, 200));
    items.push(...batch);
    const link = res.headers.get("link") || "";
    if (!/rel="next"/.test(link)) break;
    page += 1;
    if (page > 500) die("鍒嗛〉瓒呰繃 500 椤碉紝鐤戜技姝诲惊鐜?);
  }
  return items;
}

// bootstrap: 鍏ㄩ噺 stargazers -> points锛堟寜 star 鏃堕棿鍗囧簭锛岄€愭潯绱锛?async function bootstrap(outDir) {
  if (!token) die("bootstrap 闇€瑕?GITHUB_TOKEN锛堜粨搴?owner/collaborator锛?);
  const items = await fetchAllStargazers();
  items.sort((a, b) => (a.starred_at < b.starred_at ? -1 : 1));
  let n = 0;
  const points = items.map((it) => {
    n += 1;
    return { at: it.starred_at, stars: n };
  });
  if (points.length === 0) die("鏈彇鍒颁换浣?stargazer 鏁版嵁");
  await writeData(outDir, points, "bootstrap");
  console.log("bootstrap: " + points.length + " points, 鏈€鏂?" + points[points.length - 1].stars + " stars");
}

// snapshot: 杩藉姞褰撳ぉ stargazers_count锛涘悓澶╅噸澶嶈繍琛岃鐩栧綋澶╄褰?async function snapshot(outDir) {
  const histPath = join(outDir, "history.json");
  let hist;
  try {
    hist = JSON.parse(await readFile(histPath, "utf8"));
  } catch {
    die("缂哄皯 " + histPath + "锛岃鍏堣繍琛?bootstrap");
  }
  const points = hist.points;
  const res = await apiGet("/repos/" + REPO);
  const count = (await res.json()).stargazers_count;
  const today = utcDateStr(new Date().toISOString());
  const last = points[points.length - 1];
  let changed = false;
  if (last && utcDateStr(last.at) === today) {
    if (last.stars !== count) {
      last.stars = count;
      changed = true;
    }
  } else if (!last || last.stars !== count) {
    points.push({ at: today + "T23:59:59Z", stars: count });
    changed = true;
  }
  if (!changed) {
    console.log("unchanged");
    return;
  }
  await writeData(outDir, points, "snapshot");
  console.log("snapshot: " + points.length + " points, " + count + " stars");
}

async function writeData(outDir, points, mode) {
  await mkdir(outDir, { recursive: true });
  const updated = utcDateStr(new Date().toISOString());
  const hist = { repository: REPO, updated, points };
  await writeFile(join(outDir, "history.json"), JSON.stringify(hist, null, 2) + "\n");
  await writeFile(join(outDir, "star-history.svg"), renderSvg(points, updated));
  console.log("wrote " + mode + " -> " + outDir + "/{history.json,star-history.svg}");
}

// ---------- SVG 娓叉煋 ----------

// 鍗冨垎浣嶆牸寮忓寲锛堟棤姝ｅ垯渚濊禆锛?function fmt(n) {
  const s = String(n);
  let out = "";
  for (let i = 0; i < s.length; i += 1) {
    const fromEnd = s.length - i;
    out += s[i];
    if (fromEnd > 1 && fromEnd % 3 === 1) out += ",";
  }
  return out;
}

function niceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step;
  if (norm >= 5) step = 5;
  else if (norm >= 2) step = 2;
  else step = 1;
  return step * mag;
}

function fmtAxis(iso, mode) {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  if (mode === "ym") return d.getUTCFullYear() + "-" + mm;
  if (mode === "md") return mm + "-" + dd;
  return mm + "-" + dd + " " + hh + ":" + mi;
}

// 鍚堝苟鍚屼竴鏃跺埢锛堝悓绉掞級鐨勯噸澶嶇偣锛屼繚璇?x 涓ユ牸閫掑鍚庡啀鍋氬钩婊戞洸绾?function dedupeX(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.at === p.at) last.stars = p.stars;
    else out.push({ at: p.at, stars: p.stars });
  }
  return out;
}

// Catmull-Rom 杞笁娆¤礉濉炲皵鏇茬嚎璺緞锛堝钩婊戞洸绾匡級
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += " C " + cp1x.toFixed(1) + " " + cp1y.toFixed(1) + ", " + cp2x.toFixed(1) + " " + cp2y.toFixed(1) + ", " + p2.x.toFixed(1) + " " + p2.y.toFixed(1);
  }
  return d;
}

const FONT = "'SF Pro Display', -apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";

// 鏋佺畝鐗堬細鏍囬 + 澧為暱鏇茬嚎 + 鍧愭爣杞达紝鏃犲浘渚嬫棤闄勫姞淇℃伅
function renderSvg(points, updated) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const pts = dedupeX(points);
  const t0 = new Date(pts[0].at).getTime();
  const t1 = new Date(pts[pts.length - 1].at).getTime();
  const spanMs = t1 - t0;
  const maxStars = pts[pts.length - 1].stars;
  const step = niceStep(Math.max(maxStars, 1) / 4);
  const yMax = Math.ceil(Math.max(maxStars, step) / step) * step;

  const px = (at) => {
    const t = new Date(at).getTime();
    if (spanMs === 0) return PAD.left + plotW / 2;
    return PAD.left + ((t - t0) / spanMs) * plotW;
  };
  const py = (v) => PAD.top + plotH - (v / yMax) * plotH;

  const labelMode = spanMs > 300 * 86400000 ? "ym" : spanMs > 3 * 86400000 ? "md" : "mdhm";

  // 妯悜缃戞牸锛氱粏铏氱嚎
  let grid = "";
  for (let v = 0; v <= yMax; v += step) {
    const y = py(v);
    grid +=
      '<line x1="' + PAD.left + '" y1="' + y.toFixed(1) + '" x2="' + (W - PAD.right) + '" y2="' + y.toFixed(1) +
      '" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="2 5"/>' +
      '<text x="' + (PAD.left - 12) + '" y="' + (y + 4).toFixed(1) + '" font-size="11" fill="#94a3b8" text-anchor="end">' +
      fmt(v) + "</text>";
  }

  // x 杞存爣绛撅細6 涓紝棣栧熬鍒嗗埆 start/end 瀵归綈閬垮厤婧㈠嚭
  const xTicks = 6;
  let xAxis = "";
  for (let i = 0; i < xTicks; i += 1) {
    const frac = spanMs === 0 ? 0 : i / (xTicks - 1);
    const t = t0 + frac * spanMs;
    const x = PAD.left + frac * plotW;
    const anchor = i === 0 ? "start" : i === xTicks - 1 ? "end" : "middle";
    xAxis +=
      '<text x="' + x.toFixed(1) + '" y="' + (H - PAD.bottom + 25) + '" font-size="11" fill="#94a3b8" text-anchor="' + anchor + '">' +
      fmtAxis(new Date(t).toISOString(), labelMode) + "</text>";
  }

  const shape = pts.map((p) => ({ x: px(p.at), y: py(p.stars) }));
  const lineD = smoothPath(shape);
  const areaD = lineD + " L " + (W - PAD.right).toFixed(1) + " " + py(0).toFixed(1) + " L " + PAD.left + " " + py(0).toFixed(1) + " Z";

  // 鏈楂樹寒鐐癸紙鏇茬嚎缁堢偣锛?  const lastS = shape[shape.length - 1];
  const dots =
    '<circle cx="' + lastS.x.toFixed(1) + '" cy="' + lastS.y.toFixed(1) + '" r="4.5" fill="#4f46e5" stroke="#ffffff" stroke-width="2"/>';

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H +
    '" role="img" aria-label="' + REPO + ' star history">' +
    "<defs>" +
    '<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#4f46e5" stop-opacity="0.18"/>' +
    '<stop offset="1" stop-color="#4f46e5" stop-opacity="0"/>' +
    "</linearGradient>" +
    "</defs>" +
    '<rect width="' + W + '" height="' + H + '" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>' +
    grid +
    '<path d="' + areaD + '" fill="url(#areaGrad)"/>' +
    '<path d="' + lineD + '" fill="none" stroke="#4f46e5" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"/>' +
    dots +
    xAxis +
    "</svg>"
  );
}

// ---------- CLI ----------

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : ".";
  if (!outDir) die("--out <dir> 蹇呭～");
  if (cmd === "bootstrap") await bootstrap(outDir);
  else if (cmd === "snapshot") await snapshot(outDir);
  else die("鐢ㄦ硶: node star-history.mjs <bootstrap|snapshot> --out <dir>");
}

main().catch((e) => {
  console.error("error: " + (e && e.message ? e.message : e));
  process.exit(1);
});
