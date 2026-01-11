import mongoose from "mongoose";

const propertySchema = new mongoose.Schema(
  {
    externalPropertyId: { type: String, required: true, unique: true }, // dataset PROPERTY_ID
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: String,
    zip: String,
    images: [String],

    valuation: Number, // from dataset or your partner’s model

    totalShares: { type: Number, required: true },
    availableShares: { type: Number, required: true },
    sharePrice: { type: Number, required: true },

    perUserShareCap: { type: Number, required: true },

    status: { type: String, enum: ["active", "paused", "fully_allocated"], default: "active" }
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("Property", propertySchema);

