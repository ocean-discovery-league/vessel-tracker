export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, body, vessel, zone, timestamp } = req.body || {};
  if (!title || !zone) return res.status(400).json({ error: 'Missing required fields' });

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.NOTIFY_EMAIL;
  if (!apiKey || !toEmail) return res.status(500).json({ error: 'Email not configured' });

  const when = timestamp ? new Date(timestamp).toUTCString() : new Date().toUTCString();

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0E2446;color:#e0e6f0;border-radius:8px;overflow:hidden;">
      <div style="background:#041828;padding:16px 20px;border-bottom:3px solid #81e1e7;">
        <span style="font-size:18px;font-weight:700;color:#81e1e7;letter-spacing:1px;">⚠ VESSEL ZONE INTERSECTION</span>
      </div>
      <div style="padding:20px;">
        <p style="margin:0 0 12px;font-size:15px;font-weight:700;color:#fff;">${title}</p>
        <p style="margin:0 0 16px;font-size:13px;color:#c8ddf0;">${body || ''}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr><td style="padding:6px 10px;background:#041018;color:#41B9C3;width:100px;">Vessel</td><td style="padding:6px 10px;background:#041018;color:#e0e6f0;">${vessel || '—'}</td></tr>
          <tr><td style="padding:6px 10px;background:#061420;color:#41B9C3;">Zone</td><td style="padding:6px 10px;background:#061420;color:#e0e6f0;">${zone}</td></tr>
          <tr><td style="padding:6px 10px;background:#041018;color:#41B9C3;">Time (UTC)</td><td style="padding:6px 10px;background:#041018;color:#e0e6f0;">${when}</td></tr>
        </table>
      </div>
      <div style="padding:10px 20px;background:#041018;font-size:10px;color:#41B9C3;">Ocean Discovery League — Vessel Zone Monitor</div>
    </div>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Vessel Monitor <onboarding@resend.dev>',
      to: [toEmail],
      subject: `🚢 Zone Intersection: ${vessel || 'Vessel'} → ${zone}`,
      html
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return res.status(500).json({ error: 'Resend error', detail: err });
  }

  return res.status(200).json({ ok: true });
}
