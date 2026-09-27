//below 2 lines for windows only  connecting to mongodb 
// atlas  because Windows DNS was refusing it.

import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import mongoose from "mongoose";

// Opens MongoDB from MONGODB_URI. The API starts only after this succeeds.
export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing");
  }

  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
