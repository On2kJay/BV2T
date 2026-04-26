import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import express from 'express';

import { query } from './db.js';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 3000);
const OWNER_USERNAME = String(process.env.OWNER_USERNAME || 'on2kjay').trim().toLowerCase();
const SESSION_SECRET = String(process.env.SESSION_SECRET || '').trim();
if (!SESSION_SECRET) throw new Error('SESSION_SECRET is required');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(SESSION_SECRET));

function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase();
}

async function loadSession(req, _res, next) {
  try {
    const sid = req.signedCookies?.sid;
    if (!sid) return next();

    const r = await query(
      `select s.sid, s.user_id, s.expires_at, u.username, u.is_admin
       from sessions s
       join users u on u.id = s.user_id
       where s.sid = $1 and s.expires_at > now()`,
      [sid],
    );
    if (!r.rows.length) return next();

    const row = r.rows[0];
    req.user = {
      id: row.user_id,
      username: row.username,
      isAdmin: !!row.is_admin,
      isOwner: row.username === OWNER_USERNAME,
      sid: row.sid,
      expiresAt: row.expires_at,
    };
    return next();
  } catch (e) {
    return next(e);
  }
}

app.use(loadSession);

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  return next();
}
function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (!req.user.isOwner) return res.status(403).json({ error: 'forbidden' });
  return next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const email = String(req.body?.email || '').trim().slice(0, 200);
    const password = String(req.body?.password || '');

    if (!username || username.length < 3 || username.length > 32) {
      return res.status(400).json({ error: 'invalid_username' });
    }
    if (!password || password.length < 3 || password.length > 200) {
      return res.status(400).json({ error: 'invalid_password' });
    }

    const passHash = await bcrypt.hash(password, 12);

    // Default new-user state mirrors the current client defaults.
    const r = await query(
      `insert into users (username, pass_hash, email, coins, level, luck, arena_auto_win, avatar, title)
       values ($1, $2, $3, 150, 1, false, false, 'elf.svg', 'New Member')
       returning id, username, is_admin`,
      [username, passHash, email || null],
    );

    return res.json({
      id: r.rows[0].id,
      username: r.rows[0].username,
      isAdmin: !!r.rows[0].is_admin,
      isOwner: r.rows[0].username === OWNER_USERNAME,
    });
  } catch (e) {
    // unique violation
    if (String(e?.code) === '23505') return res.status(409).json({ error: 'username_taken' });
    return next(e);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || '');
    if (!username || !password) return res.status(400).json({ error: 'invalid_credentials' });

    const r = await query(`select id, username, pass_hash, is_admin from users where username = $1`, [username]);
    if (!r.rows.length) return res.status(401).json({ error: 'invalid_credentials' });
    const row = r.rows[0];

    const ok = await bcrypt.compare(password, row.pass_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const banned = await query(`select 1 from bans where username = $1`, [username]);
    if (banned.rows.length) return res.status(403).json({ error: 'banned' });

    const sid = crypto.randomBytes(32).toString('hex');
    await query(
      `insert into sessions (sid, user_id, expires_at)
       values ($1, $2, now() + interval '14 days')`,
      [sid, row.id],
    );

    res.cookie('sid', sid, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      username: row.username,
      isAdmin: !!row.is_admin,
      isOwner: row.username === OWNER_USERNAME,
    });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
  try {
    await query(`delete from sessions where sid = $1`, [req.user.sid]);
    res.clearCookie('sid');
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get('/api/me', async (req, res, next) => {
  try {
    if (!req.user) return res.json({ loggedIn: false });
    const r = await query(
      `select username, is_admin, coins, level, luck, arena_auto_win, avatar, title, created_at, last_hourly_coin_claim_at
       from users where id = $1`,
      [req.user.id],
    );
    if (!r.rows.length) return res.json({ loggedIn: false });
    const u = r.rows[0];
    return res.json({
      loggedIn: true,
      username: u.username,
      isAdmin: !!u.is_admin,
      isOwner: u.username === OWNER_USERNAME,
      coins: Number(u.coins || 0),
      level: Number(u.level || 1),
      luck: !!u.luck,
      arenaAutoWin: !!u.arena_auto_win,
      avatar: u.avatar || 'elf.svg',
      title: u.title || 'Member',
      createdAt: u.created_at,
      lastHourlyCoinClaimAt: u.last_hourly_coin_claim_at,
    });
  } catch (e) {
    return next(e);
  }
});

app.get('/api/users/:username', async (req, res, next) => {
  try {
    const username = normalizeUsername(req.params.username);
    if (!username) return res.status(400).json({ error: 'invalid_username' });

    const r = await query(
      `select id, username, coins, level, luck, arena_auto_win, avatar, title, created_at
       from users where username = $1`,
      [username],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });
    const u = r.rows[0];

    const invRows = await query(
      `select blook_name, count from user_inventory where user_id = $1 and count > 0`,
      [u.id],
    );
    const inv = {};
    for (const row of invRows.rows) inv[row.blook_name] = Number(row.count || 0);

    return res.json({
      username: u.username,
      coins: Number(u.coins || 0),
      level: Number(u.level || 1),
      luck: !!u.luck,
      arenaAutoWin: !!u.arena_auto_win,
      avatar: u.avatar || 'elf.svg',
      title: u.title || 'Member',
      createdAt: u.created_at,
      inv,
    });
  } catch (e) {
    return next(e);
  }
});

