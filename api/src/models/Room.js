const { Schema, model } = require('mongoose');

const ScoreSchema = new Schema(
  { runs: { type: Number, default: 0 }, wickets: { type: Number, default: 0 } },
  { _id: false }
);

const TeamSchema = new Schema(
  {
    code: String,        // "MI"
    name: String,        // "Mumbai Indians"
    color: String,       // "#004BA0"
    score: { type: ScoreSchema, default: () => ({}) },
  },
  { _id: false }
);

const schema = new Schema({
  match_id: { type: String, required: true, unique: true },
  match_title: String,
  match_number: String,   // "1st Match", "2nd Match", …
  venue: String,
  match_date: Date,
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },

  team_a: TeamSchema,
  team_b: TeamSchema,

  // Game state
  innings: { type: Number, default: 1 },          // 1 or 2
  balls_bowled: { type: Number, default: 0 },     // 0-120 per innings
  batting_team: String,                            // team code: "MI"
  target: Number,                                  // 2nd innings target
  result: String,                                  // "MI won by 5 wickets"
  current_over_balls: { type: Array, default: [] }, // ball results for the live over

  // Private room fields
  isPrivate: { type: Boolean, default: false, index: true },
  inviteCode: { type: String, sparse: true },      // unique invite code
  owner_id: { type: Schema.Types.ObjectId, ref: 'User' },
  linked_match_id: String,                         // public match_id this private room follows
  isPaid: { type: Boolean, default: false },
}, { timestamps: true });

// Virtual: "16.2" style over display
schema.virtual('current_over').get(function () {
  return `${Math.floor(this.balls_bowled / 6)}.${this.balls_bowled % 6}`;
});

schema.set('toJSON', { virtuals: true });

module.exports = model('Room', schema);
