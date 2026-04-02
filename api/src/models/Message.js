const { Schema, model } = require('mongoose');

const schema = new Schema({
  room_id:      { type: String, required: true, index: true },
  user_id:      { type: Schema.Types.ObjectId, ref: 'User' },
  username:     { type: String, required: true },
  avatar_color: { type: String, default: '#6366F1' },
  content:      { type: String, required: true, maxlength: 500 },
  type:         { type: String, enum: ['text', 'event'], default: 'text' },
  over:         String,          // "16.2" snapshot of over when sent
  match_event:  String,          // "SIX" | "WICKET" | "FOUR" | null
  created_at:   { type: Date, default: Date.now, index: true },
});

schema.index({ room_id: 1, created_at: -1 });

module.exports = model('Message', schema);
