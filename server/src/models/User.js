import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.statics.hash = (plain) => bcrypt.hash(plain, 10);

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Never let the hash escape in an API response.
userSchema.methods.toSafeJSON = function () {
  return { id: this._id, name: this.name, email: this.email, createdAt: this.createdAt };
};

export default mongoose.model('User', userSchema);
