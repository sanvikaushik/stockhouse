import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    email: { type: String, required: true, unique: true, lowercase: true, index: true },

    passwordHash: { type: String, required: true },

    userType: { type: String, enum: ["investor", "admin"], default: "investor" },

    stripeCustomerId: { type: String }, // fill later

    lastLoginAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("User", userSchema);
