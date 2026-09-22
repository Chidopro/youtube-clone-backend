/**
 * Seed MaxFreedom tour analytics: 180 sales this week
 * (60 creator / 60 Gee / 60 Pom). Gee is paid; Pom stays unpaid.
 * Keeps the existing ScreenMerch $222 payment and adds a newer payout
 * so $222 moves into payment history.
 *
 *   node backend/seed_maxfreedom_demo_sales.mjs
 *
 * Credentials: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or add_test_sale.py.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOUR_TITLE_PREFIX = 'Tour sample';
const TOUR_ORDER_PREFIX = 'TOUR-MF-';
const PRIOR_TITLE_PREFIX = 'Earlier sample';
const PRIOR_ORDER_PREFIX = 'EARLY-MF-';
const TOUR_PAYOUT_NOTE = 'Method: paypal';
const TOUR_GEE_NOTE = 'PayPal';
const CREATOR_SHARE = 6;
const WEEK_SALES = 180;
const PER_BUCKET = 60;
const PRIOR_PAYOUT_AMOUNT = 222;
const PRIOR_SALES = PRIOR_PAYOUT_AMOUNT / CREATOR_SHARE; // 37 items cover the Sep 5 $222 payment
const SCREENMERCH_WEEK_PAYOUT = PER_BUCKET * 3 * CREATOR_SHARE; // $1,080
const GEE_PAYOUT = PER_BUCKET * CREATOR_SHARE; // $360

function credentials() {
  const helper = path.join(__dirname, 'add_test_sale.py');
  const src = fs.existsSync(helper) ? fs.readFileSync(helper, 'utf8') : '';
  const urlMatch = src.match(/SUPABASE_URL = "([^"]+)"/);
  const keyMatch = src.match(/supabase_key = "([^"]+)"/);
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    (urlMatch && urlMatch[1]);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || (keyMatch && keyMatch[1]);
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function rest(method, table, { query = '', body, prefer } = {}) {
  const { url, key } = credentials();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers.Prefer = prefer || 'return=representation';
  } else if (prefer) {
    headers.Prefer = prefer;
  }
  const res = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg = typeof data === 'object' ? JSON.stringify(data) : text;
    throw new Error(`${method} ${table} ${res.status}: ${msg}`);
  }
  return { data, count: res.headers.get('content-range') };
}

const PRODUCTS = [
  { name: 'T-Shirt', price: 23.69, image: 'https://screenmerch.fly.dev/static/images/guidonteepreview.png' },
  { name: "Women's Shirt", price: 25.69, image: 'https://screenmerch.fly.dev/static/images/womenshirtpreview.png' },
  { name: "Men's Tank Top", price: 26.23, image: 'https://screenmerch.fly.dev/static/images/menstanktoppreview.png' },
  { name: 'Hoodie', price: 35.35, image: 'https://screenmerch.fly.dev/static/images/testedpreview.png' },
  { name: 'Kids Shirt', price: 25.49, image: 'https://screenmerch.fly.dev/static/images/kidshirtpreview.png' },
  { name: 'Distressed Dad Hat', price: 27.99, image: 'https://screenmerch.fly.dev/static/images/hatsdistresseddadhatpreview.png' },
  { name: 'White Glossy Mug', price: 18.99, image: 'https://screenmerch.fly.dev/static/images/mugwhiteglossymugpreview.png' },
];

const VIDEOS = [
  'Freedom Weekend Highlights',
  'Studio Session — Unreleased',
  'Tour Diary: Night One',
  'Fan Q&A Livestream',
];

function daysAgoIso(days, hour = 14, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 12, 0);
  return d.toISOString();
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function listLabel(list) {
  return `${list.display_name || ''} ${list.slug || ''}`.toLowerCase();
}

function findCollabList(lists, ownerId, needle) {
  const want = String(needle || '').toLowerCase();
  const ranked = (lists || []).filter((list) => {
    const isCollab = String(list.owner_user_id || '') !== String(ownerId);
    if (!isCollab) return false;
    const slug = String(list.slug || '').toLowerCase();
    const name = listLabel(list);
    return slug === want || new RegExp(`\\b${want}\\b`, 'i').test(name);
  });
  return ranked[0] || null;
}

async function deleteWhere(table, query) {
  try {
    const { data } = await rest('DELETE', table, {
      query,
      prefer: 'return=representation',
    });
    return Array.isArray(data) ? data.length : 0;
  } catch (err) {
    console.warn(`Delete ${table} skipped:`, err.message);
    return 0;
  }
}

async function deleteByIds(table, ids) {
  if (!ids.length) return 0;
  let removed = 0;
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const query = `?id=in.(${chunk.join(',')})`;
    removed += await deleteWhere(table, query);
  }
  return removed;
}

async function insertAdaptive(table, rows, optionalCols = []) {
  if (!rows.length) return [];
  const payload = rows.map((row) => ({ ...row }));
  let lastErr = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const { data } = await rest('POST', table, { body: payload });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      lastErr = err;
      const msg = String(err.message || '');
      const missing = msg.match(/Could not find the '([^']+)' column/i)
        || msg.match(/column (?:[\w]+\.)?([A-Za-z_][\w]*) does not exist/i)
        || msg.match(/Could not find the '([^']+)'/i);
      const col = missing && missing[1];
      if (col && payload.some((row) => col in row)) {
        for (const row of payload) delete row[col];
        continue;
      }
      const drop = optionalCols.find((name) => payload.some((row) => name in row) && msg.includes(name));
      if (drop) {
        for (const row of payload) delete row[drop];
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function main() {
  let users;
  try {
    users = await rest('GET', 'users', {
      query: '?subdomain=eq.maxfreedom&select=id,email,display_name,username,subdomain,role,paypal_email&limit=1',
    });
  } catch {
    users = await rest('GET', 'users', {
      query: '?subdomain=eq.maxfreedom&select=id,email,display_name,username,subdomain,role&limit=1',
    });
  }
  if (!users.data?.length) throw new Error('No users row with subdomain=maxfreedom');
  const owner = users.data[0];
  const uid = owner.id;
  const creatorName = owner.display_name || owner.username || 'MAXFreedom';
  console.log('Maxfreedom user', { id: uid, name: creatorName, email: owner.email });

  let lists = [];
  try {
    const listRes = await rest('GET', 'creator_favorite_lists', {
      query: `?storefront_owner_id=eq.${uid}&select=id,display_name,slug,owner_user_id,storefront_owner_id`,
    });
    lists = listRes.data || [];
  } catch (err) {
    console.warn('storefront_owner_id list query failed:', err.message);
  }
  if (!lists.length) {
    const listRes = await rest('GET', 'creator_favorite_lists', {
      query: `?or=(storefront_owner_id.eq.${uid},owner_user_id.eq.${uid})&select=id,display_name,slug,owner_user_id,storefront_owner_id`,
    });
    lists = listRes.data || [];
  }
  console.log(
    'Favorite lists',
    lists.map((l) => ({
      id: l.id,
      name: l.display_name,
      slug: l.slug,
      owner: l.owner_user_id,
      storefront: l.storefront_owner_id,
    }))
  );

  async function listForOwner(ownerUserId) {
    const found = lists.find((l) => String(l.owner_user_id || '') === String(ownerUserId));
    if (found) return found;
    const extra = await rest('GET', 'creator_favorite_lists', {
      query: `?owner_user_id=eq.${ownerUserId}&select=id,display_name,slug,owner_user_id,storefront_owner_id&limit=5`,
    }).catch(() => ({ data: [] }));
    const row = (extra.data || [])[0];
    if (row) lists.push(row);
    return row || null;
  }

  let geeList = findCollabList(lists, uid, 'gee');
  let pomList = findCollabList(lists, uid, 'pom');
  if (!geeList) geeList = await listForOwner('9d8ecd1a-0d2d-4300-a171-2cdc7ee1cc0d');
  if (!pomList) pomList = await listForOwner('eaf8268a-fa86-4564-befc-51a5c362401d');
  if (!geeList) throw new Error('Could not find Gee collaborator favorites list on maxfreedom');
  if (!pomList) throw new Error('Could not find Pom collaborator favorites list on maxfreedom');

  const ownerList = lists.find((l) => String(l.owner_user_id || '') === String(uid)) || null;
  console.log('Buckets', {
    ownerList: ownerList && { id: ownerList.id, name: ownerList.display_name },
    gee: { id: geeList.id, name: geeList.display_name, owner: geeList.owner_user_id },
    pom: { id: pomList.id, name: pomList.display_name, owner: pomList.owner_user_id },
  });

  const existingPayouts = await rest('GET', 'payouts', {
    query: `?user_id=eq.${uid}&select=id,amount,status,payout_date,processed_date,created_at,notes`,
  });
  console.log(
    'Existing ScreenMerch payouts',
    (existingPayouts.data || []).map((p) => ({
      id: p.id,
      amount: p.amount,
      notes: p.notes,
      payout_date: p.payout_date || p.processed_date || p.created_at,
    }))
  );

  const existingSales = await rest('GET', 'sales', {
    query: `?user_id=eq.${uid}&select=id,video_title,created_at,favorite_list_id&limit=2000`,
  });
  // Replace every MaxFreedom sale so the $222 history payment is covered by
  // 37 older items and does not eat into this week's 180.
  const allSaleIds = (existingSales.data || []).map((row) => row.id).filter(Boolean);
  const removedSales = await deleteByIds('sales', allSaleIds);

  const existingEarnings = await rest('GET', 'creator_earnings', {
    query: `?user_id=eq.${uid}&select=id,order_id&limit=2000`,
  }).catch(() => ({ data: [] }));
  const allEarnIds = (existingEarnings.data || []).map((row) => row.id).filter(Boolean);
  const removedEarnings = await deleteByIds('creator_earnings', allEarnIds);

  const removedTourPayouts = (existingPayouts.data || [])
    .filter((row) => {
      const notes = String(row.notes || '');
      const amount = Number(row.amount || 0);
      const paid = String(row.payout_date || '');
      return notes.includes('Tour sample week')
        || (amount === SCREENMERCH_WEEK_PAYOUT && paid.startsWith('2026-09-15'));
    })
    .map((row) => row.id)
    .filter(Boolean);
  await deleteByIds('payouts', removedTourPayouts);

  const existingCollabPays = await rest('GET', 'umbrella_collaborator_payouts', {
    query: `?storefront_owner_id=eq.${uid}&select=id,note,amount,favorite_list_id`,
  }).catch(() => ({ data: [] }));
  const tourCollabIds = (existingCollabPays.data || [])
    .filter((row) => {
      const note = String(row.note || '');
      const amount = Number(row.amount || 0);
      return note.includes('Tour sample')
        || (String(row.favorite_list_id) === String(geeList.id) && amount === GEE_PAYOUT);
    })
    .map((row) => row.id)
    .filter(Boolean);
  const removedGee = await deleteByIds('umbrella_collaborator_payouts', tourCollabIds);
  console.log('Cleared previous tour rows', {
    sales: removedSales,
    earnings: removedEarnings,
    screenmerchPayouts: removedTourPayouts.length,
    collabPayouts: removedGee,
  });

  const remaining = { owner: PER_BUCKET, gee: PER_BUCKET, pom: PER_BUCKET };
  const perDay = [26, 26, 26, 26, 26, 25, 25];
  const plan = [];
  const cycle = ['owner', 'gee', 'pom'];
  let cycleAt = 0;
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const day = 6 - dayIndex;
    for (let k = 0; k < perDay[dayIndex]; k += 1) {
      let bucket = null;
      for (let t = 0; t < 3; t += 1) {
        const candidate = cycle[(cycleAt + t) % 3];
        if (remaining[candidate] > 0) {
          bucket = candidate;
          cycleAt = cycleAt + t + 1;
          break;
        }
      }
      if (!bucket) break;
      remaining[bucket] -= 1;
      plan.push({ day, k, bucket });
    }
  }
  if (plan.length !== WEEK_SALES) {
    throw new Error(`Planned ${plan.length} sales, expected ${WEEK_SALES}`);
  }

  const bucketList = {
    owner: ownerList?.id || null,
    gee: geeList.id,
    pom: pomList.id,
  };

  const makeSale = ({ product, video, createdAt, isCollab, listId }) => {
    const row = {
      user_id: uid,
      product_name: product.name,
      video_title: video,
      creator_name: creatorName,
      image_url: product.image,
      amount: product.price,
      quantity: 1,
      created_at: createdAt,
      owner_fee_type: 'none',
      owner_fee_value: 0,
      owner_fee_per_item: 0,
      owner_fee_amount: 0,
      pay_collaborator_amount: CREATOR_SHARE,
      collaborator_share_before_fee: isCollab ? CREATOR_SHARE : 0,
    };
    if (listId) row.favorite_list_id = listId;
    return row;
  };

  const priorRows = Array.from({ length: PRIOR_SALES }, (_, i) => {
    const product = pick(PRODUCTS, i);
    return makeSale({
      product,
      video: `${PRIOR_TITLE_PREFIX} — ${pick(VIDEOS, i)}`,
      createdAt: `2026-08-${String(12 + (i % 18)).padStart(2, '0')}T${String(12 + (i % 8)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00.000Z`,
      isCollab: false,
      listId: bucketList.owner,
    });
  });

  const rows = plan.map(({ day, k, bucket }, i) => {
    const product = pick(PRODUCTS, i + day);
    return makeSale({
      product,
      video: `${TOUR_TITLE_PREFIX} — ${pick(VIDEOS, i)}`,
      createdAt: daysAgoIso(day, 11 + (k % 10), (i * 11) % 60),
      isCollab: bucket !== 'owner',
      listId: bucketList[bucket],
    });
  });
  const allRows = [...priorRows, ...rows];

  const optionalSaleCols = [
    'owner_fee_type',
    'owner_fee_value',
    'owner_fee_per_item',
    'owner_fee_amount',
    'pay_collaborator_amount',
    'collaborator_share_before_fee',
    'quantity',
    'favorite_list_id',
  ];
  const created = [];
  for (let i = 0; i < allRows.length; i += 60) {
    const chunk = await insertAdaptive('sales', allRows.slice(i, i + 60), optionalSaleCols);
    created.push(...chunk);
  }
  console.log(`Inserted ${created.length} sales (${PRIOR_SALES} earlier + ${WEEK_SALES} this week)`);

  const earnings = created.map((sale, i) => ({
    user_id: uid,
    order_id: `${i < PRIOR_SALES ? PRIOR_ORDER_PREFIX : TOUR_ORDER_PREFIX}${String(sale.id).replace(/-/g, '').slice(0, 10).toUpperCase()}`,
    product_name: sale.product_name,
    sale_amount: allRows[i]?.amount ?? sale.amount,
    creator_share: CREATOR_SHARE,
    platform_fee: CREATOR_SHARE,
    status: 'paid',
  }));
  if (earnings.length) {
    try {
      for (let i = 0; i < earnings.length; i += 60) {
        await insertAdaptive('creator_earnings', earnings.slice(i, i + 60), ['payout_id']);
      }
      console.log(`Inserted ${earnings.length} paid earnings rows`);
    } catch (e) {
      console.warn('creator_earnings insert skipped:', e.message);
    }
  }

  const payoutInserted = await insertAdaptive('payouts', [{
    user_id: uid,
    amount: SCREENMERCH_WEEK_PAYOUT,
    payment_method: 'paypal',
    paypal_email: owner.paypal_email || owner.email || 'unspecified',
    status: 'completed',
    payout_date: '2026-09-15T16:00:00.000Z',
    notes: TOUR_PAYOUT_NOTE,
  }], ['payment_method', 'paypal_email', 'payout_date', 'processed_date', 'notes']);
  console.log('Inserted ScreenMerch payout', {
    id: payoutInserted[0]?.id,
    amount: SCREENMERCH_WEEK_PAYOUT,
    note: TOUR_PAYOUT_NOTE,
  });

  const geePayout = {
    storefront_owner_id: uid,
    favorite_list_id: geeList.id,
    collaborator_user_id: geeList.owner_user_id,
    amount: GEE_PAYOUT,
    paid_at: daysAgoIso(5, 18, 30),
    note: TOUR_GEE_NOTE,
  };
  try {
    await rest('POST', 'umbrella_collaborator_payouts', { body: geePayout, prefer: 'return=minimal' });
    console.log(`Recorded Gee paid $${GEE_PAYOUT.toFixed(2)}; Pom left unpaid $${GEE_PAYOUT.toFixed(2)}`);
  } catch (e) {
    if (geePayout.collaborator_user_id) {
      delete geePayout.collaborator_user_id;
      await rest('POST', 'umbrella_collaborator_payouts', { body: geePayout, prefer: 'return=minimal' });
      console.log(`Recorded Gee paid $${GEE_PAYOUT.toFixed(2)} (without collaborator_user_id)`);
    } else {
      throw e;
    }
  }

  const counts = { owner: 0, gee: 0, pom: 0 };
  for (const item of plan) counts[item.bucket] += 1;
  console.log('Week split', counts);
  console.log('Expected dashboard', {
    thisWeekOrders: WEEK_SALES,
    screenmerchCurrentPayout: SCREENMERCH_WEEK_PAYOUT,
    keepExistingPayment: true,
    gee: { sales: PER_BUCKET, paid: GEE_PAYOUT },
    pom: { sales: PER_BUCKET, owed: GEE_PAYOUT },
    qualifyingItemsThisWeek: WEEK_SALES,
    qualifyingShareThisWeek: SCREENMERCH_WEEK_PAYOUT,
    earlierItemsFor222: PRIOR_SALES,
    creatorSales: PER_BUCKET,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
