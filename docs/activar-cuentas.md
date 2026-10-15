# Activar las cuentas de Juntos

El calendario necesita una base MongoDB y al menos un proveedor de acceso. Puedes empezar solo con GitHub y añadir Google después.

## 1. Preparar la configuración privada

Desde la carpeta del proyecto:

```sh
mise exec node@16.20.2 -- corepack yarn config:init
```

Este comando crea `.env.local` y genera `NEXT_AUTH_SECRET`. Si el archivo ya existe, conserva todos sus valores. Nunca imprime el secreto. `.env.local` está excluido de Git.

## 2. Crear la base de datos

1. Crea un proyecto y un clúster en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register), o utiliza tu servidor MongoDB existente.
2. En **Database Access**, crea un usuario de base de datos con acceso a la base de la aplicación. Es distinto de tu cuenta de Atlas.
3. En **Network Access**, permite la IP del servidor que ejecutará la aplicación.
4. En **Connect → Drivers**, copia la URI de conexión. Sustituye el usuario, la contraseña y el nombre de la base. Si la contraseña contiene caracteres especiales, codifícalos para una URL.
5. Guarda la URI en `MONGODB_URI` dentro de `.env.local`.

## 3. Activar GitHub

1. Abre [GitHub → New OAuth App](https://github.com/settings/applications/new).
2. Para desarrollo local, completa:
   - **Application name:** Juntos local.
   - **Homepage URL:** `http://localhost:3000`.
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`.
3. Copia **Client ID** a `GITHUB_ID`.
4. Genera un **Client secret** y guárdalo en `GITHUB_SECRET`.

Guarda estos datos únicamente en `.env.local` o en las variables privadas de tu alojamiento. No los envíes por el chat ni los subas al repositorio.

## 4. Activar Google (opcional)

1. Crea o selecciona un proyecto en [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Configura la pantalla de consentimiento OAuth. Si la aplicación está en pruebas, añade tus cuentas de prueba a la audiencia.
3. Crea un cliente OAuth de tipo **Aplicación web**.
4. Añade como origen `http://localhost:3000` y como URI de redirección autorizada `http://localhost:3000/api/auth/callback/google`.
5. Guarda sus credenciales en `GOOGLE_ID` y `GOOGLE_SECRET`.

El acceso solicita identidad, nombre y correo. No necesita activar la API de Google Calendar.

## 5. Comprobar y probar

```sh
mise exec node@16.20.2 -- corepack yarn config:check
mise exec node@16.20.2 -- corepack yarn dev
```

Reinicia el servidor después de cambiar variables. La comprobación muestra los campos que faltan, sin revelar valores. Valida el formato y la presencia de configuración; no comprueba credenciales reales ni la conexión con MongoDB.

Abre la aplicación, inicia sesión y crea un evento. Recarga para comprobar su persistencia. Cierra sesión e inicia con otra cuenta: no debe ver los eventos de la primera. Los eventos del modo de prueba permanecen separados en el navegador.

Los botones de Google y GitHub aparecen cuando están presentes sus dos credenciales. Si falla el acceso, la aplicación vuelve al calendario y permite reintentar.

## 6. Al publicar

Cuando tengas una URL pública:

1. Configura `MONGODB_URI`, `NEXT_AUTH_SECRET` y las credenciales del proveedor en las variables privadas del alojamiento.
2. Genera un secreto de sesión exclusivo para producción y mantenlo estable entre despliegues.
3. Cambia `NEXTAUTH_URL` a la URL pública HTTPS, sin ruta ni parámetros.
4. Registra la URL pública de retorno: `https://tu-dominio/api/auth/callback/github` o `/google`. Para GitHub, utiliza otra OAuth App para producción y conserva la de desarrollo.
5. Permite la conexión del servidor de producción a MongoDB y repite la prueba con dos cuentas.

La elección del alojamiento y su versión de Node debe resolverse antes del despliegue: este repositorio conserva Next.js 12 y NextAuth 4.3.4, probados localmente con Node 16.20.2. No se ha verificado el despliegue en un alojamiento actual ni se ha actualizado todavía ese conjunto de versiones.
