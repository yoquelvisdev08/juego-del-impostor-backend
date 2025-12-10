// Script para crear la colección de estadísticas en Appwrite
import { Client, Databases, ID } from "node-appwrite"
import * as dotenv from "dotenv"

// Cargar variables de entorno
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
const statsCollectionId = process.env.APPWRITE_STATS_COLLECTION_ID || "game_stats"

async function createStatsCollection() {
  try {
    console.log("Creando colección de estadísticas...")

    // Crear la colección
    const collection = await databases.createCollection(
      databaseId,
      statsCollectionId,
      "Game Statistics"
    )

    console.log("✅ Colección creada:", collection.$id)
    console.log("\n📝 Creando atributos...\n")

    // Crear atributos uno por uno con delays
    const attributes = [
      { key: "gameId", type: "string", size: 255, required: true },
      { key: "code", type: "string", size: 10, required: true },
      { key: "winner", type: "string", size: 10, required: true },
      { key: "round", type: "integer", required: true },
      { key: "maxRounds", type: "integer", required: true },
      { key: "impostorId", type: "string", size: 255, required: false },
      { key: "impostorName", type: "string", size: 100, required: false },
      { key: "playerCount", type: "integer", required: true },
      { key: "createdAt", type: "integer", required: true },
      { key: "endedAt", type: "integer", required: true },
      { key: "duration", type: "integer", required: true },
      { key: "totalPoints", type: "string", size: 200, required: true },
      { key: "cluesGiven", type: "integer", required: true },
      { key: "votesCast", type: "integer", required: true },
    ]

    for (const attr of attributes) {
      try {
        console.log(`   Creando '${attr.key}' (${attr.type}${attr.type === "string" ? `, ${attr.size}` : ""}, ${attr.required ? "required" : "optional"})...`)
        if (attr.type === "string") {
          await databases.createStringAttribute(
            databaseId,
            statsCollectionId,
            attr.key,
            attr.size,
            attr.required
          )
        } else if (attr.type === "integer") {
          await databases.createIntegerAttribute(
            databaseId,
            statsCollectionId,
            attr.key,
            attr.required
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 2000)) // Delay entre atributos
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`   ⚠ Atributo '${attr.key}' ya existe`)
        } else {
          console.error(`   ✗ Error creando '${attr.key}':`, error.message)
        }
      }
    }

    console.log("\n   Esperando a que los atributos se finalicen...")
    await new Promise((resolve) => setTimeout(resolve, 5000))

    console.log("\n✅ Atributos creados correctamente")

    // Crear índices para consultas rápidas
    console.log("\n📊 Creando índices...\n")

    const indices = [
      { name: "idx_winner", key: "winner", type: "key", order: "ASC" },
      { name: "idx_impostorId", key: "impostorId", type: "key", order: "ASC" },
      { name: "idx_createdAt", key: "createdAt", type: "key", order: "DESC" },
      { name: "idx_endedAt", key: "endedAt", type: "key", order: "DESC" },
      { name: "idx_winner_endedAt", keys: ["winner", "endedAt"], orders: ["ASC", "DESC"] },
    ]

    for (const idx of indices) {
      try {
        if (idx.keys) {
          // Índice compuesto
          console.log(`   Creando índice compuesto '${idx.name}'...`)
          await databases.createIndex(
            databaseId,
            statsCollectionId,
            idx.name,
            "key",
            idx.keys,
            idx.orders
          )
        } else {
          // Índice simple
          console.log(`   Creando índice '${idx.name}' en '${idx.key}'...`)
          await databases.createIndex(
            databaseId,
            statsCollectionId,
            idx.name,
            "key",
            [idx.key],
            [idx.order]
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 2000))
      } catch (error: any) {
        if (error.code === 409) {
          console.log(`   ⚠ Índice '${idx.name}' ya existe`)
        } else {
          console.error(`   ✗ Error creando índice '${idx.name}':`, error.message)
        }
      }
    }

    console.log("\n✅ Índices creados correctamente")
    console.log("\n📋 Colección lista para usar!")
    console.log(`Collection ID: ${statsCollectionId}`)
  } catch (error: any) {
    if (error.code === 409) {
      console.log("⚠️  La colección ya existe")
    } else {
      console.error("❌ Error creando colección:", error)
      throw error
    }
  }
}

createStatsCollection()
  .then(() => {
    console.log("\n✅ Script completado")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })

