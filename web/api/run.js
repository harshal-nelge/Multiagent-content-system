// Vercel serverless function: checks the dashboard password, then forwards the request to n8n.
// The n8n address and secrets live in Vercel environment variables, never in the browser.
const crypto = require('crypto');

const FORMATS = ['script', 'carousel', 'image'];
const LIMITS = { format: 20, topic: 300, niche: 300, audience: 300, language: 40, brand_voice: 300, geo: 5, instructions: 2000, image_model: 60 };
const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image'];

const digest = (v) => crypto.createHash('sha256').update(String(v)).digest();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const { N8N_WEBHOOK_URL, DASHBOARD_PASSWORD, N8N_WEBHOOK_SECRET } = process.env;
  if (!N8N_WEBHOOK_URL || !DASHBOARD_PASSWORD) {
    return res.status(500).json({ error: 'Server is not set up. Add N8N_WEBHOOK_URL and DASHBOARD_PASSWORD in Vercel, then redeploy.' });
  }
  if (!crypto.timingSafeEqual(digest(req.headers['x-dashboard-password'] || ''), digest(DASHBOARD_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 1000)); // slows down password guessing
    return res.status(401).json({ error: 'Wrong password.' });
  }

  let input;
  try { input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { input = null; }
  if (!input || typeof input !== 'object') return res.status(400).json({ error: 'Invalid request.' });

  // Forward only known text fields.
  const body = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    if (typeof input[key] === 'string' && input[key].trim()) body[key] = input[key].trim().slice(0, max);
  }
  if (!FORMATS.includes(body.format)) return res.status(400).json({ error: 'Unknown format.' });
  if (body.image_model && !IMAGE_MODELS.includes(body.image_model)) return res.status(400).json({ error: 'Unknown image model.' });

  const headers = { 'Content-Type': 'application/json' };
  if (N8N_WEBHOOK_SECRET) headers['x-factory-key'] = N8N_WEBHOOK_SECRET;

  try {
    const reply = await fetch(N8N_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
    if (reply.ok) return res.status(200).json({ ok: true });
    const why = reply.status === 404 ? 'n8n webhook not found. Is the workflow active?'
      : [401, 403].includes(reply.status) ? 'n8n rejected the request. Check N8N_WEBHOOK_SECRET.'
      : `n8n returned error ${reply.status}.`;
    return res.status(502).json({ error: why });
  } catch {
    return res.status(504).json({ error: 'No reply from n8n. Check n8n Executions before sending again.' });
  }
};
