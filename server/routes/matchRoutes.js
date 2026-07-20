const r = require('express').Router();
const M = require('../models/Match');

let lastLiveState = null;
let lastLiveCompletedAt = null;

const getWeekRange = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
};

r.get('/', async (req, res) => {
  const { start, end } = getWeekRange();
  const matches = await M.find({
    isLive: { $ne: true },
    $or: [
      { completedAt: { $gte: start, $lt: end } },
      { startedAt: { $gte: start, $lt: end } },
      { status: 'ongoing' },
    ],
  }).sort({ startedAt: -1 });
  res.json(matches);
});

r.get('/live', async (req, res) => {
  const active = await M.findOne({ isLive: true }).sort({ updatedAt: -1 });
  if (active) return res.json(active.liveState ?? null);

  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const recentCompleted = await M.findOne({ isLive: false, completedAt: { $gte: cutoff } })
    .sort({ completedAt: -1 });
  if (!recentCompleted) return res.json(null);
  res.json(recentCompleted.liveState ?? null);
});

r.put('/live', async (req, res) => {
  const body = req.body || {};
  const payload = {
    isLive: true,
    status: 'ongoing',
    startedAt: body.startedAt || new Date(),
    completedAt: null,
    liveState: body,
  };

  const match = await M.findOneAndUpdate(
    { isLive: true },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  res.json(match);
});

r.delete('/live', async (req, res) => {
  const active = await M.findOne({ isLive: true }).sort({ updatedAt: -1 });
  if (active) {
    lastLiveState = active.liveState ?? null;
    lastLiveCompletedAt = new Date();
  }
  await M.deleteMany({ isLive: true });
  res.json({ ok: true });
});

r.post('/', async (req, res) => {
  const body = req.body;
  if (!body.startedAt) body.startedAt = new Date();
  if (body.status !== 'completed') body.status = 'completed';
  const match = await M.create(body);
  res.json(match);
});

r.put('/:id', async (req, res) => {
  const match = await M.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(match);
});

r.delete('/:id', async (req, res) => {
  await M.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = r;
