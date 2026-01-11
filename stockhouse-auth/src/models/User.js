import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },

    email: { type: String, required: true, unique: true, lowercase: true, index: true },

    passwordHash: { type: String, required: true },

    userType: { type: String, enum: ["investor", "homeowner", "admin"], default: "investor" },

    stripeCustomerId: { type: String }, // fill later

    lastLoginAt: { type: Date }
    ,
    investments: [
      {
        propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
        shareCount: { type: Number, default: 0 },
        sharePrice: { type: Number, default: 0 },
        totalCost: { type: Number, default: 0 },
        purchaseDate: { type: Date },
        transactionId: { type: String },
        ownershipPercent: { type: Number, default: 0 }
      }
    ]
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("User", userSchema);
