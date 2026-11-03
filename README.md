# Mapa de Pozos

Mapa colaborativo de pozos y baches. Los vecinos reportan pozos, los confirman
y marcan cuando fueron arreglados. Con esos datos se genera automaticamente un
ranking de municipios.

## Stack

- Frontend: HTML + CSS + JS vanilla, Leaflet
- Mapa base: OpenFreeMap (estilo Positron, vectorial via MapLibre GL, gratis y sin API key).
  Si el navegador no tiene WebGL o OpenFreeMap no responde, cae solo a los tiles de OpenStreetMap
- Base de datos: Supabase (PostgreSQL con Row Level Security)
- Geocodificacion: Nominatim (OpenStreetMap)
- PWA instalable con service worker
- Hosting: Vercel (o cualquier hosting estatico)

## Como deployar

1. Subi todos los archivos de esta carpeta a un repo de GitHub
2. Entra a vercel.com, logueate con GitHub e importa el repo
3. Framework preset: "Other". No hay build step. Deploy.
4. Listo: cada push a main redeploya solo.

## Archivos

- `index.html` — toda la app
- `config.js` — URL y publishable key de Supabase (publicas, protegidas por RLS)
- `ubicacion.js` — como se calcula y se muestra municipio/barrio (lo usan la app y la herramienta de reparacion)
- `herramientas/reparar.html` — recalcula municipio/barrio/provincia de todos los reportes. No se publica
  (`.vercelignore`); se usa en local: `python3 -m http.server 8000` desde el repo y abrir
  `http://localhost:8000/herramientas/reparar.html`. Tiene modo "Simular" que no guarda nada
- `.github/workflows/supabase-keepalive.yml` — consulta diaria para que Supabase (plan free) no se pause
- `manifest.json` + `sw.js` + iconos — PWA instalable
- `schema.sql` — el SQL que crea las tablas (referencia; ya esta corrido en Supabase)

## Modelo de datos

- `pozos`: lat, lng, tamano, municipio, estado (reportado/verificado/arreglado),
  confirmaciones, fechas, device_id del creador
- `votos`: un voto por dispositivo por pozo, garantizado por UNIQUE en la base

## Municipios y barrios

- Municipio y provincia salen de la API Georef oficial (IGN/INDEC). Nominatim (OSM) aporta el barrio,
  y se descarta si OSM ubica el punto en otro partido/departamento (pasa cerca de los limites).
- Georef no tiene municipio para todo el pais (ej. Puerto Deseado, comunas rurales de Cordoba). En ese caso
  se usa el gobierno local o la localidad de OSM, si cae en el mismo departamento oficial; si no hay nada,
  queda "Departamento (zona rural)" (ej. "Martires (zona rural)"), porque ahi no hay municipio.
- El ranking agrupa por municipio + provincia: hay nombres repetidos ("Pilar" en Buenos Aires y en Cordoba).
- Georef devuelve cada comuna de CABA como "municipio": la app las muestra juntas como **CABA**
  y la comuna va al lado del barrio ("La Paternal (Comuna 15)").
- Al publicar, la app espera a que termine la deteccion; antes, publicar rapido guardaba "Sin determinar".

## Plan B del mapa base: CARTO con key gratis

Hasta septiembre 2026 se usaba CARTO `light_all` sin key; ahora CARTO exige key y sin ella
devuelve tiles con la marca de agua "API KEY REQUIRED". Si algun dia OpenFreeMap deja de andar:

1. Pedir una key gratis en https://carto.com/basemaps/apikey (uso no comercial: hasta 5M requests/mes).
2. Cargarla en Vercel > Settings > Environment Variables (por ejemplo `CARTO_KEY`), nunca en el repo.
   Como el sitio no tiene build step, hay que agregar uno que escriba la key en `config.js` al deployar.
   Ojo: la key igual queda visible en el navegador (cualquier key de tiles lo esta); la variable
   de entorno solo evita commitearla.
3. Reemplazar la capa base en `index.html` por un `L.tileLayer` de CARTO con `?key=...`
   (confirmar la URL exacta en el panel de CARTO) y su atribucion: OpenStreetMap + CARTO.

## Pendientes / ideas

- Compartir pozo por link directo
- Filtro por municipio
- Clustering de pines cuando haya muchos pozos (leaflet.markercluster)
- Endurecer RLS con funciones RPC para los contadores
