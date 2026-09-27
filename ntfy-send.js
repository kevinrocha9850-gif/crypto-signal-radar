export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const expected = process.env.NTFY_CRON_SECRET;
  if (expected) {
    const provided = req.headers['x-cron-secret'];
    if (provided !== expected) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    return res.status(500).json({ ok: false, error: 'NTFY_TOPIC no configurado en Vercel' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const title = String(body.title || 'Crypto Signal Radar').slice(0, 100);
    const message = String(body.message || '').slice(0, 4000);
    const priority = String(body.priority || 'high');
    const tags = String(body.tags || 'chart_with_upwards_trend');

    const r = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': tags,
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: message
    });

    const text = await r.text();
    return res.status(r.ok ? 200 : 502).json({
      ok: r.ok,
      ntfyStatus: r.status,
      response: text.slice(0, 500)
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
