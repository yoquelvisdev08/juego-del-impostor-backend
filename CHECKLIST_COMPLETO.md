# ✅ Checklist Completo de Configuración

## ✅ 1. Appwrite - Colección `games` (COMPLETADO)

Tu verificación muestra que está correcto:
- ✅ 3 atributos exactos: `code`, `gameState`, `updatedAt`
- ✅ No hay atributos adicionales
- ✅ Configuración según la documentación

## 🔍 2. Verificaciones Adicionales Necesarias

### A. Variables de Entorno

Verifica que tu archivo `.env` tenga todas las variables configuradas:

```bash
# En el directorio juego-del-impostor-backend
cat .env
```

Debes tener:
- [ ] `APPWRITE_ENDPOINT` (generalmente: `https://cloud.appwrite.io/v1`)
- [ ] `APPWRITE_PROJECT_ID` (tu ID de proyecto)
- [ ] `APPWRITE_API_KEY` (tu API key)
- [ ] `APPWRITE_DATABASE_ID` (tu ID de base de datos)
- [ ] `APPWRITE_GAMES_COLLECTION_ID` (debería ser: `692f81e4003262186f74` según tu verificación)
- [ ] `REDIS_HOST` (tu host de Redis Cloud)
- [ ] `REDIS_PORT` (puerto de Redis, generalmente 6379 o el que te dio Redis Cloud)
- [ ] `REDIS_PASSWORD` (tu contraseña de Redis)
- [ ] `REDIS_TLS` (true o false, según tu configuración de Redis)
- [ ] `CORS_ORIGIN` (generalmente: `http://localhost:3000`)

### B. Permisos en Appwrite

Verifica los permisos de la colección `games`:

1. Ve a Appwrite → Tu proyecto → Base de datos → Colección `games`
2. Ve a la pestaña "Settings" o "Permissions"
3. Verifica que la API Key tenga permisos para:
   - [ ] **Read** (lectura)
   - [ ] **Create** (crear documentos)
   - [ ] **Update** (actualizar documentos)
   - [ ] **Delete** (eliminar documentos)

### C. Configuración de Redis Cloud

- [ ] Tienes una cuenta en Redis Cloud
- [ ] Has creado una base de datos
- [ ] Tienes las credenciales (host, puerto, contraseña)
- [ ] Has configurado las variables de entorno

### D. Prueba de Conexión

Ejecuta una prueba completa:

```bash
# 1. Verifica que el servidor pueda iniciar
pnpm dev

# Deberías ver:
# [Server] Servidor corriendo en puerto 3001
# [Redis] Connected to Redis Cloud
```

Si hay errores, revisa:
- Variables de entorno
- Credenciales de Appwrite
- Credenciales de Redis

## 🧪 Prueba de Funcionalidad Completa

### Prueba 1: Crear una Partida

```bash
# En otra terminal, prueba crear una partida:
curl -X POST http://localhost:3001/api/games \
  -H "Content-Type: application/json" \
  -d '{"hostId":"test-123","hostName":"Test Player"}'
```

Deberías recibir un JSON con la partida creada, incluyendo un `code`.

### Prueba 2: Obtener una Partida

```bash
# Usa el code que recibiste en la prueba anterior
curl http://localhost:3001/api/games/ABC123
```

Deberías recibir el estado completo de la partida.

### Prueba 3: Verificar en Appwrite

1. Ve a Appwrite → Tu proyecto → Base de datos → Colección `games`
2. Deberías ver un documento con el `code` que creaste
3. El documento debe tener:
   - `code`: El código de la partida
   - `gameState`: Un JSON stringificado con todo el estado
   - `updatedAt`: Un timestamp

## ⚠️ Errores Comunes y Soluciones

### Error: "Permission denied" o "Unauthorized"
**Solución**: Verifica los permisos de la API Key en Appwrite

### Error: "Collection not found"
**Solución**: Verifica que `APPWRITE_GAMES_COLLECTION_ID` sea correcto

### Error: "Redis connection failed"
**Solución**: 
- Verifica las credenciales de Redis
- Asegúrate de que `REDIS_TLS=true` si tu Redis requiere TLS
- Verifica que el host y puerto sean correctos

### Error: "Invalid JSON" al guardar
**Solución**: El código debería manejar esto automáticamente, pero verifica que `gameState` sea String, no JSON type

## ✅ Resumen

Si completaste:
- ✅ Verificación de atributos (ya hecho)
- ✅ Variables de entorno configuradas
- ✅ Permisos en Appwrite configurados
- ✅ Redis Cloud configurado
- ✅ Servidor inicia sin errores
- ✅ Puedes crear y obtener partidas

**¡Entonces todo está listo!** 🎉

## 🚀 Siguiente Paso

Una vez que todo esté verificado, puedes:
1. Iniciar el servidor backend: `pnpm dev`
2. Iniciar el frontend: `cd ../juego-del-impostor && pnpm dev`
3. Probar crear una partida desde el frontend

