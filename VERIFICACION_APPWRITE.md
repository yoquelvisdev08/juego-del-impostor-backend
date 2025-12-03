# Verificación de Configuración Appwrite

## ✅ Checklist de Verificación

Usa esta lista para verificar que tu configuración en Appwrite sea correcta:

### 1. Proyecto y Base de Datos
- [ ] Proyecto creado en Appwrite Cloud
- [ ] Base de datos creada
- [ ] Tienes el `DATABASE_ID` (lo encuentras en la URL o en la configuración de la base de datos)

### 2. Colección `games`
- [ ] Colección `games` creada
- [ ] Tienes el `GAMES_COLLECTION_ID` (lo encuentras en la URL o en la configuración de la colección)

### 3. Atributos de la Colección `games`

⚠️ **IMPORTANTE**: Verifica que tengas **EXACTAMENTE 3 atributos** (no más, no menos).

**Para verificar rápidamente, ejecuta:**
```bash
pnpm verify-strict
```

Este comando te mostrará:
- ✅ Qué atributos requeridos tienes
- ⚠️ Qué atributos adicionales debes eliminar
- 📋 Instrucciones para limpiar la colección

#### ✅ Atributo 1: `code`
- [ ] Tipo: **String**
- [ ] Tamaño: **6** caracteres
- [ ] Requerido: **Sí** ✅
- [ ] Array: **No** ❌
- [ ] Único: **Sí** ✅
- [ ] Default: (puede estar vacío)

#### ✅ Atributo 2: `gameState`
- [ ] Tipo: **String**
- [ ] Tamaño: **65535** (máximo permitido)
- [ ] Requerido: **Sí** ✅
- [ ] Array: **No** ❌
- [ ] Único: **No** ❌
- [ ] Default: (puede estar vacío)

#### ✅ Atributo 3: `updatedAt`
- [ ] Tipo: **Integer**
- [ ] Tamaño: **64 bits** (o el máximo disponible)
- [ ] Requerido: **Sí** ✅
- [ ] Array: **No** ❌
- [ ] Único: **No** ❌
- [ ] Default: (puede estar vacío)

### 4. Índices
- [ ] Índice creado en `code` (único)
- [ ] (Opcional) Índice en `updatedAt` para búsquedas

### 5. Permisos
- [ ] Permisos de lectura configurados
- [ ] Permisos de escritura configurados
- [ ] Permisos de actualización configurados
- [ ] Permisos de eliminación configurados

### 6. API Key
- [ ] API Key creada en el proyecto
- [ ] Tienes el `API_KEY` (copia y guárdala de forma segura)
- [ ] La API Key tiene permisos para la base de datos

### 7. Variables de Entorno
- [ ] Archivo `.env` creado en el backend
- [ ] `APPWRITE_ENDPOINT` configurado (generalmente: `https://cloud.appwrite.io/v1`)
- [ ] `APPWRITE_PROJECT_ID` configurado
- [ ] `APPWRITE_API_KEY` configurado
- [ ] `APPWRITE_DATABASE_ID` configurado
- [ ] `APPWRITE_GAMES_COLLECTION_ID` configurado

## 🔍 Cómo Verificar en Appwrite

### Verificar Atributos

**Método 1: Usando el script (Recomendado)**
```bash
pnpm verify-strict
```

**Método 2: Manualmente en Appwrite**
1. Ve a tu proyecto en Appwrite
2. Abre la base de datos
3. Abre la colección `games`
4. Ve a la pestaña "Attributes" (Atributos)
5. Deberías ver **exactamente 3 atributos**:
   - `code` (String)
   - `gameState` (String)
   - `updatedAt` (Integer)

**Si ves más de 3 atributos:**
- Consulta `scripts/guide-cleanup-attributes.md` para instrucciones detalladas
- Elimina todos los atributos adicionales desde la consola de Appwrite
- Mantén SOLO: `code`, `gameState`, `updatedAt`

### Verificar IDs
1. **PROJECT_ID**: Lo encuentras en la URL cuando estás en tu proyecto, o en Settings → General
2. **DATABASE_ID**: Lo encuentras en la URL cuando estás en la base de datos, o en Settings
3. **COLLECTION_ID**: Lo encuentras en la URL cuando estás en la colección, o en Settings

### Verificar API Key
1. Ve a Settings → API Keys
2. Crea una nueva API Key si no tienes una
3. Asegúrate de darle permisos a la base de datos
4. Copia la clave (solo se muestra una vez)

## ❌ Errores Comunes

### Error: "The maximum number or size of columns for this table has been reached"
**Causa**: Tienes demasiados atributos en la colección (más de 3)
**Solución**: 
1. Ejecuta `pnpm verify-strict` para ver qué atributos adicionales tienes
2. Elimina todos los atributos excepto `code`, `gameState`, y `updatedAt`
3. Consulta `scripts/guide-cleanup-attributes.md` para instrucciones detalladas
4. Si no puedes eliminar atributos, crea una nueva colección con solo estos 3

### Error: "Attribute not found"
**Causa**: Falta un atributo requerido
**Solución**: Verifica que tengas los 3 atributos exactos: `code`, `gameState`, `updatedAt`

### Error: "Invalid JSON"
**Causa**: El atributo `gameState` no está configurado como String
**Solución**: Verifica que `gameState` sea de tipo String, no JSON

### Error: "Permission denied"
**Causa**: La API Key no tiene permisos
**Solución**: Verifica los permisos de la API Key en Settings → API Keys

## 🧪 Prueba Rápida

Para probar que todo funciona:

1. Inicia el servidor backend:
   ```bash
   cd juego-del-impostor-backend
   pnpm dev
   ```

2. Deberías ver en la consola:
   ```
   [Server] Servidor corriendo en puerto 3001
   ```

3. Si hay errores de conexión a Appwrite, revisa:
   - Las variables de entorno en `.env`
   - Los IDs de proyecto, base de datos y colección
   - Los permisos de la API Key

## 📝 Notas Importantes

- **NO** crees atributos adicionales como `players`, `votes`, `phase`, etc.
- **SÍ** guarda todo en el atributo `gameState` como JSON
- El código del backend maneja automáticamente la serialización/deserialización
- Si tienes una colección antigua con muchos atributos, puedes crear una nueva colección limpia

## ✅ Confirmación Final

Si todos los checkboxes están marcados, tu configuración está correcta. El backend debería poder:
- Crear partidas nuevas
- Guardar el estado del juego
- Recuperar partidas existentes
- Actualizar el estado del juego

Si tienes algún problema, comparte:
1. Qué error ves en la consola del servidor
2. Qué atributos tienes en la colección `games`
3. Si las variables de entorno están configuradas

