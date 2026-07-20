const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    ownerName: { type: String },
    status: { type: String, enum: ['ongoing', 'completed'], default: 'completed' },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    winnerTeamIdx: { type: Number },
    result: { type: String },
    teams: { type: Array, default: [] },
    innings: { type: Array, default: [] },
    metadata: { type: Object, default: {} },
  },
  { strict: false, timestamps: true },
);

matchSchema.index(
  { completedAt: 1 },
  { expireAfterSeconds: 604800, partialFilterExpression: { completedAt: { $exists: true } } },
);

module.exports = mongoose.model('Match', matchSchema);
