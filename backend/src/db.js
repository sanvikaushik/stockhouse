import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing. Put it in .env in project root.");

  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