app.get('/api/inventory/me', requireAuth, async (req, res, next) => {
  try {
    const invRows = await query(
      `select blook_name, count from user_inventory where user_id = $1 and count > 0`,
      [req.user.id],
    );
    const inv = {};
    for (const row of invRows.rows) inv[row.blook_name] = Number(row.count || 0);
    return res.json({ inv });
  } catch (e) {
    return next(e);
  }
});

app.get('/api/chat/global', async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(300, Number(req.query.limit || 220)));
    const r = await query(
      `select m.id, u.username as "from", m.body, m.created_at as ts
       from global_chat_messages m
       join users u on u.id = m.from_user_id
       order by m.id desc
       limit $1`,
      [limit],
    );
    const messages = r.rows
      .reverse()
      .map((x) => ({ id: String(x.id), from: x.from, body: x.body, ts: x.ts }));
    return res.json({ messages });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/chat/global', requireAuth, async (req, res, next) => {
  try {
    const body = String(req.body?.body || '').trim().slice(0, 220);
    if (!body) return res.status(400).json({ error: 'empty' });
    const r = await query(
      `insert into global_chat_messages (from_user_id, body)
       values ($1, $2)
       returning id, created_at`,
      [req.user.id, body],
    );
    return res.json({
      message: {
        id: String(r.rows[0].id),
        from: req.user.username,
        body,
        ts: r.rows[0].created_at,
      },
    });
  } catch (e) {
    return next(e);
  }
});

app.get('/api/news', async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 120)));
    const r = await query(
      `select n.id, u.username as author, n.title, n.body, n.created_at as ts
       from news_posts n
       join users u on u.id = n.author_user_id
       order by n.id desc
       limit $1`,
      [limit],
    );
    const posts = r.rows.map((x) => ({
      id: String(x.id),
      author: x.author,
      title: x.title,
      body: x.body,
      ts: x.ts,
    }));
    return res.json({ posts });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/news', requireOwner, async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim().slice(0, 120);
    const body = String(req.body?.body || '').trim().slice(0, 1500);
    if (!title) return res.status(400).json({ error: 'missing_title' });
    if (!body) return res.status(400).json({ error: 'missing_body' });
    const r = await query(
      `insert into news_posts (author_user_id, title, body)
       values ($1, $2, $3)
       returning id, created_at`,
      [req.user.id, title, body],
    );
    return res.json({ ok: true, post: { id: String(r.rows[0].id), ts: r.rows[0].created_at } });
  } catch (e) {
    return next(e);
  }
});

