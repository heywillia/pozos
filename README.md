# Mapa de Pozos

Mapa colaborativo de pozos y baches. Los vecinos reportan pozos, los confirman
y marcan cuando fueron arreglados. Con esos datos se genera automaticamente un
ranking de municipios.

## Stack

- Frontend: HTML + CSS + JS vanilla, Leaflet + OpenStreetMap
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
- `manifest.json` + `sw.js` + iconos — PWA instalable
- `schema.sql` — el SQL que crea las tablas (referencia; ya esta corrido en Supabase)

## Modelo de datos

- `pozos`: lat, lng, tamano, municipio, estado (reportado/verificado/arreglado),
  confirmaciones, fechas, device_id del creador
- `votos`: un voto por dispositivo por pozo, garantizado por UNIQUE en la base

## Pendientes / ideas

- Compartir pozo por link directo
- Filtro por municipio
- Clustering de pines cuando haya muchos pozos (leaflet.markercluster)
- Endurecer RLS con funciones RPC para los contadores
