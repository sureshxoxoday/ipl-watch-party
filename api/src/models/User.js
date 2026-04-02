const { Schema, model } = require('mongoose');

const AVATAR_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#EF4444', '#8B5CF6', '#F97316', '#14B8A6', '#06B6D4',
];

const schema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 2,
    maxlength: 20,
    match: /^[a-z0-9_]+$/,
  },
  password_hash: { type: String, required: true },
  avatar_color: {
    type: String,
    default: () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  },
  created_at: { type: Date, default: Date.now },
});

module.exports = model('User', schema);
