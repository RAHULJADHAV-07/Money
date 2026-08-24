import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    currency:       { type: String, default: '₹' },
    openingBalance: { type: Number, default: 0 },
    categories:     { type: [String], default: ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Misc'] },
    sources:        { type: [String], default: ['Salary', 'Freelance', 'Investment', 'Mom', 'Dad', 'Other'] },
    methods:        { type: [String], default: ['Cash', 'UPI', 'Bank', 'Card'] },
    budgets:        { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

settingsSchema.statics.load = async function (userId) {
  return (await this.findOne({ user: userId })) || this.create({ user: userId });
};

export default mongoose.model('Settings', settingsSchema);
