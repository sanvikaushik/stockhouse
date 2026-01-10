import mongoose from "mongoose";

const holdingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
    sharesOwned: { type: Number, required: true, default: 0 }
  },
  { timestamps: true, versionKey: false }
);

holdingSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

export default mongoose.model("Holding", holdingSchema);
