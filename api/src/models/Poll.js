const { Schema, model } = require('mongoose');

const OptionSchema = new Schema(
  { text: String, votes: { type: Number, default: 0 } },
  { _id: false }
);

const schema = new Schema({
  room_id:    { type: String, required: true, index: true },
  question:   { type: String, required: true, maxlength: 200 },
  options:    [OptionSchema],
  voters:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
  created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  status:     { type: String, enum: ['active', 'closed'], default: 'active' },
  over:       String,
  ends_at:    Date,
  created_at: { type: Date, default: Date.now },
});

schema.index({ room_id: 1, status: 1 });

module.exports = model('Poll', schema);
