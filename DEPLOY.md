# 📚 Reading Tracker — Guía de Deploy
## Vite + React + Supabase + Vercel

---

## PASO 1 — Crear proyecto en Supabase (5 min)

1. Ir a https://supabase.com → **Start your project** (cuenta gratis)
2. **New Project** → elegí nombre (ej: `readingtracker`) → región `South America (São Paulo)` → contraseña (guardala)
3. Esperar ~2 min que se inicialice

### Crear las tablas y cargar tus datos:

4. En el dashboard → **SQL Editor** → **New query**
5. Pegar el contenido completo de `supabase_setup.sql` → **Run**
6. Verificar en **Table Editor** que aparecen las tablas `books` y `logs` con tus datos

### Copiar las credenciales:

7. **Project Settings** (ícono engranaje) → **API**
8. Copiar:
   - **Project URL** → `https://xxxxxxxxxx.supabase.co`
   - **anon / public key** → `eyJhbGci...`

---

## PASO 2 — Subir el código a GitHub (3 min)

```bash
# En tu computadora, crear la carpeta del proyecto
# (copiar todos los archivos de esta carpeta)

cd readingtracker
npm install

# Crear .env con tus credenciales
cp .env.example .env
# Editar .env y pegar tus valores de Supabase

# Probar localmente
npm run dev
# → Abre http://localhost:5173 y verificá que carga tus datos

# Subir a GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/readingtracker.git
git push -u origin main
```

---

## PASO 3 — Deploy en Vercel (2 min)

1. Ir a https://vercel.com → **New Project**
2. **Import Git Repository** → seleccionar `readingtracker`
3. Framework Preset: **Vite** (debería detectarse solo)
4. Antes de hacer deploy → **Environment Variables**:
   - `VITE_SUPABASE_URL` = tu Project URL
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
5. **Deploy** → en 1-2 min tenés la URL

### Tu app queda en:
```
https://readingtracker-xxxx.vercel.app
```

Esa URL funciona igual en desktop y mobile. Los datos se sincronizan automáticamente porque ambos leen de Supabase.

---

## PASO 4 — Instalar como app en el celular (opcional)

### iPhone (Safari):
1. Abrir la URL en Safari
2. Botón compartir → **Agregar a pantalla de inicio**
3. Se instala como app nativa con ícono

### Android (Chrome):
1. Abrir la URL en Chrome
2. Menú → **Agregar a pantalla de inicio**

---

## Actualizaciones futuras

Cada vez que hagas cambios en el código:
```bash
git add .
git commit -m "descripción del cambio"
git push
```
Vercel redeploya automáticamente en ~1 min.

---

## Estructura final del proyecto

```
readingtracker/
├── src/
│   ├── App.jsx          ← app completa
│   ├── supabase.js      ← cliente Supabase
│   └── main.jsx         ← entry point
├── index.html
├── package.json
├── vite.config.js
├── .env                 ← NO subir a git (está en .gitignore)
├── .env.example         ← template sin valores reales
├── .gitignore
└── supabase_setup.sql   ← SQL para crear tablas + seed data
```
