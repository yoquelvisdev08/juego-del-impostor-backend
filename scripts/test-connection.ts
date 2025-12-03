#!/usr/bin/env tsx
/**
 * Script de prueba de conexión completa
 * Verifica Appwrite, Redis y la funcionalidad básica
 */

import "dotenv/config"
import { Client, Databases } from "node-appwrite"
import Redis from "ioredis"
import { GameService } from "../src/services/game-service"

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
}

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkEnvVar(name: string): boolean {
  const value = process.env[name]
  if (!value || value.includes("your-") || value.includes("example")) {
    log(`❌ ${name} no está configurado o tiene un valor de ejemplo`, "red")
    return false
  }
  log(`✅ ${name} configurado`, "green")
  return true
}

async function testAppwrite(): Promise<boolean> {
  log("\n📦 Probando conexión a Appwrite...", "cyan")

  try {
    const endpoint = process.env.APPWRITE_ENDPOINT
    const projectId = process.env.APPWRITE_PROJECT_ID
    const apiKey = process.env.APPWRITE_API_KEY
    const databaseId = process.env.APPWRITE_DATABASE_ID
    const collectionId = process.env.APPWRITE_GAMES_COLLECTION_ID

    if (!endpoint || !projectId || !apiKey || !databaseId || !collectionId) {
      log("❌ Faltan variables de entorno de Appwrite", "red")
      return false
    }

    const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
    const databases = new Databases(client)

    // Intentar listar documentos (prueba de conexión)
    try {
      await databases.listDocuments(databaseId, collectionId, [])
      log("✅ Conexión a Appwrite exitosa", "green")
      return true
    } catch (error: any) {
      if (error.code === 401 || error.message?.includes("Unauthorized")) {
        log("❌ Error de autenticación en Appwrite", "red")
        log("   Verifica tu API_KEY y permisos", "yellow")
      } else if (error.code === 404) {
        log("❌ Colección o base de datos no encontrada", "red")
        log("   Verifica DATABASE_ID y GAMES_COLLECTION_ID", "yellow")
      } else {
        log(`❌ Error de conexión: ${error.message}`, "red")
      }
      return false
    }
  } catch (error: any) {
    log(`❌ Error inesperado: ${error.message}`, "red")
    return false
  }
}

async function testRedis(): Promise<boolean> {
  log("\n🔴 Probando conexión a Redis...", "cyan")

  try {
    const host = process.env.REDIS_HOST
    const port = parseInt(process.env.REDIS_PORT || "6379")
    const password = process.env.REDIS_PASSWORD
    const tls = process.env.REDIS_TLS === "true"

    if (!host) {
      log("❌ REDIS_HOST no está configurado", "red")
      return false
    }

    const redisConfig: any = {
      host,
      port,
      retryStrategy: () => null, // No reintentar en la prueba
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    }

    if (password) {
      redisConfig.password = password
    }

    // Solo agregar TLS si está explícitamente configurado como "true"
    if (tls) {
      redisConfig.tls = {}
    } else {
      // Asegurarse de que no se use TLS cuando está deshabilitado
      redisConfig.tls = undefined
    }

    const redis = new Redis(redisConfig)

    return new Promise((resolve) => {
      redis.on("connect", () => {
        log("✅ Conexión a Redis exitosa", "green")
        redis.quit()
        resolve(true)
      })

      redis.on("error", (error) => {
        log(`❌ Error de conexión a Redis: ${error.message}`, "red")
        log("   Verifica host, puerto, contraseña y TLS", "yellow")
        redis.quit()
        resolve(false)
      })

      // Timeout después de 5 segundos
      setTimeout(() => {
        log("❌ Timeout al conectar a Redis", "red")
        redis.quit()
        resolve(false)
      }, 5000)
    })
  } catch (error: any) {
    log(`❌ Error inesperado: ${error.message}`, "red")
    return false
  }
}

async function testGameService(): Promise<boolean> {
  log("\n🎮 Probando GameService (crear partida)...", "cyan")

  try {
    const testHostId = `test-${Date.now()}`
    const testHostName = "Test Player"

    const game = await GameService.createGame(testHostId, testHostName)

    if (!game || !game.code) {
      log("❌ No se pudo crear la partida", "red")
      return false
    }

    log(`✅ Partida creada exitosamente: ${game.code}`, "green")

    // Intentar recuperar la partida
    const retrievedGame = await GameService.getGame(game.code)

    if (!retrievedGame || retrievedGame.code !== game.code) {
      log("❌ No se pudo recuperar la partida", "red")
      return false
    }

    log("✅ Partida recuperada exitosamente", "green")

    // Limpiar: eliminar la partida de prueba
    try {
      await GameService.deleteGame(game.code)
      log("✅ Partida de prueba eliminada", "green")
    } catch (error) {
      log("⚠️  No se pudo eliminar la partida de prueba (no crítico)", "yellow")
    }

    return true
  } catch (error: any) {
    log(`❌ Error en GameService: ${error.message}`, "red")
    return false
  }
}

async function main() {
  log("\n" + "=".repeat(60), "blue")
  log("🧪 PRUEBA DE CONEXIÓN COMPLETA", "blue")
  log("=".repeat(60) + "\n", "blue")

  // Verificar variables de entorno
  log("📋 Verificando variables de entorno...", "cyan")
  const envVars = [
    "APPWRITE_ENDPOINT",
    "APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "APPWRITE_DATABASE_ID",
    "APPWRITE_GAMES_COLLECTION_ID",
    "REDIS_HOST",
    "REDIS_PORT",
    "REDIS_PASSWORD",
  ]

  let allEnvVarsOk = true
  for (const varName of envVars) {
    if (!checkEnvVar(varName)) {
      allEnvVarsOk = false
    }
  }

  if (!allEnvVarsOk) {
    log("\n❌ Algunas variables de entorno no están configuradas", "red")
    log("   Revisa tu archivo .env", "yellow")
    process.exit(1)
  }

  // Probar conexiones
  const appwriteOk = await testAppwrite()
  const redisOk = await testRedis()
  const gameServiceOk = appwriteOk && redisOk ? await testGameService() : false

  // Resumen
  log("\n" + "=".repeat(60), "blue")
  log("📊 RESUMEN DE PRUEBAS", "blue")
  log("=".repeat(60), "blue")
  log(`Appwrite:     ${appwriteOk ? "✅ OK" : "❌ FALLO"}`, appwriteOk ? "green" : "red")
  log(`Redis:        ${redisOk ? "✅ OK" : "❌ FALLO"}`, redisOk ? "green" : "red")
  log(`GameService:  ${gameServiceOk ? "✅ OK" : "❌ FALLO"}`, gameServiceOk ? "green" : "red")

  if (appwriteOk && redisOk && gameServiceOk) {
    log("\n✅ ¡TODO ESTÁ CONFIGURADO CORRECTAMENTE!", "green")
    log("   Puedes iniciar el servidor con: pnpm dev", "cyan")
    process.exit(0)
  } else {
    log("\n❌ Hay problemas que resolver antes de continuar", "red")
    log("   Revisa los errores arriba y corrige la configuración", "yellow")
    process.exit(1)
  }
}

main().catch((error) => {
  log(`\n❌ Error fatal: ${error.message}`, "red")
  process.exit(1)
})

