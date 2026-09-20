import mongoose from "mongoose";
import "@/models";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Reuse the connection across hot reloads in development and warm serverless invocations.
declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("Missing DATABASE_URL environment variable");
    }
    cache.promise = mongoose.connect(databaseUrl);
  }
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Allow a retry on the next request instead of caching a rejected promise.
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
