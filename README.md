# Juntos · Calendario

Calendario en español construido con Next.js, React, NextAuth y MongoDB.

- Vistas de mes, semana y agenda, navegación por fecha y búsqueda.
- Crear, editar y eliminar eventos con fecha, hora de inicio y fin, lugar y notas.
- Calendarios personalizables: crea los tuyos, cambia los nombres y elige cualquier color. Personal, Trabajo, Bienestar y Social son las opciones iniciales.
- Escribe el tema y elige el color directamente en el formulario del evento; los temas nuevos se crean al guardarlo.
- Color propio opcional por evento, o el color del calendario. Los nombres y colores se guardan por cuenta; en la vista de prueba, solo en el navegador.
- Eventos privados por cuenta, con acceso mediante Google o GitHub.
- Vista de prueba con ejemplos y almacenamiento local, separada de los eventos de la cuenta.
- Diseño adaptable a dispositivos móviles y formularios accesibles con teclado.

## Desarrollo

El repositorio usa Node 24, Yarn 1.22.22, Next.js 15 y NextAuth 4.24. Instala Node 24 y ejecuta:

```sh
corepack yarn install --frozen-lockfile
corepack yarn dev
```

Abre http://localhost:3000. Sin credenciales puedes explorar la vista de prueba; sus cambios se guardan solo en el navegador y no se importan a una cuenta.

## Activar las cuentas y el guardado en la nube

Sigue la [guía paso a paso para activar cuentas](docs/activar-cuentas.md). Puedes generar la configuración privada local con `corepack yarn config:init` y revisar lo pendiente con `corepack yarn config:check`.

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
corepack yarn lint
corepack yarn tsc --noEmit
corepack yarn build
node --test tests/*.test.cjs
```

El inicio de sesión real necesita las credenciales OAuth y una base MongoDB accesible.
