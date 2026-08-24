import mongoose from 'mongoose';
import { KIND_LIST } from '../lib/kinds.js';

const transactionSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date:     { type: Date, required: true, default: () => new Date() },
    kind:     { type: String, required: true, enum: KIND_LIST, index: true },
    amount:   { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, default: '' },   // expense
    source:   { type: String, trim: true, default: '' },   // income
    person:   { type: String, trim: true, default: '' },   // lent / borrowed / repayments
    goal:     { type: mongoose.Schema.Types.ObjectId, ref: 'Goal', default: null },
    note:     { type: String, trim: true, default: '' },
    method:   { type: String, trim: true, default: 'Cash' },
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, person: 1, kind: 1 });

export default mongoose.model('Transaction', transactionSchema);