app.get('/api/posts', async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(300, Number(req.query.limit || 200)));
    const r = await query(
      `select p.id, u.username as author, p.category, p.body, p.created_at as ts
       from community_posts p
       join users u on u.id = p.author_user_id
       order by p.id desc
       limit $1`,
      [limit],
    );
    const posts = r.rows.map((x) => ({
      id: String(x.id),
      author: x.author,
      category: x.category,
      body: x.body,
      ts: x.ts,
    }));
    return res.json({ posts });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/posts', requireAuth, async (req, res, next) => {
  try {
    const category = String(req.body?.category || '').trim().slice(0, 40) || 'general';
    const body = String(req.body?.body || '').trim().slice(0, 500);
    if (!body) return res.status(400).json({ error: 'empty' });
    const r = await query(
      `insert into community_posts (author_user_id, category, body)
       values ($1, $2, $3)
       returning id, created_at`,
      [req.user.id, category, body],
    );
    return res.json({ ok: true, post: { id: String(r.rows[0].id), ts: r.rows[0].created_at } });
  } catch (e) {
    return next(e);
  }
});

app.delete('/api/posts/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });
    const r = await query(
      `delete from community_posts where id = $1 and author_user_id = $2 returning id`,
      [id, req.user.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.get('/api/market', async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query.limit || 300)));
    const r = await query(
      `select l.id, u.username as seller, l.blook_name as blook, l.price_per as price, l.quantity as count, l.created_at as ts
       from market_listings l
       join users u on u.id = l.seller_user_id
       order by l.id desc
       limit $1`,
      [limit],
    );
    return res.json({ listings: r.rows.map((x) => ({ ...x, id: String(x.id) })) });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/market/list', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const blook = String(req.body?.blook || '').trim();
    const price = Number(req.body?.price);
    const count = Number(req.body?.count);
    if (!blook) return res.status(400).json({ error: 'invalid_blook' });
    if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: 'invalid_price' });
    if (!Number.isFinite(count) || count <= 0 || count > 9999) return res.status(400).json({ error: 'invalid_count' });

    await client.query('begin');
    const dec = await client.query(
      `update user_inventory
       set count = count - $3
       where user_id = $1 and blook_name = $2 and count >= $3
       returning count`,
      [req.user.id, blook, count],
    );
    if (!dec.rows.length) {
      await client.query('rollback');
      return res.status(400).json({ error: 'not_enough_inventory' });
    }
    const ins = await client.query(
      `insert into market_listings (seller_user_id, blook_name, price_per, quantity)
       values ($1, $2, $3, $4)
       returning id, created_at`,
      [req.user.id, blook, Math.floor(price), Math.floor(count)],
    );
    await client.query('commit');
    return res.json({ ok: true, listing: { id: String(ins.rows[0].id), ts: ins.rows[0].created_at } });
  } catch (e) {
    try { await client.query('rollback'); } catch (_) {}
    return next(e);
  } finally {
    client.release();
  }
});

app.post('/api/market/buy', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.body?.id);
    const qty = Math.max(1, Math.min(9999, Number(req.body?.count || 1)));
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

    await client.query('begin');
    const listingR = await client.query(
      `select id, seller_user_id, blook_name, price_per, quantity
       from market_listings
       where id = $1
       for update`,
      [id],
    );
    if (!listingR.rows.length) {
      await client.query('rollback');
      return res.status(404).json({ error: 'not_found' });
    }
    const listing = listingR.rows[0];
    if (listing.quantity < qty) {
      await client.query('rollback');
      return res.status(400).json({ error: 'not_enough_quantity' });
    }
    const total = Number(listing.price_per) * qty;

    const buyerCoins = await client.query(
      `update users set coins = coins - $2 where id = $1 and coins >= $2 returning coins`,
      [req.user.id, total],
    );
    if (!buyerCoins.rows.length) {
      await client.query('rollback');
      return res.status(400).json({ error: 'not_enough_coins' });
    }

    await client.query(`update users set coins = coins + $2 where id = $1`, [listing.seller_user_id, total]);

    await client.query(
      `insert into user_inventory (user_id, blook_name, count)
       values ($1, $2, $3)
       on conflict (user_id, blook_name) do update set count = user_inventory.count + excluded.count`,
      [req.user.id, listing.blook_name, qty],
    );

    const newQty = listing.quantity - qty;
    if (newQty <= 0) {
      await client.query(`delete from market_listings where id = $1`, [id]);
    } else {
      await client.query(`update market_listings set quantity = $2 where id = $1`, [id, newQty]);
    }

    await client.query('commit');
    return res.json({ ok: true });
  } catch (e) {
    try { await client.query('rollback'); } catch (_) {}
    return next(e);
  } finally {
    client.release();
  }
});

app.post('/api/market/cancel', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.body?.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

    await client.query('begin');
    const listingR = await client.query(
      `select id, seller_user_id, blook_name, quantity
       from market_listings
       where id = $1
       for update`,
      [id],
    );
    if (!listingR.rows.length) {
      await client.query('rollback');
      return res.status(404).json({ error: 'not_found' });
    }
    const listing = listingR.rows[0];
    if (Number(listing.seller_user_id) !== Number(req.user.id)) {
      await client.query('rollback');
      return res.status(403).json({ error: 'forbidden' });
    }

    await client.query(`delete from market_listings where id = $1`, [id]);
    await client.query(
      `insert into user_inventory (user_id, blook_name, count)
       values ($1, $2, $3)
       on conflict (user_id, blook_name) do update set count = user_inventory.count + excluded.count`,
      [req.user.id, listing.blook_name, Number(listing.quantity || 0)],
    );
    await client.query('commit');
    return res.json({ ok: true });
  } catch (e) {
    try { await client.query('rollback'); } catch (_) {}
    return next(e);
  } finally {
    client.release();
  }
});

app.get('/api/trades/inbox', requireAuth, async (req, res, next) => {
  try {
    const r = await query(
      `select t.id, fu.username as "from", tu.username as "to", t.status, t.created_at as ts
       from trades t
       join users fu on fu.id = t.from_user_id
       join users tu on tu.id = t.to_user_id
       where t.to_user_id = $1
       order by t.id desc
       limit 200`,
      [req.user.id],
    );
    const ids = r.rows.map((x) => Number(x.id));
    const itemsR = ids.length
      ? await query(`select trade_id, side, blook_name, count from trade_items where trade_id = any($1::bigint[])`, [ids])
      : { rows: [] };
    const coinsR = ids.length
      ? await query(`select trade_id, from_coins, to_coins from trade_coins where trade_id = any($1::bigint[])`, [ids])
      : { rows: [] };

    const itemsByTrade = new Map();
    for (const row of itemsR.rows) {
      const key = String(row.trade_id);
      if (!itemsByTrade.has(key)) itemsByTrade.set(key, { from: {}, to: {} });
      itemsByTrade.get(key)[row.side][row.blook_name] = Number(row.count || 0);
    }
    const coinsByTrade = new Map();
    for (const row of coinsR.rows) coinsByTrade.set(String(row.trade_id), row);

    const trades = r.rows.map((t) => {
      const id = String(t.id);
      const items = itemsByTrade.get(id) || { from: {}, to: {} };
      const coins = coinsByTrade.get(id) || { from_coins: 0, to_coins: 0 };
      return {
        id,
        from: t.from,
        to: t.to,
        status: t.status,
        ts: t.ts,
        myOffer: { coins: Number(coins.from_coins || 0), items: items.from },
        theirOffer: { coins: Number(coins.to_coins || 0), items: items.to },
      };
    });

    return res.json({ trades });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/trades', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const toUsername = normalizeUsername(req.body?.to);
    if (!toUsername) return res.status(400).json({ error: 'invalid_to' });
    if (toUsername === req.user.username) return res.status(400).json({ error: 'cannot_trade_self' });

    const myOffer = req.body?.myOffer || {};
    const theirOffer = req.body?.theirOffer || {};
    const myCoins = Math.max(0, Math.floor(Number(myOffer.coins || 0)));
    const theirCoins = Math.max(0, Math.floor(Number(theirOffer.coins || 0)));
    const myItems = myOffer.items && typeof myOffer.items === 'object' ? myOffer.items : {};
    const theirItems = theirOffer.items && typeof theirOffer.items === 'object' ? theirOffer.items : {};

    await client.query('begin');
    const toR = await client.query(`select id, username from users where username = $1`, [toUsername]);
    if (!toR.rows.length) {
      await client.query('rollback');
      return res.status(404).json({ error: 'not_found' });
    }
    const toUserId = toR.rows[0].id;

    // Ensure sender has coins + items at request creation time.
    if (myCoins > 0) {
      const coinsR = await client.query(`select coins from users where id = $1`, [req.user.id]);
      if (!coinsR.rows.length || Number(coinsR.rows[0].coins) < myCoins) {
        await client.query('rollback');
        return res.status(400).json({ error: 'not_enough_coins' });
      }
    }
    for (const [blook, c] of Object.entries(myItems)) {
      const count = Math.max(0, Math.floor(Number(c || 0)));
      if (!count) continue;
      const invR = await client.query(
        `select count from user_inventory where user_id = $1 and blook_name = $2`,
        [req.user.id, blook],
      );
      if (!invR.rows.length || Number(invR.rows[0].count) < count) {
        await client.query('rollback');
        return res.status(400).json({ error: 'not_enough_inventory' });
      }
    }

    const tradeR = await client.query(
      `insert into trades (from_user_id, to_user_id) values ($1, $2) returning id, created_at`,
      [req.user.id, toUserId],
    );
    const tradeId = tradeR.rows[0].id;
    await client.query(
      `insert into trade_coins (trade_id, from_coins, to_coins) values ($1, $2, $3)`,
      [tradeId, myCoins, theirCoins],
    );
    for (const [blook, c] of Object.entries(myItems)) {
      const count = Math.max(0, Math.floor(Number(c || 0)));
      if (!count) continue;
      await client.query(
        `insert into trade_items (trade_id, side, blook_name, count) values ($1, 'from', $2, $3)`,
        [tradeId, blook, count],
      );
    }
    for (const [blook, c] of Object.entries(theirItems)) {
      const count = Math.max(0, Math.floor(Number(c || 0)));
      if (!count) continue;
      await client.query(
        `insert into trade_items (trade_id, side, blook_name, count) values ($1, 'to', $2, $3)`,
        [tradeId, blook, count],
      );
    }
    await client.query('commit');
    return res.json({ ok: true, trade: { id: String(tradeId), ts: tradeR.rows[0].created_at } });
  } catch (e) {
    try { await client.query('rollback'); } catch (_) {}
    return next(e);
  } finally {
    client.release();
  }
});

