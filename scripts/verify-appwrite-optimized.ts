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

if (!process.env.APPWRITE_DATABASE_ID) {
  throw new Error("APPWRITE_DATABASE_ID is not defined")
}

const appwriteClient = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)

const databases = new Databases(appwriteClient)
const databaseId = process.env.APPWRITE_DATABASE_ID

const REQUIRED_GAMES_ATTRIBUTES_OPTIMIZED = [
  { key: "code", type: "string", required: true, unique: true },
  { key: "gameState", type: "string", required: true },
  { key: "updatedAt", type: "integer", required: true },
]

const REQUIRED_PLAYERS_ATTRIBUTES = [
  { key: "playerId", type: "string", required: true },
  { key: "name", type: "string", required: true },
  { key: "gameCode", type: "string", required: true },
  { key: "createdAt", type: "integer", required: true },
]

async function verifyCollection(
  collectionName: string,
  requiredAttributes: typeof REQUIRED_GAMES_ATTRIBUTES_OPTIMIZED
) {
  try {
    console.log(`\n📦 Verificando colección '${collectionName}'...`)

    const collections = await databases.listCollections(databaseId)
    const collection = collections.collections.find((c) => c.name === collectionName)

    if (!collection) {
      console.log(`   ❌ La colección '${collectionName}' NO existe`)
      return false
    }

    console.log(`   ✅ Colección encontrada: ${collection.$id}`)

    const attributes = await databases.listAttributes(databaseId, collection.$id)

    console.log(`   📋 Atributos encontrados: ${attributes.attributes.length}`)

    const foundKeys = new Set(attributes.attributes.map((attr) => attr.key))
    const missingAttributes: string[] = []
    const incorrectAttributes: string[] = []

    for (const required of requiredAttributes) {
      if (!foundKeys.has(required.key)) {
        missingAttributes.push(required.key)
        console.log(
          `   ❌ Falta: ${required.key} (${required.type}, required: ${required.required})`
        )
      } else {
        const attr = attributes.attributes.find((a) => a.key === required.key)
        if (attr) {
          const typeMatch =
            (required.type === "string" && attr.type === "string") ||
            (required.type === "integer" && attr.type === "integer") ||
            (required.type === "boolean" && attr.type === "boolean")

          if (!typeMatch) {
            incorrectAttributes.push(required.key)
            console.log(
              `   ⚠️  Tipo incorrecto: ${required.key} (esperado: ${required.type}, actual: ${attr.type})`
            )
          } else {
            const requiredMatch = attr.required === required.required
            if (!requiredMatch) {
              console.log(
                `   ⚠️  Requerido incorrecto: ${required.key} (esperado: ${required.required}, actual: ${attr.required})`
              )
            } else {
              console.log(
                `   ✅ ${required.key} (${required.type}, required: ${required.required}${
                  required.unique ? ", unique: true" : ""
                })`
              )
            }
          }
        }
      }
    }

    if (missingAttributes.length > 0) {
      console.log(`\n   ⚠️  Faltan ${missingAttributes.length} atributos requeridos`)
      return false
    }

    if (incorrectAttributes.length > 0) {
      console.log(`\n   ⚠️  ${incorrectAttributes.length} atributos tienen tipos incorrectos`)
      return false
    }

    console.log(`\n   ✅ Todos los atributos requeridos están presentes y correctos`)

    if (collectionName === "games") {
      console.log(`\n   📊 Estructura optimizada verificada:`)
      console.log(`      - Solo 3 atributos (evita límite de columnas)`)
      console.log(`      - gameState contiene todo el estado del juego en JSON`)
      console.log(`      - Compatible con estructura antigua si existe`)
    }

    return true
  } catch (error: any) {
    console.error(`   ❌ Error al verificar colección: ${error.message}`)
    return false
  }
}

async function verifyEnvironmentVariables() {
  console.log("🔍 Verificando variables de entorno...\n")

  const required = [
    "APPWRITE_ENDPOINT",
    "APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "APPWRITE_DATABASE_ID",
    "APPWRITE_GAMES_COLLECTION_ID",
    "APPWRITE_PLAYERS_COLLECTION_ID",
  ]

  let allPresent = true
  for (const key of required) {
    const value = process.env[key]
    if (!value || value.includes("your-") || value.includes("example")) {
      console.log(`   ❌ ${key}: NO configurado o tiene valor de ejemplo`)
      allPresent = false
    } else {
      console.log(`   ✅ ${key}: Configurado`)
    }
  }

  return allPresent
}

async function main() {
  try {
    console.log("🚀 Verificando configuración de Appwrite (Estructura Optimizada)\n")

    const envOk = await verifyEnvironmentVariables()

    if (!envOk) {
      console.log("\n❌ Algunas variables de entorno no están configuradas correctamente")
      process.exit(1)
    }

    const gamesOk = await verifyCollection("games", REQUIRED_GAMES_ATTRIBUTES_OPTIMIZED)
    const playersOk = await verifyCollection("players", REQUIRED_PLAYERS_ATTRIBUTES)

    console.log("\n" + "=".repeat(60))
    if (gamesOk && playersOk) {
      console.log("✅ APWRITE ESTÁ COMPLETAMENTE CONFIGURADO")
      console.log("   Estructura optimizada verificada (solo 3 atributos en 'games')")
      console.log("   Todas las colecciones y atributos están presentes")
    } else {
      console.log("⚠️  APWRITE TIENE CONFIGURACIÓN INCOMPLETA")
      if (!gamesOk) {
        console.log("   - La colección 'games' necesita ajustes")
        console.log("   - Ejecuta: pnpm create-optimized-collection")
      }
      if (!playersOk) {
        console.log("   - La colección 'players' necesita ajustes")
        console.log("   - Ejecuta: pnpm create-players")
      }
    }
    console.log("=".repeat(60) + "\n")
  } catch (error: any) {
    console.error("❌ Error durante la verificación:", error.message)
    if (error.code === 401) {
      console.error("   Verifica que tu APPWRITE_API_KEY sea válida")
    } else if (error.code === 404) {
      console.error("   Verifica que tu APPWRITE_DATABASE_ID sea correcto")
    }
    process.exit(1)
  }
}

main()

