import Redis from "ioredis"

if (!process.env.REDIS_HOST) {
  throw new Error("REDIS_HOST is not defined")
}

const redisConfig: any = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  maxRetriesPerRequest: 3,
}

if (process.env.REDIS_PASSWORD) {
  redisConfig.password = process.env.REDIS_PASSWORD
}

// Solo usar TLS si está explícitamente configurado como "true"
// Si es "false" o no está definido, la conexión será sin TLS
if (process.env.REDIS_TLS === "true") {
  redisConfig.tls = {
    rejectUnauthorized: false,
    checkServerIdentity: () => undefined,
  }
  console.log("[Redis] Configuración TLS habilitada")
} else {
  console.log("[Redis] Conexión sin TLS (REDIS_TLS=false o no definido)")
}

export const redis = new Redis(redisConfig)

redis.on("connect", () => {
  console.log("[Redis] Connected to Redis Cloud")
})

redis.on("error", (error) => {
  console.error("[Redis] Error:", error)
})

redis.on("close", () => {
  console.log("[Redis] Connection closed")
})

export default redis