app.post('/api/trades/:id/decline', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });
    const r = await query(
      `update trades set status = 'declined'
       where id = $1 and to_user_id = $2 and status = 'pending'
       returning id`,
      [id, req.user.id],
    );
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/trades/:id/accept', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'invalid_id' });

    await client.query('begin');
    const tr = await client.query(
      `select id, from_user_id, to_user_id, status from trades where id = $1 for update`,
      [id],
    );
    if (!tr.rows.length) {
      await client.query('rollback');
      return res.status(404).json({ error: 'not_found' });
    }
    const trade = tr.rows[0];
    if (Number(trade.to_user_id) !== Number(req.user.id)) {
      await client.query('rollback');
      return res.status(403).json({ error: 'forbidden' });
    }
    if (trade.status !== 'pending') {
      await client.query('rollback');
      return res.status(400).json({ error: 'not_pending' });
    }

    const coinsR = await client.query(`select from_coins, to_coins from trade_coins where trade_id = $1`, [id]);
    const fromCoins = coinsR.rows.length ? Number(coinsR.rows[0].from_coins || 0) : 0;
    const toCoins = coinsR.rows.length ? Number(coinsR.rows[0].to_coins || 0) : 0;

    const itemsR = await client.query(`select side, blook_name, count from trade_items where trade_id = $1`, [id]);
    const fromItems = {};
    const toItems = {};
    for (const row of itemsR.rows) {
      if (row.side === 'from') fromItems[row.blook_name] = Number(row.count || 0);
      if (row.side === 'to') toItems[row.blook_name] = Number(row.count || 0);
    }

    // Verify balances.
    const fromBal = await client.query(`select coins from users where id = $1 for update`, [trade.from_user_id]);
    const toBal = await client.query(`select coins from users where id = $1 for update`, [trade.to_user_id]);
    if (Number(fromBal.rows[0].coins) < fromCoins) {
      await client.query('rollback');
      return res.status(400).json({ error: 'sender_not_enough_coins' });
    }
    if (Number(toBal.rows[0].coins) < toCoins) {
      await client.query('rollback');
      return res.status(400).json({ error: 'recipient_not_enough_coins' });
    }
    async function requireInv(userId, blook, count) {
      const r = await client.query(`select count from user_inventory where user_id = $1 and blook_name = $2`, [userId, blook]);
      return r.rows.length && Number(r.rows[0].count) >= count;
    }
    for (const [blook, count] of Object.entries(fromItems)) {
      if (count > 0 && !(await requireInv(trade.from_user_id, blook, count))) {
        await client.query('rollback');
        return res.status(400).json({ error: 'sender_not_enough_items' });
      }
    }
    for (const [blook, count] of Object.entries(toItems)) {
      if (count > 0 && !(await requireInv(trade.to_user_id, blook, count))) {
        await client.query('rollback');
        return res.status(400).json({ error: 'recipient_not_enough_items' });
      }
    }

    // Coins transfer.
    if (fromCoins || toCoins) {
      await client.query(`update users set coins = coins - $2 where id = $1`, [trade.from_user_id, fromCoins]);
      await client.query(`update users set coins = coins + $2 where id = $1`, [trade.to_user_id, fromCoins]);
      await client.query(`update users set coins = coins - $2 where id = $1`, [trade.to_user_id, toCoins]);
      await client.query(`update users set coins = coins + $2 where id = $1`, [trade.from_user_id, toCoins]);
    }

    async function decInv(userId, blook, count) {
      const r = await client.query(
        `update user_inventory set count = count - $3 where user_id = $1 and blook_name = $2 and count >= $3 returning count`,
        [userId, blook, count],
      );
      return !!r.rows.length;
    }
    async function incInv(userId, blook, count) {
      await client.query(
        `insert into user_inventory (user_id, blook_name, count)
         values ($1, $2, $3)
         on conflict (user_id, blook_name) do update set count = user_inventory.count + excluded.count`,
        [userId, blook, count],
      );
    }

    for (const [blook, count] of Object.entries(fromItems)) {
      if (!count) continue;
      if (!(await decInv(trade.from_user_id, blook, count))) {
        await client.query('rollback');
        return res.status(400).json({ error: 'sender_not_enough_items' });
      }
      await incInv(trade.to_user_id, blook, count);
    }
    for (const [blook, count] of Object.entries(toItems)) {
      if (!count) continue;
      if (!(await decInv(trade.to_user_id, blook, count))) {
        await client.query('rollback');
        return res.status(400).json({ error: 'recipient_not_enough_items' });
      }
      await incInv(trade.from_user_id, blook, count);
    }

    await client.query(`update trades set status = 'accepted' where id = $1`, [id]);
    await client.query('commit');
    return res.json({ ok: true });
  } catch (e) {
    try { await client.query('rollback'); } catch (_) {}
    return next(e);
  } finally {
    client.release();
  }
});

