# Guia de instalacion

Guia practica para instalar y replicar `Sistema Kettal` en una computadora nueva usando Docker.

## Objetivo

Al terminar esta guia vas a tener:

- dependencias instaladas
- proyecto descargado
- contenedores levantados
- app disponible en `http://localhost:3017`
- configuracion inicial lista para empezar a usar

## Opcion recomendada

La forma mas simple de instalar el sistema en otra computadora es usar:

- `Git`
- `Node.js`
- `pnpm`
- `Docker Desktop`

Con eso no hace falta instalar PostgreSQL manualmente.

## 1. Instalar dependencias del sistema

### Windows

Abrir `PowerShell` como administrador y ejecutar:

```powershell
winget install --id Git.Git -e --source winget
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id Docker.DockerDesktop -e --source winget
npm install -g pnpm
```

Despues cerrar y volver a abrir la terminal.

Verificar instalacion:

```powershell
git --version
node --version
npm --version
pnpm --version
docker --version
```

### macOS

Abrir `Terminal`.

Si no tenes `Homebrew`, instalarlo:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Instalar dependencias:

```bash
brew install git
brew install node
brew install --cask docker
npm install -g pnpm
```

Verificar instalacion:

```bash
git --version
node --version
npm --version
pnpm --version
docker --version
```

## 2. Iniciar Docker Desktop

Antes de seguir, abrir `Docker Desktop` y esperar a que termine de arrancar por completo.

Importante:

- instalar Docker no alcanza por si solo
- despues de la instalacion hay que abrir `Docker Desktop` al menos una vez
- si Docker queda en estado `Starting...`, esperar unos minutos
- si pide reiniciar la computadora o habilitar `WSL`, aceptar
- no continuar hasta que Docker quede realmente corriendo

Verificacion:

```powershell
docker version
```

Si `docker version` muestra la seccion `Client` pero da error de conexion con el daemon, normalmente significa que `Docker Desktop` todavia no termino de iniciar.

En macOS tambien podes abrirlo con:

```bash
open -a Docker
```

## 3. Descargar el proyecto

Elegir una carpeta de trabajo y clonar el repositorio.

```powershell
git clone https://github.com/pccleansur-dev/GKetta.git
cd GKetta
```

## 4. Crear archivo de entorno

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS o bash

```bash
cp .env.example .env
```

Si `Copy-Item .env.example .env` o `cp .env.example .env` falla porque `.env.example` no existe, crear `.env` manualmente con este contenido:

```text
POSTGRES_DB=sistema_kettal
POSTGRES_USER=kettal
POSTGRES_PASSWORD=kettal_dev_123

# Para correr la app fuera de Docker
DATABASE_URL=postgresql://kettal:kettal_dev_123@localhost:5433/sistema_kettal?schema=public
```

## 5. Verificar el entorno del proyecto

```powershell
pnpm setup:check
```

Si estas en macOS:

```bash
pnpm setup:check
```

## 6. Levantar el sistema

```powershell
docker compose up -d --build
```

La primera vez puede tardar varios minutos porque Docker crea la base y la app desde cero.

## 7. Abrir la aplicacion

Abrir en el navegador:

```text
http://localhost:3017
```

Si es una instalacion nueva, el sistema redirige automaticamente a `/setup`.

## 8. Completar la configuracion inicial

En el asistente de inicio:

1. Definir el nombre del negocio.
2. Cambiar la contrasena del usuario `admin`.
3. Definir la carpeta de backups.
4. Elegir la retencion de backups.
5. Confirmar y entrar al sistema.

## Acceso inicial

| Usuario | Contrasena inicial | Rol |
|---|---|---|
| `admin` | `admin1234` | Administrador |

La contrasena inicial se reemplaza durante el setup.

## Estado inicial esperado

En una instalacion limpia:

- `1` usuario: `admin`
- `0` clientes
- `0` pedidos
- `0` ventas
- `0` movimientos de caja
- `0` sesiones activas

Los demas usuarios se crean despues desde `Usuarios`.

## Backups

- El sistema genera backups automaticos todos los dias a las `00:00`.
- En Docker se usa la carpeta `./backups/` del proyecto.
- Si esa carpeta esta sincronizada con OneDrive, Dropbox o similar, los backups quedan replicados fuera de la app.
- La deteccion de carpeta de nube en el setup es solo una ayuda visual.

## Comandos utiles

### Ver contenedores

```powershell
docker compose ps
```

### Ver logs de la app

```powershell
docker compose logs app --tail 50
```

### Bajar el sistema sin borrar datos

```powershell
docker compose down
```

### Volver a levantarlo

```powershell
docker compose up -d
```

### Reinstalacion limpia

```powershell
docker compose down -v
docker compose up -d --build
```

Esto borra la base local y deja una instalacion nueva.

## Problemas comunes

### `docker` no responde

- verificar que `Docker Desktop` este abierto
- esperar a que Docker termine de iniciar
- volver a ejecutar `docker version`

### No abre `http://localhost:3017`

Revisar:

```powershell
docker compose ps
docker compose logs app --tail 50
```

### `pnpm` no existe

Instalarlo con:

```powershell
npm install -g pnpm
```

### `winget` no existe en Windows

Actualizar `App Installer` desde Microsoft Store y volver a abrir PowerShell.

## Replica en otra computadora

Para replicar la app en otra maquina:

1. instalar dependencias
2. clonar el repo
3. copiar `.env.example` a `.env`
4. ejecutar `docker compose up -d --build`
5. entrar a `http://localhost:3017`
6. completar setup o restaurar un backup

## Desarrollo local opcional

Si en vez de usar la app dentro de Docker queres desarrollar localmente:

```powershell
pnpm install
docker compose up -d postgres
pnpm db:setup
pnpm dev
```

Abrir:

```text
http://localhost:3000
```
