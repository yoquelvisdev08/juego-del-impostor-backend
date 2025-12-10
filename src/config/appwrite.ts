import { Client, Databases } from "node-appwrite"

if (!process.env.APPWRITE_ENDPOINT) {
  throw new Error("APPWRITE_ENDPOINT is not defined")
}

if (!process.env.APPWRITE_PROJECT_ID) {
  throw new Error("APPWRITE_PROJECT_ID is not defined")
}

if (!process.env.APPWRITE_API_KEY) {
  throw new Error("APPWRITE_API_KEY is not defined")
}

if (!process.env.APPWRITE_DATABASE_ID) {
  throw new Error("APPWRITE_DATABASE_ID is not defined")
}

// Usar node-appwrite para el backend (SDK de servidor)
export const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)

export const databases = new Databases(appwriteClient)

export const APPWRITE_CONFIG = {
  DATABASE_ID: process.env.APPWRITE_DATABASE_ID,
  GAMES_COLLECTION_ID: process.env.APPWRITE_GAMES_COLLECTION_ID || "games",
  PLAYERS_COLLECTION_ID: process.env.APPWRITE_PLAYERS_COLLECTION_ID || "players",
  STATS_COLLECTION_ID: process.env.APPWRITE_STATS_COLLECTION_ID || "game_stats",
} as const

