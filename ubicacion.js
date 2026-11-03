// Municipio, barrio y provincia de un reporte, para cualquier punto de Argentina.
// Lo usan index.html (al reportar y para mostrar) y herramientas/reparar.html (para corregir datos viejos),
// así las dos clasifican igual.
(function(){
  const CABA = 'Ciudad Autónoma de Buenos Aires';
  const SIN_DATO = 'Sin determinar';
  const RURAL = ' (zona rural)';
  const PROVINCIA_CORTA = {
    'Ciudad Autónoma de Buenos Aires': 'CABA',
    'Tierra del Fuego, Antártida e Islas del Atlántico Sur': 'Tierra del Fuego'
  };

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
  // OSM nombra las divisiones con prefijo: "Partido del Pilar", "Departamento Capital", "Pedanía Impira"
  function sinDivision(n){
    return n ? n.replace(/^(Partido|Departamento|Pedanía|Distrito) (del |de )?/,'').trim() : null;
  }
  // ...y a los gobiernos y ciudades también: "Municipio de Rosario", "Comuna de Colonia Videla",
  // "Junta de Gobierno de Crucecitas Octava", "Ciudad de Mendoza", "Distrito Ciudad de Godoy Cruz"
  function sinGobierno(n){
    return n ? n.replace(/^(Municipio|Municipalidad|Comuna|Comisión de Fomento|Comisión Municipal|Junta de Gobierno|Distrito Ciudad|Ciudad) (del |de )/,'').trim() : null;
  }

  // Devuelve {municipio, barrio, provincia, fuente, osmOk}.
  // fuente: 'georef' (municipio oficial), 'georef-depto' (Georef respondió pero ese punto no tiene
  // municipio en sus datos: se completó con OSM o es zona rural), 'osm' (Georef no respondió) o null.
  async function detectar(lat, lng){
    let municipio = null, provincia = null, departamento = null, barrio = null;
    let georefOk = false, osmOk = false, fuente = null;

    // 1) Georef (IGN/INDEC): límites oficiales. Un reintento porque a veces falla.
    for(let i = 0; i < 2 && !georefOk; i++){
      try{
        const u = ((await getJSON('https://apis.datos.gob.ar/georef/api/ubicacion?lat='+lat+'&lon='+lng, 6000)) || {}).ubicacion || {};
        georefOk = true;
        provincia = (u.provincia && u.provincia.nombre) || null;
        departamento = (u.departamento && u.departamento.nombre) || null;
        municipio = (u.municipio && u.municipio.nombre) || null;
        if(municipio) fuente = 'georef';
      }catch(e){}
    }

    // 2) Nominatim (OSM): barrio de referencia, y municipio cuando Georef no lo tiene
    //    (p. ej. Puerto Deseado, o comunas rurales de Córdoba)
    try{
      const a = ((await getJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+lat+'&lon='+lng+'&zoom=14&accept-language=es', 8000)) || {}).address || {};
      osmOk = true;
      if(!provincia) provincia = a.state || null;
      // ¿OSM ubica el punto en el mismo departamento/partido que Georef? (según la provincia viene en uno u otro campo)
      const distritos = [a.state_district, a.county].map(sinDivision).filter(Boolean);
      const coincide = !departamento || !distritos.length || distritos.some(function(d){ return clave(d) === clave(departamento); });

      if(!municipio && coincide){
        const sd = a.state_district || '';
        const gobierno = sinGobierno(a.municipality) ||
          (/^Partido /.test(sd) ? sinDivision(sd) : null) ||   // en Buenos Aires el partido es el municipio
          (/^Comuna \d+$/.test(sd) ? sd : null);                // en CABA, la comuna
        const localidad = georefOk ? sinGobierno(a.city || a.town || a.village || a.hamlet) : null;
        municipio = gobierno || localidad;
        if(municipio) fuente = georefOk ? 'georef-depto' : 'osm';
      }
      const b = sinGobierno(a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city || a.city_district || null);
      // se descarta si es solo el nombre de la provincia, salvo que también sea el del municipio
      // (Mendoza, Salta, Santa Fe, San Juan...: "Ciudad de Mendoza" es la ciudad, no la provincia)
      const esLaCiudad = clave(b) === clave(municipio);
      if(b && coincide && (esLaCiudad || (clave(b) !== clave(provincia) && clave(b) !== 'buenos aires'))) barrio = b;
    }catch(e){}

    // Georef respondió pero no hay municipio ni localidad: es zona rural del departamento
    if(!municipio && departamento){ municipio = departamento + RURAL; fuente = 'georef-depto'; barrio = null; }
    return {municipio: municipio || SIN_DATO, barrio: barrio, provincia: provincia, fuente: fuente, osmOk: osmOk};
  }

  // Cómo se muestra un reporte: {municipio, provincia, barrio, rural, clave}.
  // clave agrupa por municipio Y provincia (hay "Pilar" en Buenos Aires y en Córdoba).
  // Georef devuelve cada comuna de CABA como si fuera un municipio; se muestran juntas como CABA.
  function zona(p){
    const m = p.municipio || SIN_DATO;
    if(m === SIN_DATO) return {municipio:SIN_DATO, provincia:null, barrio:null, rural:false, clave:SIN_DATO};
    const comuna = (!p.provincia || p.provincia === CABA) && /^Comuna \d+$/.test(m) ? m : null;
    if(comuna || p.provincia === CABA){
      return {municipio:'CABA', provincia:null, rural:false, clave:'CABA',
              barrio: p.barrio ? p.barrio + (comuna ? ' ('+comuna+')' : '') : comuna};
    }
    let barrio = p.barrio || null;
    if(barrio && clave(barrio) === clave(m)) barrio = m + ' (ciudad)';
    const provincia = PROVINCIA_CORTA[p.provincia] || p.provincia || null;
    return {municipio:m, provincia:provincia, barrio:barrio, rural:m.endsWith(RURAL), clave:m+'|'+(provincia || '')};
  }

  // Reportes viejos sin provincia: si ese municipio aparece en una sola provincia en el resto
  // de los datos, se completa (solo en memoria, para mostrar) y así no se parte en dos en el ranking.
  function completarProvincias(lista){
    const provs = {};
    lista.forEach(function(p){
      if(p.provincia && p.municipio) (provs[p.municipio] = provs[p.municipio] || new Set()).add(p.provincia);
    });
    lista.forEach(function(p){
      if(!p.provincia && provs[p.municipio] && provs[p.municipio].size === 1) p.provincia = [...provs[p.municipio]][0];
    });
  }

  // Para agrupar variantes del mismo barrio: "Barrio Parque El Remanso" y "El Remanso"
  function claveBarrio(b){
    return clave(b).replace(/^barrio (parque )?/,'');
  }

  window.Ubicacion = {detectar: detectar, zona: zona, completarProvincias: completarProvincias,
                      claveBarrio: claveBarrio, SIN_DATO: SIN_DATO};
})();
