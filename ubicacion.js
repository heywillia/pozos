// Municipio, barrio y provincia de un reporte.
// Lo usan index.html (al reportar y para mostrar) y herramientas/reparar.html (para corregir datos viejos),
// así las dos clasifican igual.
(function(){
  const CABA = 'Ciudad Autónoma de Buenos Aires';
  const SIN_DATO = 'Sin determinar';

  async function getJSON(url, ms){
    const ctrl = new AbortController();
    const t = setTimeout(function(){ ctrl.abort(); }, ms);
    try{
      const r = await fetch(url, {signal:ctrl.signal, headers:{'Accept':'application/json'}});
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  // para comparar nombres sin importar tildes ni mayúsculas
  function clave(s){
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  }
  // "Partido del Pilar" -> "Pilar", "Partido de La Matanza" -> "La Matanza"
  function sinPartido(n){
    return n ? n.replace(/^(Partido|Departamento) (del |de )/,'').trim() : null;
  }

  // Devuelve {municipio, barrio, provincia, fuente, osmOk}.
  // fuente: 'georef' | 'osm' | null (de dónde salió el municipio). osmOk: si Nominatim respondió.
  async function detectar(lat, lng){
    let municipio = null, provincia = null, barrio = null, fuente = null, osmOk = false;

    // 1) Georef (IGN/INDEC): límites oficiales. Es la fuente del municipio; un reintento porque a veces falla.
    for(let i = 0; i < 2 && !municipio; i++){
      try{
        const u = ((await getJSON('https://apis.datos.gob.ar/georef/api/ubicacion?lat='+lat+'&lon='+lng, 6000)) || {}).ubicacion || {};
        municipio = (u.municipio && u.municipio.nombre) || (u.departamento && u.departamento.nombre) || null;
        provincia = (u.provincia && u.provincia.nombre) || null;
        if(municipio) fuente = 'georef';
      }catch(e){}
    }

    // 2) Nominatim (OSM): barrio de referencia, y municipio solo si Georef no respondió
    try{
      const a = ((await getJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+lat+'&lon='+lng+'&zoom=14&accept-language=es', 8000)) || {}).address || {};
      osmOk = true;
      const muniOSM = sinPartido(a.state_district || a.county || a.municipality || null);
      if(!municipio && muniOSM){ municipio = muniOSM; fuente = 'osm'; }
      if(!provincia) provincia = a.state || null;
      const b = a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city || a.city_district || null;
      // Nominatim da la localidad más cercana aunque quede en el partido vecino: si no coincide con el oficial, se descarta
      const mismoPartido = !muniOSM || clave(muniOSM) === clave(municipio);
      if(b && mismoPartido && clave(b) !== clave(provincia) && clave(b) !== 'buenos aires') barrio = b;
    }catch(e){}

    return {municipio: municipio || SIN_DATO, barrio: barrio, provincia: provincia, fuente: fuente, osmOk: osmOk};
  }

  // Cómo se muestra un reporte: {municipio, barrio}.
  // Georef devuelve cada comuna de CABA como si fuera un municipio; para el ranking la ciudad es una sola.
  function zona(p){
    const m = p.municipio || SIN_DATO;
    const comuna = /^Comuna \d+$/.test(m) ? m : null;
    if(comuna || p.provincia === CABA){
      return {municipio:'CABA', barrio: p.barrio ? p.barrio + (comuna ? ' ('+comuna+')' : '') : comuna};
    }
    let barrio = p.barrio || null;
    if(barrio && m !== SIN_DATO && clave(barrio) === clave(m)) barrio = m + ' (ciudad)';
    return {municipio:m, barrio:barrio};
  }

  // Para agrupar variantes del mismo barrio: "Barrio Parque El Remanso" y "El Remanso"
  function claveBarrio(b){
    return clave(b).replace(/^barrio (parque )?/,'');
  }

  window.Ubicacion = {detectar: detectar, zona: zona, claveBarrio: claveBarrio, SIN_DATO: SIN_DATO};
})();
