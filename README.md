# Juntos · Calendario de reservas

Calendario en español construido con Next.js, React, NextAuth y MongoDB.

- Cualquier visitante abre el enlace, consulta, crea y edita reservas sin cuenta.
- Nombre de la reserva, fecha, hora de inicio y fin, lugar, color libre y notas. Colores más intensos y franja lateral para distinguir las reservas.
- Los datos de las reservas son públicos. El formulario lo indica antes de guardar.
- Las reservas guardadas se abren con sus datos y un botón Editar reserva disponible para todos, sin iniciar sesión. Se conserva el campo Nombre de la reserva. Solo el administrador puede eliminarlas.
- Un único administrador inicia sesión con su cuenta de Google o GitHub. Su correo verificado se configura en el servidor.
- Las reservas se guardan en MongoDB y se comparten entre dispositivos. No se guardan en localStorage ni se sustituyen por ejemplos si falla la base de datos.
- Vistas de mes, semana y agenda, búsqueda, filtros y diseño adaptable a móviles.
- **Actualizar reservas** vuelve a consultar los cambios de otros visitantes. También se consultan al recargar la página.

## Desarrollo

Node 24, Yarn 1.22.22, Next.js 15 y NextAuth 4.24:

```sh
corepack yarn install --frozen-lockfile
corepack yarn config:init
corepack yarn dev
```

Completa `.env.local` siguiendo la [guía para publicar y activar al administrador](docs/activar-cuentas.md). No subas este archivo a GitHub.

Abre http://localhost:3000. Para consultar y guardar reservas compartidas necesitas una base MongoDB accesible; sin ella se muestra un error y no se simula un guardado local.

## Configuración

- `MONGODB_URI`: conexión MongoDB para las reservas compartidas.
- `NEXTAUTH_URL`: URL pública HTTPS sin ruta ni barra final; en local, `http://localhost:3000`.
- `NEXT_AUTH_SECRET`: secreto aleatorio estable de al menos 32 caracteres para firmar sesiones.
- `CALENDAR_ADMIN_EMAILS`: **un único correo**, el de la cuenta verificada del administrador. Se conserva el nombre de la variable por compatibilidad. Si está vacío o contiene varios correos, nadie obtiene permisos de administrador.
- `GITHUB_ID` y `GITHUB_SECRET`, o `GOOGLE_ID` y `GOOGLE_SECRET`: al menos un proveedor para el acceso del administrador. Los visitantes no necesitan OAuth.

El acceso de otras cuentas se rechaza. Las APIs comprueban el token firmado, la verificación del proveedor y el correo configurado al eliminar y al personalizar calendarios. Los visitantes pueden consultar, crear y editar; no pueden asignarse permisos ni propietarios. Los correos de cuentas anteriores no se exponen en las respuestas públicas.

Las reservas existentes pasan a ser visibles en el calendario compartido; las antiguas muestras guardadas únicamente en un navegador no se importan. Los datos anteriores siguen siendo editables por el administrador. Las reservas creadas sin cuenta aparecen como **Visitante** en la administración.

Fechas y horas locales, eventos que comienzan y terminan el mismo día. No incluye recurrencias, invitaciones, bloqueo de horarios coincidentes ni sincronización con Google Calendar. Las variables `CLOUDINARY_*` corresponden a funciones sociales originales y no se necesitan para el calendario.

## Comprobaciones

```sh
corepack yarn config:check
corepack yarn lint
corepack yarn tsc --noEmit
corepack yarn build
node --test tests/*.test.cjs
```

Las pruebas de permisos usan cuentas y almacenamiento simulados; el acceso OAuth y MongoDB reales se comprueban con la configuración del despliegue.
