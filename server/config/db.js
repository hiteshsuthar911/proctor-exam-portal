/**
 * MongoDB Atlas Connection
 */
const mongoose = require("mongoose");

let isConnected = false;

mongoose.connection.on("connected", () => {
  isConnected = true;
  console.log("✅ MongoDB Atlas connected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("⚠️ MongoDB connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.warn("⚠️ MongoDB disconnected");
});

async function connectDB() {
  if (isConnected) return true;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("\n⚠️  MONGODB_URI environment variable is not set!");
    console.warn("👉 To connect MongoDB Atlas:");
    console.warn("   1. Create a free cluster at https://cloud.mongodb.com");
    console.warn("   2. Add MONGODB_URI to your .env file or Render dashboard.\n");
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    return true;
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err.message);
    return false;
  }
}

function getIsConnected() {
  return isConnected;
}

module.exports = { connectDB, getIsConnected };
