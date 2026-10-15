# Publicar reservas por enlace y activar un administrador

## Cómo funciona

- Los visitantes abren el enlace, ven los datos de todas las reservas y pueden crear una sin registrarse.
- Al abrir una reserva guardada, ven sus datos sin campos editables.
- Solo el administrador inicia sesión y puede editar o eliminar cualquier reserva.
- Todas las reservas se guardan en MongoDB. **Actualizar reservas** o recargar la página muestra los cambios de otros visitantes.

## 1. Subir el proyecto actualizado a GitHub

Extrae el ZIP actualizado y sube su contenido a la raíz del repositorio conectado a Vercel. Guarda los cambios con un commit. No subas `.env.local`, `node_modules`, `.git` ni `.next`.

En Vercel utiliza Next.js, Node **24.x**, instalación `yarn install --frozen-lockfile`, compilación `yarn build` y directorio de salida automático.

## 2. Crear la base de datos compartida

1. Crea un proyecto y un clúster en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register), o usa tu servidor MongoDB.
2. En **Database Access**, crea un usuario de base de datos con acceso a la base de esta aplicación. Es distinto de tu cuenta de Atlas.
3. En **Network Access**, permite las conexiones desde el alojamiento de producción según su configuración de red.
4. En **Connect → Drivers**, copia la URI. Completa usuario, contraseña y nombre de base; codifica los caracteres especiales de la contraseña como URL.
5. En Vercel → **Settings → Environment Variables**, guarda esa URI como `MONGODB_URI` para **Production**.

Sin esta conexión, el calendario muestra un error y no guarda reservas. No hay una copia compartida en el navegador.

## 3. Variables de producción

En Vercel añade para **Production**:

| Nombre | Valor |
| --- | --- |
| `MONGODB_URI` | La conexión MongoDB del paso anterior |
| `NEXTAUTH_URL` | La URL pública HTTPS de tu calendario, sin ruta ni barra final |
| `NEXT_AUTH_SECRET` | Un secreto aleatorio de al menos 32 caracteres, estable entre despliegues |
| `CALENDAR_ADMIN_EMAILS` | Solo el correo verificado de tu cuenta de administrador |

Aunque el nombre termine en EMAILS, esta versión acepta **un solo correo**. Si introduces varios, no se concede administración. Para cambiar de administrador, sustituye el correo y vuelve a desplegar; el anterior pierde acceso a las modificaciones.

No compartas secretos en el chat ni en GitHub.

## 4. Activar el acceso del administrador

Puedes elegir GitHub o Google. Los demás visitantes no necesitan cuenta.

### GitHub

1. Abre [GitHub → New OAuth App](https://github.com/settings/applications/new).
2. Completa **Application name** con Juntos Calendario.
3. En **Homepage URL**, usa la URL pública del calendario.
4. En **Authorization callback URL**, usa esa URL seguida de `/api/auth/callback/github`.
5. Registra la aplicación. Copia **Client ID** en la variable de Vercel `GITHUB_ID`.
6. Genera un **Client secret** y guárdalo como `GITHUB_SECRET`.
7. Verifica en GitHub → **Settings → Emails** que el correo usado por tu cuenta esté verificado y coincida con `CALENDAR_ADMIN_EMAILS`.

### Google (alternativa)

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configura el consentimiento OAuth. Si está en pruebas, añade tu cuenta como usuario de prueba.
2. Crea un cliente OAuth de tipo Aplicación web.
3. Usa la URL pública como origen y esa URL seguida de `/api/auth/callback/google` como redirección autorizada.
4. Guarda las credenciales como `GOOGLE_ID` y `GOOGLE_SECRET` en Vercel.
5. Usa el correo verificado de esa cuenta en `CALENDAR_ADMIN_EMAILS`.

No se necesita activar Google Calendar. Los botones aparecen cuando están configuradas las dos credenciales del proveedor. Otras cuentas no pueden iniciar sesión; el permiso de administrador requiere además la verificación del correo por el proveedor.

## 5. Volver a desplegar y usar

1. En Vercel → **Deployments**, abre **⋯ → Redeploy** en el último despliegue y espera **Ready**.
2. Comparte la URL pública. Los visitantes podrán crear reservas y ver sus datos sin iniciar sesión.
3. Para administrar, pulsa **Acceso del administrador** y entra con tu cuenta configurada.
4. Verás **Administrar reservas**. Abre una reserva y pulsa **Editar reserva** o **Eliminar reserva**.
5. Si ya habías iniciado sesión antes de configurar el correo, cierra sesión y vuelve a entrar.

Comprueba en dos navegadores: crea una reserva sin cuenta en uno y recarga el otro para verla. El visitante debe poder consultar y crear, pero no editar ni eliminar. Como administrador, comprueba la edición y eliminación de esa reserva.

## Desarrollo local

```sh
corepack yarn config:init
corepack yarn config:check
corepack yarn dev
```

El inicializador crea `.env.local` con un secreto privado y conserva los archivos existentes. Completa las variables del ejemplo. La comprobación valida presencia/formato, sin imprimir secretos ni conectar con proveedores o base de datos.

Para local usa `NEXTAUTH_URL=http://localhost:3000` y una OAuth App de desarrollo con callback `http://localhost:3000/api/auth/callback/github` (o `/google`). Reinicia el servidor tras cambiar variables. Conserva una aplicación OAuth distinta para producción.
