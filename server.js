const express = require('express');
const cors = require('cors');
const https = require('https');
const app = express();
app.use(cors());
app.use(express.json());
const usageStore = {};
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/usage', (req, res) => res.json(usageStore));
app.post('/chat', (req, res) => {
  const { messages, salonConfig } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  const name = (salonConfig && salonConfig.name) || 'the salon';
  const services = (salonConfig && salonConfig.services) || '';
  const hours = (salonConfig && salonConfig.hours) || '';
  const location = (salonConfig && salonConfig.location) || '';
  const notes = (salonConfig && salonConfig.notes) || '';
  const systemPrompt = `You are a friendly booking assistant for ${name}. Help customers book appointments and answer questions. Services: ${services}. Hours: ${hours}. Location: ${location}. Notes: ${notes}. Be concise and collect name, service, date/time and contact number for bookings.`;
  const body = JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, messages: messages });
  const options = {
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Length': Buffer.byteLength(body) }
  };
  const apiReq = https.request(options, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        const reply = parsed.content[0].text;
        usageStore[name] = (usageStore[name] || 0) + 1;
        res.json({ reply });
      } catch(e) { res.status(500).json({ error: 'Parse error' }); }
    });
  });
  apiReq.on('error', (e) => res.status(500).json({ error: e.message }));
  apiReq.write(body);
  apiReq.end();
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('Server running on port ' + PORT));
