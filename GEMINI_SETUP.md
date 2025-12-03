# Configuración de Gemini AI (Google AI Studio)

## 🎯 ¿Por qué Gemini?

Gemini AI permite generar palabras y categorías dinámicamente, asegurando que el juego nunca se quede sin contenido. Es **GRATIS** y fácil de configurar.

## 📝 Pasos para Configurar

### 1. Crear API Key en Google AI Studio

1. Ve a [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key" o "Get API Key"
4. Selecciona o crea un proyecto de Google Cloud
5. Copia la API key generada

### 2. Agregar al Backend

Agrega la API key a tu archivo `.env` en el backend:

```env
GEMINI_API_KEY=tu-api-key-aqui
```

### 3. Instalar Dependencias

```bash
cd juego-del-impostor-backend
pnpm install
```

Esto instalará `@google/generative-ai` automáticamente.

## 🎮 Cómo Funciona

### Generación Automática de Palabras

El juego usa Gemini para generar palabras cuando:
- Se inicia una nueva ronda
- Se necesita una palabra de una categoría específica
- Se agotan las palabras base

### Fallback a Palabras Base

Si Gemini no está disponible o falla:
- El juego usa palabras predefinidas
- No se interrumpe la partida
- Los jugadores pueden seguir jugando

### Caché Inteligente

- Las palabras generadas se guardan en Redis por 24 horas
- Reduce llamadas a la API
- Mejora el rendimiento

## 🔧 Configuración Avanzada

### Límites de la API Gratuita

Google AI Studio (gratis) tiene límites:
- **60 solicitudes por minuto** (RPM)
- **1,500 solicitudes por día** (RPD)
- Suficiente para el juego normal

### Optimización

El servicio usa caché para minimizar llamadas:
- Palabras por categoría se cachean
- TTL de 24 horas
- Se regeneran automáticamente

## 🧪 Prueba la Integración

Puedes probar que Gemini funciona:

```bash
cd juego-del-impostor-backend
pnpm dev
```

En los logs deberías ver:
- Si Gemini está disponible: `[Gemini] Generando palabras...`
- Si no está configurado: `[WordsService] Usando palabras base`

## 📊 Categorías Soportadas

Gemini puede generar palabras para:
- Objetos
- Animales
- Comida
- Lugares
- Profesiones
- Deportes
- Películas
- Personajes
- Tecnología
- Naturaleza
- Y cualquier categoría personalizada

## ⚠️ Troubleshooting

### Error: "Gemini API no está configurada"
- Verifica que `GEMINI_API_KEY` esté en `.env`
- Reinicia el servidor después de agregar la variable

### Error: "API key inválida"
- Verifica que la API key sea correcta
- Asegúrate de que no tenga espacios extra
- Verifica que la API key esté activa en Google AI Studio

### Error: "Rate limit exceeded"
- Has excedido el límite de solicitudes
- El juego automáticamente usa palabras base
- Espera unos minutos y vuelve a intentar

## 🎯 Ventajas

✅ **Contenido infinito**: Nunca se acaban las palabras
✅ **Categorías dinámicas**: Puedes pedir cualquier categoría
✅ **Gratis**: Google AI Studio es gratuito
✅ **Fallback seguro**: Si falla, usa palabras base
✅ **Caché inteligente**: Optimizado para rendimiento

