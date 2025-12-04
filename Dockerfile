# Usar Node.js LTS como imagen base
FROM node:20-alpine

# Instalar pnpm globalmente
RUN npm install -g pnpm

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN pnpm build

# Exponer puerto
EXPOSE 3001

# Comando para iniciar la aplicación
CMD ["pnpm", "start"]


