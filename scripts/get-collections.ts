import { Client, Databases } from "node-appwrite"
import * as dotenv from "dotenv"

dotenv.config()

if (!process.env.APPWRITE_ENDPOINT) {
  throw new Error("APPWRITE_ENDPOINT is not defined")
}

if (!process.env.APPWRITE_PROJECT_ID) {
  throw new Error("APPWRITE_PROJECT_ID is not defined")
}

if (!process.env.APPWRITE_API_KEY) {
  throw new Error("APPWRITE_API_KEY is not defined")
}

const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)

const databases = new Databases(appwriteClient)

async function getCollections() {
  try {
    const databaseId = process.env.APPWRITE_DATABASE_ID

    if (!databaseId) {
      console.error("❌ APPWRITE_DATABASE_ID no está definido en .env")
      process.exit(1)
    }

    console.log("🔍 Buscando colecciones en la base de datos...\n")

    const response = await databases.listCollections(databaseId)

    if (response.collections.length === 0) {
      console.log("⚠️  No se encontraron colecciones en la base de datos.")
      console.log("\n📝 Necesitas crear las siguientes colecciones:")
      console.log("   - games")
      console.log("   - players")
      process.exit(0)
    }

    console.log("✅ Colecciones encontradas:\n")

    const gamesCollection = response.collections.find((c) => c.name === "games")
    const playersCollection = response.collections.find((c) => c.name === "players")

    if (gamesCollection) {
      console.log(`📦 games`)
      console.log(`   ID: ${gamesCollection.$id}`)
      console.log("")
    }

    if (playersCollection) {
      console.log(`📦 players`)
      console.log(`   ID: ${playersCollection.$id}`)
      console.log("")
    }

    if (response.collections.length > 0 && !gamesCollection && !playersCollection) {
      response.collections.forEach((collection) => {
        console.log(`📦 ${collection.name}`)
        console.log(`   ID: ${collection.$id}`)
        console.log("")
      })
    }

    console.log("\n💡 Agrega estos IDs a tu archivo .env:\n")
    if (gamesCollection) {
      console.log(`APPWRITE_GAMES_COLLECTION_ID=${gamesCollection.$id}`)
    } else {
      console.log("APPWRITE_GAMES_COLLECTION_ID=<crear-coleccion-games>")
    }

    if (playersCollection) {
      console.log(`APPWRITE_PLAYERS_COLLECTION_ID=${playersCollection.$id}`)
    } else {
      console.log("APPWRITE_PLAYERS_COLLECTION_ID=<crear-coleccion-players>")
    }
    console.log("")
  } catch (error: any) {
    console.error("❌ Error al obtener colecciones:", error.message)
    if (error.code === 401) {
      console.error("   Verifica que tu APPWRITE_API_KEY sea válida")
    } else if (error.code === 404) {
      console.error("   Verifica que tu APPWRITE_DATABASE_ID sea correcto")
    }
    process.exit(1)
  }
}

getCollections()

