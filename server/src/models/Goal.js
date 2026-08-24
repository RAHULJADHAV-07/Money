import mongoose from 'mongoose';

const goalSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name:     { type: String, required: true, trim: true },
    target:   { type: Number, default: 0, min: 0 },
    color:    { type: String, default: '#2f9e6f' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Goal', goalSchema);
