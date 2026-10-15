# Juntos · Calendario

Calendario en español construido con Next.js, React, NextAuth y MongoDB.

- Vistas de mes, semana y agenda, navegación por fecha y búsqueda.
- Crear, editar y eliminar eventos con fecha, hora de inicio y fin, lugar y notas.
- Cuatro calendarios con colores y filtros: Personal, Trabajo, Bienestar y Social.
- Eventos privados por cuenta, con acceso mediante Google o GitHub.
- Vista de prueba con ejemplos y almacenamiento local, separada de los eventos de la cuenta.
- Diseño adaptable a dispositivos móviles y formularios accesibles con teclado.

## Desarrollo

El repositorio usa Next.js 12 y NextAuth 4.3.4, cuyo motor declarado requiere Node 16. Para reproducir el entorno de desarrollo con mise:

```sh
mise exec node@16.20.2 -- corepack yarn install --frozen-lockfile
mise exec node@16.20.2 -- corepack yarn dev
```

Abre http://localhost:3000. Sin credenciales puedes explorar la vista de prueba; sus cambios se guardan solo en el navegador y no se importan a una cuenta.

## Activar las cuentas y el guardado en la nube

Sigue la [guía paso a paso para activar cuentas](docs/activar-cuentas.md). Puedes generar la configuración privada local con `mise exec node@16.20.2 -- corepack yarn config:init` y revisar lo pendiente con `mise exec node@16.20.2 -- corepack yarn config:check`.

Configura en `.env.local`:

- `MONGODB_URI`: URI de tu base MongoDB.
- `NEXT_AUTH_SECRET`: secreto aleatorio para firmar las sesiones (por ejemplo, generado con `openssl rand -base64 32`).
- `NEXTAUTH_URL`: URL de la aplicación, sin barra final (en desarrollo, `http://localhost:3000`).
- `GOOGLE_ID` y `GOOGLE_SECRET`: credenciales de una aplicación OAuth de Google (opcional si usas GitHub).
- `GITHUB_ID` y `GITHUB_SECRET`: credenciales de una aplicación OAuth de GitHub (opcional si usas Google).

Hace falta al menos uno de los dos proveedores. Cada botón de acceso aparece cuando están configuradas sus dos credenciales.

Registra las URL de retorno `${NEXTAUTH_URL}/api/auth/callback/google` y `${NEXTAUTH_URL}/api/auth/callback/github` en los respectivos proveedores. No subas `.env.local` a GitHub. En producción utiliza HTTPS y configura las variables en tu plataforma de despliegue.

Cada evento se guarda en MongoDB con el correo de la sesión verificada por NextAuth. Las consultas y modificaciones siempre se limitan a esa cuenta; el cliente no puede elegir al propietario. Las fechas y horas se muestran en la hora local y los eventos comienzan y terminan el mismo día. No incluye recurrencias, invitaciones ni sincronización con Google Calendar.

Las variables `CLOUDINARY_*` del ejemplo pertenecen a las funciones sociales originales del repositorio; el calendario no las necesita.

## Comprobaciones

```sh
mise exec node@16.20.2 -- corepack yarn lint
mise exec node@16.20.2 -- corepack yarn tsc --noEmit
mise exec node@16.20.2 -- corepack yarn build
node --test tests/*.test.cjs
```

El inicio de sesión real necesita las credenciales OAuth y una base MongoDB accesible.
