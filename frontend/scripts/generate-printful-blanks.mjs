/**
 * Generate Printful Flat (no-model) blank mockups per catalog color.
 * Reads PRINTFUL_API_KEY from %TEMP%/pf_api_key.txt
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonPath = path.join(root, 'src/data/printfulColorMockups.json');
const outDir = path.join(root, 'public/printful-blanks');
const blankUrl = 'https://screenmerch.com/blank-print-v2.png';
const key = fs.readFileSync(path.join(process.env.TEMP || '/tmp', 'pf_api_key.txt'), 'utf8').trim().replace(/\r/g, '');

const SIZE_RANK = { XS: 3, S: 1, M: 0, L: 2, XL: 4, '2XL': 5, XXL: 5, '3XL': 6 };

function slug(color) {
  return String(color).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function rateLimitWaitMs(json) {
  const msg = String(json?.error?.message || json?.result || '');
  const m = msg.match(/after (\d+)/i);
  return ((m ? Number(m[1]) : 40) + 2) * 1000;
}

async function pf(url, opts = {}) {
  for (;;) {
    const r = await fetch(url, {
      ...opts,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.headers || {}),
      },
    });
    const j = await r.json();
    if (r.status === 429 || j.code === 429) {
      const wait = rateLimitWaitMs(j);
      console.log(`  rate limit, wait ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    return { status: r.status, json: j };
  }
}

async function sleep(ms) {
  await new Promise((res) => setTimeout(res, ms));
}

async function productColors(id) {
  const r = await fetch(`https://api.printful.com/products/${id}`);
  const j = await r.json();
  const byColor = new Map();
  for (const v of j.result.variants || []) {
    const c = String(v.color || '').trim();
    if (!c) continue;
    const prev = byColor.get(c);
    const rank = SIZE_RANK[v.size] ?? 9;
    if (!prev || rank < prev.rank) byColor.set(c, { id: v.id, rank, size: v.size });
  }
  return [...byColor.entries()].map(([color, v]) => ({ color, variantId: v.id }));
}

async function frontPrintfile(id) {
  const { json } = await pf(`https://api.printful.com/mockup-generator/printfiles/${id}`);
  if (json.code !== 200) throw new Error(`printfiles ${id}: ${json.error?.message || json.result}`);
  const files = json.result.printfiles || [];
  const byId = Object.fromEntries(files.map((f) => [f.printfile_id, f]));
  const vp = json.result.variant_printfiles?.[0];
  const frontId = vp?.placements?.front ?? files[0]?.printfile_id;
  const pf0 = byId[frontId] || files[0];
  const groups = json.result.option_groups || [];
  const group = groups.includes('Flat') ? 'Flat' : groups.find((g) => /^Flat/.test(g)) || groups.find((g) => /Hanger/i.test(g)) || groups[0];
  return {
    width: pf0.width,
    height: pf0.height,
    group,
    options: (json.result.options || []).includes('Front') ? 'Front' : json.result.options?.[0],
  };
}

async function createTask(productId, variantIds, print) {
  const body = {
    variant_ids: variantIds,
    format: 'jpg',
    width: 800,
    option_groups: [print.group],
    options: [print.options],
    files: [{
      placement: 'front',
      image_url: blankUrl,
      position: {
        area_width: print.width,
        area_height: print.height,
        width: 50,
        height: 50,
        top: 0,
        left: 0,
      },
    }],
  };
  const { status, json } = await pf(`https://api.printful.com/mockup-generator/create-task/${productId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (json.code !== 200) {
    throw new Error(`create-task ${productId}: ${status} ${json.error?.message || json.result}`);
  }
  return json.result.task_key;
}

async function waitTask(taskKey) {
  for (let i = 0; i < 40; i++) {
    await sleep(8000);
    const { json } = await pf(`https://api.printful.com/mockup-generator/task?task_key=${taskKey}`);
    const st = json.result?.status;
    if (st === 'completed') return json.result;
    if (st === 'failed') throw new Error(`task ${taskKey} failed: ${json.result?.error || 'unknown'}`);
  }
  throw new Error(`task ${taskKey} timed out`);
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${r.status} ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

const BATCH = 8;
const GAP_MS = 8000;

async function main() {
  const table = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const ids = Object.keys(table).map(Number).sort((a, b) => a - b);
  let done = 0;
  let failed = 0;
  for (const id of ids) {
    const colors = await productColors(id);
    let print;
    try {
      print = await frontPrintfile(id);
    } catch (e) {
      console.error(`skip ${id} printfiles`, e.message);
      failed += colors.length;
      continue;
    }
    const remaining = colors.filter((c) => {
      const dest = path.join(outDir, String(id), `${slug(c.color)}.jpg`);
      return !fs.existsSync(dest);
    });
    console.log(`# ${id} ${remaining.length}/${colors.length} remaining group=${print.group} option=${print.options} print=${print.width}x${print.height}`);
    if (!remaining.length) continue;
    const variantToColor = Object.fromEntries(remaining.map((c) => [c.variantId, c.color]));
    for (let i = 0; i < remaining.length; i += BATCH) {
      const chunk = remaining.slice(i, i + BATCH);
      const variantIds = chunk.map((c) => c.variantId);
      try {
        const taskKey = await createTask(id, variantIds, print);
        const result = await waitTask(taskKey);
        for (const mock of result.mockups || []) {
          const vid = mock.variant_ids?.[0];
          const color = variantToColor[vid];
          if (!color || !mock.mockup_url) continue;
          const dest = path.join(outDir, String(id), `${slug(color)}.jpg`);
          await download(mock.mockup_url, dest);
          table[String(id)][color] = {
            ...(table[String(id)][color] || {}),
            image: `/printful-blanks/${id}/${slug(color)}.jpg`,
            color_code: table[String(id)][color]?.color_code || '',
          };
          done += 1;
        }
        console.log(`  batch ${i / BATCH + 1} ok (${done} saved)`);
      } catch (e) {
        console.error(`  batch fail ${id}`, e.message);
        failed += chunk.length;
      }
      fs.writeFileSync(jsonPath, JSON.stringify(table));
      await sleep(GAP_MS);
    }
  }
  console.log(`done saved=${done} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
