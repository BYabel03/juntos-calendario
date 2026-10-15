const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
// Use the environment loader shipped with the installed Next.js version.
const { loadEnvConfig } = require(require.resolve("@next/env", {
  paths: [path.dirname(require.resolve("next/package.json"))],
}));

if (process.argv[2] === "init") {
  const destination = path.resolve(".env.local");
  try {
    fs.writeFileSync(
      destination,
      [
        "# Configuración privada local. No subir a GitHub.",
        'NEXTAUTH_URL="http://localhost:3000"',
        `NEXT_AUTH_SECRET="${crypto.randomBytes(32).toString("base64")}"`,
        'MONGODB_URI=""',
        'GITHUB_ID=""',
        'GITHUB_SECRET=""',
        'GOOGLE_ID=""',
        'GOOGLE_SECRET=""',
        "",
      ].join("\n"),
      { flag: "wx", mode: 0o600 }
    );
    console.log(
      "Se creó .env.local con un secreto de sesión nuevo. Completa MongoDB y al menos un proveedor de acceso."
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log(".env.local ya existe; se conservaron todos sus valores.");
  }
  process.exit(0);
}

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", {
  info() {},
  error() {
    console.error("No se pudo cargar la configuración de entorno.");
  },
});
const env = process.env;
const present = (key) => Boolean(env[key]?.trim());
const checks = [];
const check = (label, valid) => {
  checks.push(valid);
  console.log(`${valid ? "OK" : "FALTA / REVISAR"} · ${label}`);
};
check(
  "MONGODB_URI (URI de MongoDB)",
  /^mongodb(?:\+srv)?:\/\/\S+$/.test(env.MONGODB_URI || "")
);
check(
  "NEXT_AUTH_SECRET (mínimo 32 caracteres)",
  (env.NEXT_AUTH_SECRET || "").length >= 32
);
let validUrl = false;
try {
  const url = new URL(env.NEXTAUTH_URL);
  validUrl =
    (url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password;
} catch {}
check("NEXTAUTH_URL (HTTPS o localhost, sin ruta ni parámetros)", validUrl);
for (const provider of ["GITHUB", "GOOGLE"]) {
  const id = present(`${provider}_ID`),
    secret = present(`${provider}_SECRET`);
  if (id || secret)
    check(
      `${provider}_ID y ${provider}_SECRET (ambos necesarios)`,
      id && secret
    );
}
check(
  "Al menos un acceso completo (GitHub o Google)",
  ["GITHUB", "GOOGLE"].some((p) => present(`${p}_ID`) && present(`${p}_SECRET`))
);
console.log(
  "\nEsta comprobación valida la configuración; no conecta con MongoDB ni con los proveedores OAuth. No se muestran secretos."
);
if (checks.some((valid) => !valid)) process.exitCode = 1;