app.post('/api/admin/add-admin', requireOwner, async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    if (!username) return res.status(400).json({ error: 'invalid_username' });
    if (username === OWNER_USERNAME) return res.json({ ok: true });

    const r = await query(`update users set is_admin = true where username = $1 returning username, is_admin`, [username]);
    if (!r.rows.length) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true, user: { username: r.rows[0].username, isAdmin: !!r.rows[0].is_admin } });
  } catch (e) {
    return next(e);
  }
});

app.post('/api/admin/ban', requireOwner, async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const reason = String(req.body?.reason || '').trim().slice(0, 500) || null;
    if (!username) return res.status(400).json({ error: 'invalid_username' });
    if (username === OWNER_USERNAME) return res.status(400).json({ error: 'cannot_ban_owner' });

    await query(
      `insert into bans (username, reason) values ($1, $2)
       on conflict (username) do update set banned_at = now(), reason = excluded.reason`,
      [username, reason],
    );
    // Drop any active sessions for that user.
    await query(
      `delete from sessions where user_id in (select id from users where username = $1)`,
      [username],
    );
    return res.json({ ok: true });
  } catch (e) {
    return next(e);
  }
});

// Static frontend
app.use(express.static(repoRoot));
app.get('/', (_req, res) => res.sendFile(path.join(repoRoot, 'index.html')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

