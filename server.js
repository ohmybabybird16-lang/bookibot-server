require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const app = express();
app.use(cors());
app.use(express.json());
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const usageStore = {};
function getUsageKey(salonId) {
  const now = new Date();
  return `${salonId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function incrementUsage(salonId) {
  const key = getUsageKey(salonId);
  usageStore[key] = (usageStore[key] || 0) + 1;
}
function buildSystemPrompt(salonConfig) {
  const { name, services, hours, location, notes } = salonConfig || {};
  let prompt = `You are a helpful booking assistant for a salon`;
  if (name) prompt += ` called "${name}"`;
  prompt += `. Help customers book appointments and answer questions.`;
  if (location) prompt += `\n\nLocation: ${location}`;
  if (hours) prompt += `\n\nHours: ${hours}`;
  if (services) prompt += `\n\nServices: ${Array.isArray(services) ? services.join(', ') : services}`;
  if (notes) prompt += `\n\nNotes: ${notes}`;
  prompt += `\n\nBe friendly and concise. Collect name, service, date/time and contact number for bookings.`;
  return prompt;
}
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/usage', (req, res) => {
  const result = {};
  for (const [key, count] of Object.entries(usageStore)) {
    const [salonId, month] = key.split(':');
    if (!result[salonId]) result[salonId] = {};
    result[salonId][month] = count;
  }
  res.json(result);
});
app.post('/chat', async (req, res) => {
  const { messages, salonConfig } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  const salonId = salonConfig?.name?.toLowerCase().replace(/\s+/g, '_') || 'default';
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: buildSystemPrompt(salonConfig),
      messages: messages,
    });
    incrementUsage(salonId);
    res.json({ reply: response.content[0].text });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to get response' });
  }
});
app.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('Server running'));
