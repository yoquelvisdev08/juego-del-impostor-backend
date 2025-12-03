import { Client, Databases, ID } from "node-appwrite"
import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"

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

if (!process.env.APPWRITE_DATABASE_ID) {
  throw new Error("APPWRITE_DATABASE_ID is not defined")
}

const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)

const databases = new Databases(appwriteClient)
const databaseId = process.env.APPWRITE_DATABASE_ID

async function deleteCollection(collectionId: string, collectionName: string) {
  try {
    console.log(`🗑️  Eliminando colección '${collectionName}' (${collectionId})...`)
    await databases.deleteCollection(databaseId, collectionId)
    console.log(`✅ Colección '${collectionName}' eliminada\n`)
    return true
  } catch (error: any) {
    if (error.code === 404) {
      console.log(`⚠️  La colección '${collectionName}' no existe (ya fue eliminada)\n`)
      return true
    }
    console.error(`❌ Error al eliminar '${collectionName}': ${error.message}\n`)
    return false
  }
}

async function createOptimizedGamesCollection() {
  try {
    console.log("📦 Creando colección 'games' optimizada...\n")

    const collectionId = ID.unique()
    const collection = await databases.createCollection(databaseId, collectionId, "games")
    console.log(`✅ Colección 'games' creada con ID: ${collection.$id}\n`)

    console.log("📝 Creando atributos...\n")

    console.log("   Creando 'code' (string, 6, required, unique)...")
    await databases.createStringAttribute(databaseId, collection.$id, "code", 6, true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("   Creando 'gameState' (string, 65535, required)...")
    await databases.createStringAttribute(databaseId, collection.$id, "gameState", 65535, true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("   Creando 'updatedAt' (integer, required)...")
    await databases.createIntegerAttribute(databaseId, collection.$id, "updatedAt", true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("\n   Esperando a que los atributos se finalicen...")
    await new Promise((resolve) => setTimeout(resolve, 5000))

    console.log("\n   Creando índice único para 'code'...")
    try {
      await databases.createIndex(databaseId, collection.$id, "unique_code", "unique", ["code"])
      console.log("   ✅ Índice único creado\n")
    } catch (error: any) {
      console.log("   ⚠️  No se pudo crear el índice único (puede que ya exista)\n")
    }

    console.log("✅ Colección 'games' configurada correctamente")
    console.log("   Atributos: code, gameState, updatedAt (solo 3 atributos)\n")

    return collection.$id
  } catch (error: any) {
    console.error("❌ Error al crear colección 'games':", error.message)
    throw error
  }
}

async function createPlayersCollection() {
  try {
    console.log("📦 Creando colección 'players'...\n")

    const collectionId = ID.unique()
    const collection = await databases.createCollection(databaseId, collectionId, "players")
    console.log(`✅ Colección 'players' creada con ID: ${collection.$id}\n`)

    console.log("📝 Creando atributos...\n")

    console.log("   Creando 'playerId' (string, 255, required)...")
    await databases.createStringAttribute(databaseId, collection.$id, "playerId", 255, true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("   Creando 'name' (string, 255, required)...")
    await databases.createStringAttribute(databaseId, collection.$id, "name", 255, true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("   Creando 'gameCode' (string, 50, required)...")
    await databases.createStringAttribute(databaseId, collection.$id, "gameCode", 50, true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("   Creando 'createdAt' (integer, required)...")
    await databases.createIntegerAttribute(databaseId, collection.$id, "createdAt", true)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("\n   Esperando a que los atributos se finalicen...")
    await new Promise((resolve) => setTimeout(resolve, 3000))

    console.log("\n✅ Colección 'players' configurada correctamente\n")

    return collection.$id
  } catch (error: any) {
    console.error("❌ Error al crear colección 'players':", error.message)
    throw error
  }
}

async function updateEnvFile(gamesCollectionId: string, playersCollectionId: string) {
  try {
    const envPath = path.join(process.cwd(), ".env")
    let envContent = fs.readFileSync(envPath, "utf-8")

    envContent = envContent.replace(
      /APPWRITE_GAMES_COLLECTION_ID=.*/,
      `APPWRITE_GAMES_COLLECTION_ID=${gamesCollectionId}`
    )

    envContent = envContent.replace(
      /APPWRITE_PLAYERS_COLLECTION_ID=.*/,
      `APPWRITE_PLAYERS_COLLECTION_ID=${playersCollectionId}`
    )

    fs.writeFileSync(envPath, envContent, "utf-8")
    console.log("✅ Archivo .env actualizado con los nuevos IDs\n")
  } catch (error: any) {
    console.error("⚠️  No se pudo actualizar el archivo .env:", error.message)
    console.log("\n💡 Actualiza manualmente tu archivo .env con:")
    console.log(`APPWRITE_GAMES_COLLECTION_ID=${gamesCollectionId}`)
    console.log(`APPWRITE_PLAYERS_COLLECTION_ID=${playersCollectionId}\n`)
  }
}

async function main() {
  try {
    console.log("🚀 Recreando colecciones de Appwrite\n")
    console.log("=".repeat(60) + "\n")

    const collections = await databases.listCollections(databaseId)
    const gamesCollection = collections.collections.find((c) => c.name === "games")
    const playersCollection = collections.collections.find((c) => c.name === "players")

    if (gamesCollection) {
      await deleteCollection(gamesCollection.$id, "games")
    }

    if (playersCollection) {
      await deleteCollection(playersCollection.$id, "players")
    }

    console.log("=".repeat(60) + "\n")

    const gamesCollectionId = await createOptimizedGamesCollection()
    const playersCollectionId = await createPlayersCollection()

    console.log("=".repeat(60))
    console.log("✨ Proceso completado!\n")

    await updateEnvFile(gamesCollectionId, playersCollectionId)

    console.log("📋 Resumen:")
    console.log(`   - Colección 'games': ${gamesCollectionId}`)
    console.log(`   - Colección 'players': ${playersCollectionId}\n`)

    console.log("🔍 Ejecuta 'pnpm verify-strict' para verificar la configuración\n")
  } catch (error: any) {
    console.error("❌ Error durante el proceso:", error.message)
    if (error.code === 401) {
      console.error("   Verifica que tu APPWRITE_API_KEY sea válida")
    } else if (error.code === 404) {
      console.error("   Verifica que tu APPWRITE_DATABASE_ID sea correcto")
    }
    process.exit(1)
  }
}

main()

