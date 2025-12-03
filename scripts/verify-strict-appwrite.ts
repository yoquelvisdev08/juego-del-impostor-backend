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

const REQUIRED_ATTRIBUTES = ["code", "gameState", "updatedAt"]

async function verifyStrictConfiguration() {
  try {
    console.log("🔍 Verificación Estricta de Configuración Appwrite\n")
    console.log("=".repeat(60))

    const collections = await databases.listCollections(databaseId)
    const gamesCollection = collections.collections.find((c) => c.name === "games")

    if (!gamesCollection) {
      console.log("❌ La colección 'games' NO existe")
      console.log("\n💡 Ejecuta: pnpm create-optimized-collection")
      process.exit(1)
    }

    console.log(`\n📦 Colección 'games' encontrada: ${gamesCollection.$id}`)

    const attributes = await databases.listAttributes(databaseId, gamesCollection.$id)
    const attributeKeys = attributes.attributes.map((attr) => attr.key)

    console.log(`\n📋 Atributos encontrados: ${attributes.attributes.length}`)

    const requiredFound: string[] = []
    const requiredMissing: string[] = []
    const extraAttributes: string[] = []

    for (const required of REQUIRED_ATTRIBUTES) {
      if (attributeKeys.includes(required)) {
        requiredFound.push(required)
      } else {
        requiredMissing.push(required)
      }
    }

    for (const attr of attributeKeys) {
      if (!REQUIRED_ATTRIBUTES.includes(attr)) {
        extraAttributes.push(attr)
      }
    }

    console.log("\n" + "=".repeat(60))
    console.log("📊 RESULTADO DE LA VERIFICACIÓN\n")

    if (requiredMissing.length > 0) {
      console.log("❌ ATRIBUTOS REQUERIDOS FALTANTES:")
      requiredMissing.forEach((attr) => {
        console.log(`   - ${attr}`)
      })
      console.log("\n💡 Ejecuta: pnpm create-optimized-collection")
    } else {
      console.log("✅ ATRIBUTOS REQUERIDOS:")
      requiredFound.forEach((attr) => {
        const attrData = attributes.attributes.find((a) => a.key === attr)
        console.log(`   ✅ ${attr} (${attrData?.type}, required: ${attrData?.required})`)
      })
    }

    if (extraAttributes.length > 0) {
      console.log("\n⚠️  ATRIBUTOS ADICIONALES (NO REQUERIDOS):")
      extraAttributes.forEach((attr) => {
        const attrData = attributes.attributes.find((a) => a.key === attr)
        console.log(`   ⚠️  ${attr} (${attrData?.type})`)
      })
      console.log("\n⚠️  IMPORTANTE: Debes tener EXACTAMENTE 3 atributos")
      console.log("   Estos atributos adicionales pueden causar problemas:")
      console.log("   - Pueden alcanzar el límite de columnas de Appwrite")
      console.log("   - No son necesarios (todo se guarda en gameState)")
      console.log("\n💡 RECOMENDACIÓN:")
      console.log("   Elimina estos atributos desde la consola de Appwrite:")
      console.log("   1. Ve a tu colección 'games' en Appwrite Cloud")
      console.log("   2. Ve a la pestaña 'Attributes'")
      console.log("   3. Elimina cada uno de los atributos listados arriba")
      console.log("   4. Deja SOLO: code, gameState, updatedAt")
    } else {
      console.log("\n✅ NO HAY ATRIBUTOS ADICIONALES")
      console.log("   La colección tiene exactamente los 3 atributos requeridos")
    }

    console.log("\n" + "=".repeat(60))

    if (requiredMissing.length === 0 && extraAttributes.length === 0) {
      console.log("\n✅ CONFIGURACIÓN CORRECTA")
      console.log("   La colección 'games' tiene exactamente 3 atributos:")
      console.log("   - code (String, required, unique)")
      console.log("   - gameState (String, required)")
      console.log("   - updatedAt (Integer, required)")
      console.log("\n✅ Todo está configurado según VERIFICACION_APPWRITE.md")
    } else {
      console.log("\n⚠️  CONFIGURACIÓN INCOMPLETA O INCORRECTA")
      if (requiredMissing.length > 0) {
        console.log(`   Faltan ${requiredMissing.length} atributos requeridos`)
      }
      if (extraAttributes.length > 0) {
        console.log(`   Hay ${extraAttributes.length} atributos adicionales que deben eliminarse`)
      }
      console.log("\n💡 Sigue las instrucciones arriba para corregir la configuración")
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

verifyStrictConfiguration()

