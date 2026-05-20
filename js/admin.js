function renderizarPreviewImagenes(files, previewId) {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    if (!files?.length) {
        preview.innerHTML = '';
        return;
    }

    preview.innerHTML = '';
    Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            preview.insertAdjacentHTML('beforeend', `
                <img src="${event.target.result}" style="width: 110px; height: 82px; object-fit: cover; border-radius: 10px; border: 1px solid #7ca35a;">
            `);
        };
        reader.readAsDataURL(file);
    });
    preview.style.display = 'flex';
    preview.style.flexWrap = 'wrap';
    preview.style.gap = '10px';
}

const MAX_IMAGENES_POR_CONTENIDO = 3;
const MAX_MENSAJE_TELEGRAM_LENGTH = 4096;
const archivosAcumuladosPorInput = {};

function obtenerClaveArchivo(file) {
    return [file?.name || '', file?.size || 0, file?.lastModified || 0].join('__');
}

function sincronizarInputConArchivos(input, files = []) {
    if (!input) return;
    const dataTransfer = new DataTransfer();
    Array.from(files || []).forEach((file) => dataTransfer.items.add(file));
    input.files = dataTransfer.files;
}

function obtenerArchivosAcumulados(inputId) {
    return archivosAcumuladosPorInput[inputId] || [];
}

function validarMaximoImagenes(urls = [], files = null, contexto = 'contenido') {
    const total = (urls?.length || 0) + (files?.length || 0);
    if (total > MAX_IMAGENES_POR_CONTENIDO) {
        throw new Error(`Solo se permiten hasta ${MAX_IMAGENES_POR_CONTENIDO} imágenes por ${contexto}.`);
    }
}

function configurarInputImagenesConLimite(inputId, previewId, contexto) {
    const input = document.getElementById(inputId);
    if (!input) return;
    archivosAcumuladosPorInput[inputId] = [];
    input.addEventListener('change', (event) => {
        const nuevos = Array.from(event.target.files || []);
        if (!nuevos.length) return;

        const actuales = obtenerArchivosAcumulados(inputId);
        const mapa = new Map(actuales.map((file) => [obtenerClaveArchivo(file), file]));
        nuevos.forEach((file) => {
            mapa.set(obtenerClaveArchivo(file), file);
        });
        const acumulados = Array.from(mapa.values());

        if (acumulados.length > MAX_IMAGENES_POR_CONTENIDO) {
            mostrarMensaje(`Solo podés seleccionar hasta ${MAX_IMAGENES_POR_CONTENIDO} imágenes para ${contexto}.`, false);
            sincronizarInputConArchivos(event.target, actuales);
            return;
        }

        archivosAcumuladosPorInput[inputId] = acumulados;
        sincronizarInputConArchivos(event.target, acumulados);
        renderizarPreviewImagenes(acumulados, previewId);
    });
}

function limpiarInputImagenes(inputId, previewId) {
    archivosAcumuladosPorInput[inputId] = [];
    const input = document.getElementById(inputId);
    if (input) input.value = '';

    const preview = document.getElementById(previewId);
    if (preview) {
        preview.innerHTML = '';
        preview.style.display = '';
    }
}

window.limpiarInputImagenes = limpiarInputImagenes;

async function subirMultiplesImagenes(bucket, files, prefijo) {
    const imagenes = [];
    for (const file of Array.from(files || [])) {
        const archivoLimpio = typeof sanitizeImageBeforeUpload === 'function'
            ? await sanitizeImageBeforeUpload(file)
            : file;
        const ext = (archivoLimpio.name.split('.').pop() || 'jpg').toLowerCase();
        const fileName = `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabaseClient.storage.from(bucket).upload(fileName, archivoLimpio, {
            contentType: archivoLimpio.type || undefined
        });
        if (error) {
            const mensaje = String(error.message || '').toLowerCase();
            const bucketFaltante = error.statusCode === '400' || error.statusCode === 400 || mensaje.includes('bucket') || mensaje.includes('not found');
            if (bucketFaltante) {
                throw new Error(`No existe o no está listo el bucket "${bucket}" en Supabase Storage.`);
            }
            throw error;
        }
        imagenes.push(supabaseClient.storage.from(bucket).getPublicUrl(fileName).data.publicUrl);
    }
    return imagenes;
}

function obtenerReferenciaStorageDesdeUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        const base = new URL(SUPABASE_URL);
        if (parsed.origin !== base.origin) return null;

        const marker = '/storage/v1/object/public/';
        const index = parsed.pathname.indexOf(marker);
        if (index === -1) return null;

        const relativePath = parsed.pathname.slice(index + marker.length);
        const segments = relativePath.split('/').filter(Boolean);
        if (segments.length < 2) return null;

        const bucket = segments.shift();
        const path = decodeURIComponent(segments.join('/'));
        return bucket && path ? { bucket, path } : null;
    } catch (error) {
        return null;
    }
}

async function eliminarArchivoStoragePorUrl(url) {
    const referencia = obtenerReferenciaStorageDesdeUrl(url);
    if (!referencia) return { success: false, skipped: true };

    const { error } = await supabaseClient.storage.from(referencia.bucket).remove([referencia.path]);
    if (error) {
        console.warn(`No se pudo eliminar ${referencia.path} de ${referencia.bucket}`, error);
        return { success: false, error };
    }
    return { success: true };
}

async function eliminarArchivosStoragePorUrls(urls = []) {
    const unicos = Array.from(new Set((urls || []).filter(Boolean)));
    const resultados = [];
    for (const url of unicos) {
        resultados.push(await eliminarArchivoStoragePorUrl(url));
    }
    return resultados;
}

window.obtenerReferenciaStorageDesdeUrl = obtenerReferenciaStorageDesdeUrl;
window.eliminarArchivoStoragePorUrl = eliminarArchivoStoragePorUrl;
window.eliminarArchivosStoragePorUrls = eliminarArchivosStoragePorUrls;

let cacheProductosTieneTipoCultivo = null;
let cacheProductosTieneIndicaSativa = null;

function parsearPerfilIndicaSativa(valor) {
    const texto = String(valor || '').trim();
    const matchIndica = texto.match(/(\d+(?:[.,]\d+)?)\s*%\s*indica/i);
    const matchSativa = texto.match(/(\d+(?:[.,]\d+)?)\s*%\s*sativa/i);
    return {
        indica: matchIndica ? parseFloat(matchIndica[1].replace(',', '.')) : null,
        sativa: matchSativa ? parseFloat(matchSativa[1].replace(',', '.')) : null
    };
}

function construirPerfilIndicaSativa(indica, sativa) {
    const indicaNum = Number(indica);
    const sativaNum = Number(sativa);
    const indicaValida = Number.isFinite(indicaNum);
    const sativaValida = Number.isFinite(sativaNum);
    if (!indicaValida && !sativaValida) return null;
    const indicaTexto = indicaValida ? `${indicaNum}% Indica` : null;
    const sativaTexto = sativaValida ? `${sativaNum}% Sativa` : null;
    return [indicaTexto, sativaTexto].filter(Boolean).join(' - ');
}

function normalizarTipoCultivoAdmin(tipoCultivo) {
    const valor = String(tipoCultivo || '').trim().toLowerCase();
    if (valor === 'exterior') return 'exterior';
    if (valor === 'dispositivos_pipas' || valor === 'parafernalia_accesorios') return valor;
    return 'invernaculo';
}

function productoAdminEsArticuloTipo(tipoCultivo) {
    const normalizado = normalizarTipoCultivoAdmin(tipoCultivo);
    return normalizado === 'dispositivos_pipas' || normalizado === 'parafernalia_accesorios';
}

function obtenerTipoCatalogoProductoAdmin(producto = {}) {
    const cepa = String(producto.cepa || '').trim();
    if (cepa.startsWith('ARTICULO:')) return normalizarTipoCultivoAdmin(cepa.slice('ARTICULO:'.length));
    return normalizarTipoCultivoAdmin(producto.tipo_cultivo);
}

function obtenerEtiquetaTipoCultivoAdmin(tipoCultivo) {
    const normalizado = normalizarTipoCultivoAdmin(tipoCultivo);
    if (normalizado === 'exterior') return 'STANDARD';
    if (normalizado === 'dispositivos_pipas') return 'Dispositivos y pipas';
    if (normalizado === 'parafernalia_accesorios') return 'Parafernalia y Accesorios';
    return 'PREMIUM';
}

function obtenerEtiquetaProductoAdmin(producto = {}) {
    return obtenerEtiquetaTipoCultivoAdmin(obtenerTipoCatalogoProductoAdmin(producto));
}

function errorEsColumnaTipoCultivoFaltante(error) {
    const mensaje = String(error?.message || '').toLowerCase();
    const codigo = String(error?.code || '').toUpperCase();
    return codigo === 'PGRST204' || (mensaje.includes('tipo_cultivo') && (mensaje.includes('schema cache') || mensaje.includes('column')));
}

function errorEsColumnaIndicaSativaFaltante(error) {
    const mensaje = String(error?.message || '').toLowerCase();
    const codigo = String(error?.code || '').toUpperCase();
    return codigo === 'PGRST204' || mensaje.includes('indica_sativa');
}

function errorEsColumnaStockFaltante(error) {
    const mensaje = String(error?.message || '').toLowerCase();
    return mensaje.includes('stock_packs')
        || mensaje.includes('bajo_stock_packs')
        || mensaje.includes('stock_activo')
        || mensaje.includes('pack_gramos');
}

function quitarCamposStock(payload = {}) {
    const { stock_packs, bajo_stock_packs, stock_activo, pack_gramos, ...sinStock } = payload;
    return sinStock;
}

function obtenerPayloadStockAdmin(prefix) {
    const stockPacks = normalizarEnteroNoNegativo(document.getElementById(`${prefix}StockPacks`)?.value, 0);
    const bajoStockPacks = normalizarEnteroNoNegativo(document.getElementById(`${prefix}BajoStockPacks`)?.value, 2);
    const stockActivo = document.getElementById(`${prefix}StockActivo`)?.checked !== false;
    return {
        stock_packs: stockPacks,
        bajo_stock_packs: bajoStockPacks,
        stock_activo: stockActivo,
        pack_gramos: PACK_GRAMOS_DEFAULT
    };
}

function renderEstadoStockAdmin(producto = {}) {
    const stock = obtenerInfoStockProducto(producto);
    if (!stock.stockActivo) return '<span class="stock-admin-pill neutral">Stock inactivo</span>';
    if (stock.sinStock) return '<span class="stock-admin-pill sin-stock">SIN STOCK</span>';
    if (stock.bajoStock) return `<span class="stock-admin-pill bajo-stock">Poca disponibilidad · ${stock.stockPacks} packs</span>`;
    return `<span class="stock-admin-pill disponible">${formatearPacksDisponibles(stock.stockPacks, stock.gramosDisponibles)}</span>`;
}

function actualizarEquivalenciaStockAdmin(prefix) {
    const input = document.getElementById(`${prefix}StockPacks`);
    const output = document.getElementById(`${prefix}StockEquivalente`);
    if (!input || !output) return;
    const packs = normalizarEnteroNoNegativo(input.value, 0);
    output.textContent = formatearPacksDisponibles(packs, packs * PACK_GRAMOS_DEFAULT);
}

async function productosTieneTipoCultivo() {
    if (cacheProductosTieneTipoCultivo !== null) return cacheProductosTieneTipoCultivo;
    const { error } = await supabaseClient.from('productos').select('tipo_cultivo').limit(1);
    cacheProductosTieneTipoCultivo = !error || !errorEsColumnaTipoCultivoFaltante(error);
    return cacheProductosTieneTipoCultivo;
}

async function productosTieneIndicaSativa() {
    return cacheProductosTieneIndicaSativa !== false;
}

function marcarProductosSinTipoCultivo() {
    cacheProductosTieneTipoCultivo = false;
}

function marcarProductosSinIndicaSativa() {
    cacheProductosTieneIndicaSativa = false;
}

async function actualizarProductoConCompatibilidad(id, updates) {
    const variantes = [];
    let base = { ...updates };

    const incluirTipoCultivo = await productosTieneTipoCultivo();
    if (!incluirTipoCultivo) {
        const { tipo_cultivo, ...sinTipo } = base;
        base = sinTipo;
    }

    const incluirIndicaSativa = await productosTieneIndicaSativa();
    if (!incluirIndicaSativa) {
        const { indica_sativa, ...sinIndica } = base;
        base = sinIndica;
    }

    variantes.push(base);

    const { indica_sativa, ...sinIndicaBase } = base;
    if (Object.keys(sinIndicaBase).length !== Object.keys(base).length) variantes.push(sinIndicaBase);

    const { tipo_cultivo, ...sinTipoBase } = base;
    if (Object.keys(sinTipoBase).length !== Object.keys(base).length) variantes.push(sinTipoBase);

    const sinStockBase = quitarCamposStock(base);
    if (Object.keys(sinStockBase).length !== Object.keys(base).length) variantes.push(sinStockBase);

    const { tipo_cultivo: _omitTipo, indica_sativa: _omitIndica, ...sinTipoNiIndica } = updates;
    variantes.push(sinTipoNiIndica);
    variantes.push(quitarCamposStock(sinTipoNiIndica));

    const vistas = new Set();
    const unicas = variantes.filter((variante) => {
        const clave = JSON.stringify(Object.keys(variante).sort().map((k) => [k, variante[k]]));
        if (vistas.has(clave)) return false;
        vistas.add(clave);
        return true;
    });

    let ultimoResultado = null;
    for (const variante of unicas) {
        ultimoResultado = await supabaseClient.from('productos').update(variante).eq('id', id);
        if (!ultimoResultado.error) return ultimoResultado;

        if (errorEsColumnaTipoCultivoFaltante(ultimoResultado.error)) marcarProductosSinTipoCultivo();
        if (errorEsColumnaIndicaSativaFaltante(ultimoResultado.error)) marcarProductosSinIndicaSativa();
        if (errorEsColumnaStockFaltante(ultimoResultado.error)) variantes.push(quitarCamposStock(variante));
    }

    return ultimoResultado;
}

async function insertarProductoConCompatibilidad(payload) {
    const incluirTipoCultivo = await productosTieneTipoCultivo();
    const incluirIndicaSativa = await productosTieneIndicaSativa();
    let payloadFinal = { ...payload };
    if (!incluirTipoCultivo) {
        const { tipo_cultivo, ...payloadSinTipo } = payloadFinal;
        payloadFinal = payloadSinTipo;
    }
    if (!incluirIndicaSativa) {
        const { indica_sativa, ...payloadSinIndica } = payloadFinal;
        payloadFinal = payloadSinIndica;
    }

    let query = supabaseClient.from('productos').insert([payloadFinal]).select().single();
    let resultado = await query;
    if (!resultado.error) return resultado;

    let payloadFallback = { ...payload };
    if (errorEsColumnaTipoCultivoFaltante(resultado.error)) {
        marcarProductosSinTipoCultivo();
        const { tipo_cultivo, ...payloadSinTipo } = payloadFallback;
        payloadFallback = payloadSinTipo;
    }
    if (errorEsColumnaIndicaSativaFaltante(resultado.error)) {
        marcarProductosSinIndicaSativa();
        const { indica_sativa, ...payloadSinIndica } = payloadFallback;
        payloadFallback = payloadSinIndica;
    }
    if (errorEsColumnaStockFaltante(resultado.error)) {
        payloadFallback = quitarCamposStock(payloadFallback);
    }

    if (payloadFallback === payload) return resultado;
    return supabaseClient.from('productos').insert([payloadFallback]).select().single();
}

window.errorEsColumnaTipoCultivoFaltante = errorEsColumnaTipoCultivoFaltante;
window.errorEsColumnaIndicaSativaFaltante = errorEsColumnaIndicaSativaFaltante;
window.insertarProductoConCompatibilidad = insertarProductoConCompatibilidad;
window.actualizarProductoConCompatibilidad = actualizarProductoConCompatibilidad;
window.productosTieneTipoCultivo = productosTieneTipoCultivo;
window.productosTieneIndicaSativa = productosTieneIndicaSativa;
window.marcarProductosSinTipoCultivo = marcarProductosSinTipoCultivo;
window.marcarProductosSinIndicaSativa = marcarProductosSinIndicaSativa;
window.parsearPerfilIndicaSativa = parsearPerfilIndicaSativa;
window.construirPerfilIndicaSativa = construirPerfilIndicaSativa;

async function cargarAdminData() {
    const cards = document.getElementById('adminCards');
    if (!cards) return;

    const [socios, solicitudes, productos, reservas] = await Promise.all([
        supabaseClient.from('socios').select('*', { count: 'exact', head: true }),
        supabaseClient.from('solicitudes_membresia').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabaseClient.from('productos').select('*', { count: 'exact', head: true }),
        supabaseClient.from('reservas_mensuales').select('*', { count: 'exact', head: true }).neq('estado', 'cancelado')
    ]);

    cards.innerHTML = `
        <div class="card"><div class="card-number">${socios.count || 0}</div><div class="card-label">Socios</div></div>
        <div class="card"><div class="card-number">${solicitudes.count || 0}</div><div class="card-label">Solicitudes</div></div>
        <div class="card"><div class="card-number">${productos.count || 0}</div><div class="card-label">Productos</div></div>
        <div class="card"><div class="card-number">${reservas.count || 0}</div><div class="card-label">Pedidos</div></div>
        <div class="card"><div class="card-number"><i class="fas fa-circle-question"></i></div><div class="card-label">Manual</div></div>
    `;

    await Promise.all([
        cargarHistoriaAdmin(),
        cargarActividadesAdmin(),
        cargarProductosAdmin(),
        cargarSolicitudesAdmin(),
        cargarSociosAdmin(),
        cargarReservasAdmin(),
        cargarSociosParaMensajes(),
        cargarTelegramInboxMensajes(),
        cargarHistorialMensajes()
    ]);
    if (typeof cargarGraficosDashboard === 'function') await cargarGraficosDashboard();
}

async function cargarHistoriaAdmin() {
    const container = document.getElementById('admin-historia');
    if (!container || typeof renderizarEditorHistoria !== 'function' || typeof obtenerConfigHistoriaActual !== 'function') return;
    const configHistoria = await obtenerConfigHistoriaActual();
    renderizarEditorHistoria(container, {
        titulo: 'Editar Nuestra Historia',
        prefijo: 'adminHistoria',
        botonGuardar: 'guardarHistoriaAdmin',
        configHistoria
    });
}

window.guardarHistoriaAdmin = async function() {
    try {
        if (typeof guardarHistoriaDesdeEditor === 'function') {
            await guardarHistoriaDesdeEditor('adminHistoria');
        }
        mostrarMensaje('Historia guardada', true);
    } catch (error) {
        mostrarMensaje('No se pudo guardar la historia', false);
    }
};

async function cargarActividadesAdmin() {
    const container = document.getElementById('admin-actividades');
    if (!container) return;
    const actividades = (await obtenerActividades()) || [];

    container.innerHTML = `
        <form id="formActividadAdmin">
            <h3>Nueva actividad</h3>
            <p style="color:var(--text-muted); margin: 8px 0 18px; line-height: 1.5;">Usá este formulario para crear actividades, sorteos o regalos. La fecha es obligatoria y el resto de los datos completan la ficha pública.</p>
            <div class="form-grid">
                <div class="form-group full-width">
                    <label style="color: #c8d8b5;">Tipo</label>
                    <select id="actividadTipoAdmin" style="background: rgba(8,15,6,0.8); border: 1px solid rgba(100,140,75,0.4); border-radius: 12px; padding: 12px; color: #e0ecd0;">
                        <option value="actividad">Actividad</option>
                        <option value="sorteo">Sorteo</option>
                        <option value="regalo">Regalo</option>
                    </select>
                </div>
                <div class="form-group full-width"><input type="text" id="actividadTituloAdmin" placeholder="Título" required></div>
                <div class="form-group"><input type="date" id="actividadFechaAdmin" required></div>
                <div class="form-group"><input type="time" id="actividadHoraAdmin"></div>
                <div class="form-group"><input type="text" id="actividadUbicacionAdmin" placeholder="Ubicación"></div>
                <div class="form-group full-width"><textarea id="actividadDescripcionAdmin" rows="3" placeholder="Descripción"></textarea></div>
            </div>
            <button type="submit" class="btn-submit">Crear</button>
        </form>
        <hr>
        ${actividades.length ? `
            <div class="admin-tabla-scroll">
            <table class="tabla-datos">
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Título</th><th></th></tr></thead>
                <tbody>${actividades.map((actividad) => `
                    <tr>
                        <td>${new Date(actividad.fecha).toLocaleDateString('es')}</td>
                        <td>${escapeHtml(actividad.tipo || 'actividad')}</td>
                        <td>${escapeHtml(actividad.titulo)}</td>
                        <td><button class="btn-eliminar" onclick="eliminarActividadAdmin('${actividad.id}')">Eliminar</button></td>
                    </tr>
                `).join('')}</tbody>
            </table>
            </div>
        ` : '<div class="loading">No hay actividades todavía.</div>'}
    `;

    document.getElementById('formActividadAdmin')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await supabaseClient.from('actividades').insert([{
            titulo: document.getElementById('actividadTituloAdmin').value,
            fecha: document.getElementById('actividadFechaAdmin').value,
            hora: document.getElementById('actividadHoraAdmin').value,
            ubicacion: document.getElementById('actividadUbicacionAdmin').value,
            descripcion: document.getElementById('actividadDescripcionAdmin').value,
            tipo: document.getElementById('actividadTipoAdmin').value
        }]);
        if (error) {
            mostrarMensaje(`No se pudo crear la actividad: ${error.message}`, false);
            return;
        }
        mostrarMensaje('Actividad creada', true);
        await cargarActividadesAdmin();
        if (typeof cargarActividadesPublicas === 'function') await cargarActividadesPublicas();
    });
}

window.eliminarActividadAdmin = async function(id) {
    if (!confirm('Eliminar actividad?')) return;
    const { error } = await supabaseClient.from('actividades').delete().eq('id', id);
    if (error) {
        mostrarMensaje(`No se pudo eliminar: ${error.message}`, false);
        return;
    }
    await cargarActividadesAdmin();
    if (typeof cargarActividadesPublicas === 'function') await cargarActividadesPublicas();
};

function calcularRangoHorarioEntrega(horaInicio = '18:00') {
    const match = String(horaInicio || '').match(/^(\d{2}):(\d{2})$/);
    if (!match) return { inicio: '18:00', fin: '20:00', texto: '18:00 a 20:00' };
    const inicioMinutos = Number(match[1]) * 60 + Number(match[2]);
    const finMinutos = (inicioMinutos + 120) % (24 * 60);
    const inicio = `${String(Math.floor(inicioMinutos / 60)).padStart(2, '0')}:${String(inicioMinutos % 60).padStart(2, '0')}`;
    const fin = `${String(Math.floor(finMinutos / 60)).padStart(2, '0')}:${String(finMinutos % 60).padStart(2, '0')}`;
    return { inicio, fin, texto: `${inicio} a ${fin}` };
}

function renderEntregasPeriodoAdmin(configMap, lugarEntrega) {
    return obtenerMesesEntregaProximos(3).map((periodo) => `
        <div class="form-group full-width entrega-periodo-admin">
            <h4>${escapeHtml(periodo.etiqueta)}</h4>
            <div class="entrega-periodo-grid">
                ${[1, 2].map((indice) => {
                    const entrega = obtenerEntregaPeriodoConfig(configMap, periodo.mesClave, indice);
                    const rango = calcularRangoHorarioEntrega(entrega.hora);
                    return `
                        <div class="entrega-slot-admin" data-mes-clave="${escapeHtml(periodo.mesClave)}" data-indice="${indice}">
                            <strong>Entrega ${indice}</strong>
                            <label>Fecha de entrega</label>
                            <input type="date" class="entrega-fecha-admin" value="${escapeHtml(entrega.fecha)}">
                            <label>Hora de inicio</label>
                            <input type="time" class="entrega-hora-admin" value="${escapeHtml(rango.inicio)}">
                            <label>Horario visible</label>
                            <input type="text" class="entrega-rango-admin" value="${escapeHtml(rango.texto)}" readonly>
                            <label>Lugar</label>
                            <input type="text" class="entrega-lugar-admin" value="${escapeHtml(entrega.lugar || lugarEntrega)}">
                            <label>Mensaje automatico para socios</label>
                            <textarea class="entrega-mensaje-admin" rows="3">${escapeHtml(entrega.mensaje)}</textarea>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

async function cargarEntregasAdmin() {
    const container = document.getElementById('admin-entregas');
    if (!container) return;
    const configMap = await cargarContenidoInstitucional();
    const lugarEntrega = configMap.lugar_entrega || 'Lugar de Siempre';

    container.innerHTML = `
        <h3 style="color:var(--text-strong); margin-bottom: 12px;">Entregas</h3>
        <p style="color:var(--text-muted); margin: 0 0 16px;">Configurá hasta dos entregas por mes. Actividades muestra los próximos 3 periodos; si una fecha no está cargada, aparece como entrega a confirmar.</p>
        <form id="formEntregaAdmin">
            <div class="form-grid">
                <div class="form-group full-width">
                    <label>Aviso automatico</label>
                    <input type="text" value="Tenes hasta 48 horas antes de la entrega para realizar tu reserva" readonly>
                </div>
                <div class="form-group full-width">
                    <label>Lugar por defecto visible en Actividades</label>
                    <input type="text" id="entregaLugarDefaultAdmin" value="${escapeHtml(lugarEntrega)}" required>
                </div>
                ${renderEntregasPeriodoAdmin(configMap, lugarEntrega)}
                <div class="form-group full-width">
                    <button type="submit" class="btn-submit">Guardar calendario de entregas</button>
                </div>
            </div>
        </form>
    `;

    container.querySelectorAll('.entrega-hora-admin').forEach((input) => {
        input.addEventListener('input', (event) => {
            const slot = event.target.closest('.entrega-slot-admin');
            const rango = calcularRangoHorarioEntrega(event.target.value);
            const visible = slot?.querySelector('.entrega-rango-admin');
            if (visible) visible.value = rango.texto;
        });
    });

    document.getElementById('formEntregaAdmin')?.addEventListener('submit', guardarEntregaAdmin);
}

async function guardarEntregaAdmin(event) {
    event.preventDefault();
    const lugarDefault = document.getElementById('entregaLugarDefaultAdmin')?.value?.trim() || 'Lugar de Siempre';
    const updates = [
        { clave: 'lugar_entrega', valor: lugarDefault },
        { clave: 'horas_limite_primer', valor: '48' },
        { clave: 'horas_limite_ultimo', valor: '48' }
    ];

    document.querySelectorAll('#admin-entregas .entrega-slot-admin').forEach((slot) => {
        const mesClave = slot.dataset.mesClave;
        const indice = slot.dataset.indice;
        const fecha = slot.querySelector('.entrega-fecha-admin')?.value || '';
        const hora = slot.querySelector('.entrega-hora-admin')?.value || '18:00';
        const lugar = slot.querySelector('.entrega-lugar-admin')?.value?.trim() || lugarDefault;
        const mensaje = slot.querySelector('.entrega-mensaje-admin')?.value?.trim() || '';
        updates.push(
            { clave: obtenerClaveEntregaPeriodo(mesClave, indice, 'fecha'), valor: fecha },
            { clave: obtenerClaveEntregaPeriodo(mesClave, indice, 'hora'), valor: calcularRangoHorarioEntrega(hora).inicio },
            { clave: obtenerClaveEntregaPeriodo(mesClave, indice, 'lugar'), valor: lugar },
            { clave: obtenerClaveEntregaPeriodo(mesClave, indice, 'mensaje'), valor: mensaje }
        );
    });

    const configPreview = {
        ...(appState.configMap || {}),
        ...Object.fromEntries(updates.map((item) => [item.clave, item.valor]))
    };
    const proximas = obtenerEntregasConfiguradasFuturas(configPreview, 3);
    updates.push(
        { clave: 'fecha_entrega_primer', valor: '' },
        { clave: 'mensaje_entrega_primer', valor: '' },
        { clave: 'fecha_entrega_ultimo', valor: '' },
        { clave: 'mensaje_entrega_ultimo', valor: '' }
    );
    if (proximas[0]) {
        updates.push(
            { clave: 'fecha_entrega_primer', valor: proximas[0].fecha },
            { clave: 'mensaje_entrega_primer', valor: proximas[0].mensaje || '' }
        );
    }
    if (proximas[1]) {
        updates.push(
            { clave: 'fecha_entrega_ultimo', valor: proximas[1].fecha },
            { clave: 'mensaje_entrega_ultimo', valor: proximas[1].mensaje || '' }
        );
    }

    const fechasInvalidas = updates
        .filter((item) => item.clave.endsWith('_fecha') && item.valor && !parsearFechaConfigEntrega(item.valor));
    if (fechasInvalidas.length) {
        mostrarMensaje('Hay una fecha de entrega invalida.', false);
        return;
    }

    for (const item of updates) {
        const { error } = await supabaseClient.from('configuracion_sistema').upsert(item, { onConflict: 'clave' });
        if (error) {
            mostrarMensaje(`No se pudo guardar el calendario: ${error.message}`, false);
            return;
        }
    }

    appState.configMap = {
        ...(appState.configMap || {}),
        ...Object.fromEntries(updates.map((item) => [item.clave, item.valor]))
    };

    mostrarMensaje('Calendario de entregas guardado', true);
    if (typeof cargarActividadesPublicas === 'function') await cargarActividadesPublicas();
    await cargarEntregasAdmin();
}

async function cargarProductosAdmin() {
    const container = document.getElementById('admin-productos');
    if (!container) return;
    const productos = (await obtenerProductos()) || [];

    container.innerHTML = `
        <form id="formProductoAdmin">
            <h3>Nuevo producto</h3>
            <p style="color:var(--text-muted); margin: 8px 0 18px; line-height: 1.5;">Cargá variedades o artículos. Las variedades van a PREMIUM/STANDARD y los artículos aparecen en Artículos destacados.</p>
            <div class="form-grid">
                <div class="form-group full-width"><input type="text" id="productoNombreAdmin" placeholder="Nombre" required></div>
                <div class="form-group"><input type="text" id="productoCepaAdmin" placeholder="Cepa"></div>
                <div class="form-group"><input type="number" step="0.1" id="productoThcAdmin" placeholder="THC %"></div>
                <div class="form-group"><input type="number" step="0.1" id="productoCbdAdmin" placeholder="CBD %"></div>
                <div class="form-group">
                    <select id="productoTipoCultivoAdmin">
                        <option value="invernaculo">PREMIUM</option>
                        <option value="exterior">STANDARD</option>
                        <option value="dispositivos_pipas">Dispositivos y pipas</option>
                        <option value="parafernalia_accesorios">Parafernalia y Accesorios</option>
                    </select>
                </div>
                <div class="form-group"><input type="number" step="0.01" id="productoPrecioAdmin" placeholder="Precio base" value="1600"></div>
                <div class="form-group"><input type="number" min="0" step="1" id="productoStockPacks" placeholder="Stock en packs" value="0"></div>
                <div class="form-group"><input type="number" min="0" step="1" id="productoBajoStockPacks" placeholder="Bajo stock desde packs" value="2"></div>
                <div class="form-group stock-admin-control">
                    <label><input type="checkbox" id="productoStockActivo" checked> Controlar stock</label>
                    <small id="productoStockEquivalente">0 Packs (0g)</small>
                </div>
                <div class="form-group full-width"><textarea id="productoDescripcionAdmin" rows="3" placeholder="Descripción"></textarea></div>
                <div class="form-group full-width"><textarea id="productoImagenAdmin" rows="3" placeholder="URLs de imagen opcionales, una por línea"></textarea></div>
                <div class="form-group full-width">
                    <label style="color: #c8d8b5; margin-bottom: 8px;"><i class="fas fa-image"></i> O subir varias imágenes</label>
                    <input type="file" id="productoImagenFileAdmin" accept="image/*" multiple style="background: rgba(8,15,6,0.8); border: 1px solid rgba(100,140,75,0.4); border-radius: 12px; padding: 10px; color: #e0ecd0; width: 100%;">
                    <small class="privacy-upload-note"><i class="fas fa-shield-alt" aria-hidden="true"></i> Las imagenes son limpiadas automaticamente para proteger privacidad y ubicacion.</small>
                    <div id="productoPreview" style="margin: 10px 0; text-align: center;"></div>
                </div>
            </div>
            <button type="submit" class="btn-submit">Agregar</button>
        </form>
        <hr>
        ${productos.length ? `
            <div class="admin-tabla-scroll">
            <table class="tabla-datos admin-productos-tabla">
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Precio</th><th>Stock</th><th>Disp.</th><th></th></tr></thead>
                <tbody>${productos.map((producto) => `
                    <tr>
                        <td>${escapeHtml(producto.nombre)}</td>
                        <td>${escapeHtml(obtenerEtiquetaProductoAdmin(producto))}</td>
                        <td><input type="number" step="0.01" value="${producto.precio_por_10g || 1600}" class="admin-productos-precio" style="background:rgba(8,15,6,0.8);border:1px solid #7ca35a;border-radius:8px;padding:5px;color:#e0ecd0;" onchange="actualizarPrecioProductoAdmin('${producto.id}', this.value)"></td>
                        <td>${renderEstadoStockAdmin(producto)}</td>
                        <td><input type="checkbox" ${producto.disponible !== false ? 'checked' : ''} onchange="actualizarDisponibilidadProductoAdmin('${producto.id}', this.checked)"></td>
                        <td><div class="admin-productos-acciones"><button class="btn-editar" onclick="editarProductoAdmin('${producto.id}')">Editar</button><button class="btn-eliminar" onclick="eliminarProductoAdminClick('${producto.id}')">Eliminar</button></div></td>
                    </tr>
                `).join('')}</tbody>
            </table>
            </div>
        ` : '<div class="loading">No hay productos todavía.</div>'}
    `;

    configurarInputImagenesConLimite('productoImagenFileAdmin', 'productoPreview', 'productos');
    actualizarEquivalenciaStockAdmin('producto');
    document.getElementById('productoStockPacks')?.addEventListener('input', () => actualizarEquivalenciaStockAdmin('producto'));

    document.getElementById('formProductoAdmin')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const urlsManual = (document.getElementById('productoImagenAdmin').value || '')
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean);

        let imagenes = [...urlsManual];
        const imagenFiles = document.getElementById('productoImagenFileAdmin')?.files;
        if (imagenFiles?.length) {
            try {
                const subidas = await subirMultiplesImagenes('productos', imagenFiles, 'producto');
                imagenes = [...imagenes, ...subidas];
            } catch (error) {
                mostrarMensaje(`Las imágenes no se pudieron subir: ${error.message}`, false);
                return;
            }
        }

        const tipoSeleccionado = normalizarTipoCultivoAdmin(document.getElementById('productoTipoCultivoAdmin').value);
        const esArticulo = productoAdminEsArticuloTipo(tipoSeleccionado);
        const payloadProducto = {
            nombre: document.getElementById('productoNombreAdmin').value,
            cepa: esArticulo ? `ARTICULO:${tipoSeleccionado}` : document.getElementById('productoCepaAdmin').value,
            thc_porcentaje: esArticulo ? null : (parseFloat(document.getElementById('productoThcAdmin').value) || null),
            cbd_porcentaje: esArticulo ? null : (parseFloat(document.getElementById('productoCbdAdmin').value) || null),
            tipo_cultivo: esArticulo ? 'invernaculo' : tipoSeleccionado,
            precio_por_10g: parseFloat(document.getElementById('productoPrecioAdmin').value) || 1600,
            descripcion: document.getElementById('productoDescripcionAdmin').value,
            imagen_url: imagenes[0] || null,
            disponible: true,
            ...obtenerPayloadStockAdmin('producto')
        };
        const { data: productoCreado, error } = await insertarProductoConCompatibilidad(payloadProducto);
        if (error) {
            mostrarMensaje(`No se pudo crear el producto: ${error.message}`, false);
            return;
        }

        if (productoCreado?.id && imagenes.length) {
            for (const [index, imagenUrl] of imagenes.entries()) {
                const resultado = await agregarImagenProducto(productoCreado.id, imagenUrl, index);
                if (resultado.error) {
                    mostrarMensaje(`El producto se creó, pero una imagen no se pudo guardar: ${resultado.error.message}`, false);
                    break;
                }
            }
        }
        mostrarMensaje('Producto agregado', true);
        await cargarProductosAdmin();
        if (typeof cargarProductosPublicos === 'function') await cargarProductosPublicos();
    });
}

window.actualizarPrecioProductoAdmin = async function(id, precio) {
    const { error } = await supabaseClient.from('productos').update({ precio_por_10g: parseFloat(precio) }).eq('id', id);
    if (error) {
        mostrarMensaje(`No se pudo actualizar el precio: ${error.message}`, false);
        return;
    }
    mostrarMensaje('Precio actualizado', true);
    if (typeof cargarProductosPublicos === 'function') await cargarProductosPublicos();
};

window.actualizarDisponibilidadProductoAdmin = async function(id, disponible) {
    const { error } = await supabaseClient.from('productos').update({ disponible }).eq('id', id);
    if (error) {
        mostrarMensaje(`No se pudo actualizar disponibilidad: ${error.message}`, false);
        return;
    }
    mostrarMensaje(`Producto ${disponible ? 'disponible' : 'no disponible'}`, true);
    if (typeof cargarProductosPublicos === 'function') await cargarProductosPublicos();
};

window.eliminarProductoAdminClick = async function(id) {
    if (!confirm('Eliminar producto?')) return;
    const { error } = await supabaseClient.from('productos').delete().eq('id', id);
    if (error) {
        mostrarMensaje(`No se pudo eliminar: ${error.message}`, false);
        return;
    }
    mostrarMensaje('Producto eliminado', true);
    await cargarProductosAdmin();
    if (typeof cargarProductosPublicos === 'function') await cargarProductosPublicos();
};

async function cargarSolicitudesAdmin() {
    const container = document.getElementById('admin-solicitudes');
    if (!container) return;
    const { data, error } = await supabaseClient.from('solicitudes_membresia').select('*').eq('estado', 'pendiente').order('fecha_solicitud', { ascending: false });
    if (error) {
        container.innerHTML = '<div class="loading">No se pudieron cargar las solicitudes.</div>';
        return;
    }
    container.innerHTML = (data || []).length ? `
        <div class="admin-tabla-scroll">
        <table class="tabla-datos">
            <thead><tr><th>Fecha</th><th>Nombre</th><th>Telegram</th><th>Telefono</th><th>Acciones</th></tr></thead>
            <tbody>${data.map((solicitud) => `
                <tr>
                    <td>${new Date(solicitud.fecha_solicitud).toLocaleDateString('es')}</td>
                    <td>${escapeHtml(solicitud.nombre)} ${escapeHtml(solicitud.apellido)}</td>
                    <td>${solicitud.telegram_enabled && solicitud.telegram_chat_id ? 'Verificado' : 'Pendiente'}</td>
                    <td>${escapeHtml(solicitud.telefono)}</td>
                    <td><button class="btn-aprobar" onclick="aprobarSolicitudAdmin('${solicitud.id}')">Aprobar</button> <button class="btn-rechazar" onclick="rechazarSolicitudAdmin('${solicitud.id}')">Rechazar</button></td>
                </tr>
            `).join('')}</tbody>
        </table>
        </div>
    ` : '<div class="loading">No hay solicitudes pendientes.</div>';
}

window.aprobarSolicitudAdmin = async function(id) {
    const { data: solicitud, error: loadError } = await supabaseClient.from('solicitudes_membresia').select('*').eq('id', id).single();
    if (loadError || !solicitud) {
        mostrarMensaje('No se pudo cargar la solicitud', false);
        return;
    }
    const { error: insertError } = await supabaseClient.from('socios').insert([{
        nombre: solicitud.nombre,
        apellido: solicitud.apellido,
        cedula: solicitud.cedula,
        telefono: solicitud.telefono,
        email: solicitud.email,
        telegram_chat_id: solicitud.telegram_chat_id || null,
        telegram_username: solicitud.telegram_username || null,
        telegram_enabled: Boolean(solicitud.telegram_enabled && solicitud.telegram_chat_id),
        telegram_linked_at: solicitud.telegram_linked_at || null,
        estado: 'activo',
        rol: 'socio'
    }]);
    if (insertError) {
        mostrarMensaje(`No se pudo crear el socio: ${insertError.message}`, false);
        return;
    }
    await supabaseClient.from('solicitudes_membresia').update({ estado: 'aprobado' }).eq('id', id);
    mostrarMensaje('Socio aprobado', true);
    await cargarSolicitudesAdmin();
    await cargarAdminData();
};

window.rechazarSolicitudAdmin = async function(id) {
    const { error } = await supabaseClient.from('solicitudes_membresia').update({ estado: 'rechazado' }).eq('id', id);
    if (error) {
        mostrarMensaje(`No se pudo rechazar: ${error.message}`, false);
        return;
    }
    await cargarSolicitudesAdmin();
};

async function cargarSociosAdmin() {
    const container = document.getElementById('admin-socios');
    if (!container) return;
    const { data, error } = await supabaseClient.from('socios').select('*').order('fecha_ingreso', { ascending: false });
    if (error) {
        container.innerHTML = '<div class="loading">No se pudieron cargar los socios.</div>';
        return;
    }
    container.innerHTML = (data || []).length ? `
        <div class="admin-tabla-scroll">
        <table class="tabla-datos">
            <thead><tr><th>Nombre</th><th>Apellido</th><th>Cedula</th><th>Nro.</th><th>Telefono</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
            <tbody>${data.map((socio) => `
                <tr>
                    <td><input type="text" class="socio-edit-input" id="socioNombre_admin_${socio.id}" value="${escapeHtml(socio.nombre || '')}" placeholder="Nombre"></td>
                    <td><input type="text" class="socio-edit-input" id="socioApellido_admin_${socio.id}" value="${escapeHtml(socio.apellido || '')}" placeholder="Apellido"></td>
                    <td><input type="text" class="socio-edit-input small" id="socioCedula_admin_${socio.id}" value="${escapeHtml(socio.cedula || '')}" placeholder="Cedula"></td>
                    <td><input type="number" class="socio-edit-input tiny" id="socioNumero_admin_${socio.id}" value="${escapeHtml(socio.numero_socio || '')}" placeholder="Nro."></td>
                    <td>
                        <div class="telefono-edit-row">
                            <input type="tel" class="telefono-socio-input" id="socioTelefono_admin_${socio.id}" value="${escapeHtml(socio.telefono || '')}" placeholder="09XXXXXXX">
                        </div>
                    </td>
                    <td>
                        <select class="socio-edit-input tiny" id="socioRol_admin_${socio.id}">
                            <option value="socio" ${(socio.rol || 'socio') === 'socio' ? 'selected' : ''}>Socio</option>
                            <option value="admin" ${socio.rol === 'admin' ? 'selected' : ''}>Admin</option>
                            <option value="maestro" ${socio.rol === 'maestro' ? 'selected' : ''}>Maestro</option>
                        </select>
                    </td>
                    <td>
                        <select class="socio-edit-input small" id="socioEstado_admin_${socio.id}">
                            <option value="activo" ${(socio.estado || 'activo') === 'activo' ? 'selected' : ''}>Activo</option>
                            <option value="pendiente" ${socio.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="inactivo" ${socio.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                            <option value="rechazado" ${socio.estado === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                        </select>
                    </td>
                    <td><button type="button" class="btn-editar" onclick="guardarSocioAdmin('${socio.id}', 'admin')">Guardar</button></td>
                </tr>
            `).join('')}</tbody>
        </table>
        </div>
    ` : '<div class="loading">No hay socios.</div>';
}

function normalizarTelefonoSocioInput(valor) {
    return String(valor || '').replace(/[^\d+]/g, '').trim();
}

function obtenerValorCampoSocio(socioId, origen, campo) {
    return document.getElementById(`socio${campo}_${origen}_${socioId}`)?.value?.trim() || '';
}

window.guardarSocioAdmin = async function(socioId, origen = 'admin') {
    const nombre = obtenerValorCampoSocio(socioId, origen, 'Nombre');
    const apellido = obtenerValorCampoSocio(socioId, origen, 'Apellido');
    const cedula = obtenerValorCampoSocio(socioId, origen, 'Cedula');
    const numeroSocio = obtenerValorCampoSocio(socioId, origen, 'Numero');
    const telefono = normalizarTelefonoSocioInput(obtenerValorCampoSocio(socioId, origen, 'Telefono'));
    const rol = obtenerValorCampoSocio(socioId, origen, 'Rol') || 'socio';
    const estado = obtenerValorCampoSocio(socioId, origen, 'Estado') || 'activo';

    if (!nombre || !apellido) {
        mostrarMensaje('Nombre y apellido son obligatorios.', false);
        return;
    }

    const payload = {
        nombre,
        apellido,
        cedula: cedula || null,
        numero_socio: numeroSocio ? Number(numeroSocio) : null,
        telefono,
        rol,
        estado
    };

    const { error } = await supabaseClient
        .from('socios')
        .update(payload)
        .eq('id', socioId);

    if (error) {
        mostrarMensaje(`No se pudo guardar el socio: ${error.message}`, false);
        return;
    }

    mostrarMensaje('Socio actualizado', true);
    if (origen === 'admin') {
        await cargarSociosAdmin();
        await cargarSociosParaMensajes();
    }
    if (origen === 'maestro' && typeof cargarMaestroSocios === 'function') {
        await cargarMaestroSocios();
    }
};

function obtenerVariedadReservaAdmin(reserva) {
    const principal = reserva?.producto_nombre || reserva?.variedad || reserva?.variety || reserva?.productos?.nombre || 'Sin variedad registrada';
    return principal;
}

function obtenerEtiquetaEstadoReservaAdmin(estado) {
    const etiquetas = {
        pendiente: 'Pendiente de confirmacion',
        confirmado: 'Pedido recibido',
        entregado: 'Entrega confirmada',
        retirado: 'Entrega confirmada',
        cancelado: 'Cancelado'
    };
    return etiquetas[String(estado || 'pendiente').toLowerCase()] || estado || 'Pendiente';
}

function construirAccionesReservaAdmin(reserva, origen = 'admin') {
    const estado = String(reserva.estado || 'pendiente').toLowerCase();
    if (estado === 'cancelado') return '<span class="metric-label">Cancelada</span>';
    if (estado === 'entregado' || estado === 'retirado') return '<span class="metric-label">Cerrada</span>';
    if (estado === 'confirmado') {
        return `<button type="button" class="btn-aprobar" onclick="actualizarEstadoReservaAdmin('${reserva.id}', 'entregado', '${origen}')">Confirmar entrega</button>`;
    }
    return `<button type="button" class="btn-aprobar" onclick="actualizarEstadoReservaAdmin('${reserva.id}', 'confirmado', '${origen}')">Confirmar</button>`;
}

function renderizarTablaReservasAdmin(data, origen = 'admin') {
    return (data || []).length ? `
        <div class="admin-tabla-scroll">
        <table class="tabla-datos tabla-reservas-excel">
            <thead><tr><th>Fecha retiro</th><th>Socio</th><th>Variedad</th><th>Cantidad</th><th>Estado</th><th>Registrada</th><th>Accion</th></tr></thead>
            <tbody>${data.map((reserva) => `
                <tr>
                    <td data-label="Fecha retiro">${reserva.fecha_retiro ? new Date(reserva.fecha_retiro).toLocaleDateString('es-UY') : '-'}</td>
                    <td data-label="Socio">${escapeHtml(reserva.socios?.nombre || '-')} ${escapeHtml(reserva.socios?.apellido || '')}</td>
                    <td data-label="Variedad">${escapeHtml(obtenerVariedadReservaAdmin(reserva))}</td>
                    <td data-label="Cantidad">${escapeHtml(formatearPacksReserva(reserva.cantidad_gramos))}</td>
                    <td data-label="Estado"><span class="reserva-status-badge estado-${escapeHtml(String(reserva.estado || 'pendiente').toLowerCase())}">${escapeHtml(obtenerEtiquetaEstadoReservaAdmin(reserva.estado))}</span></td>
                    <td data-label="Registrada">${reserva.created_at ? new Date(reserva.created_at).toLocaleDateString('es-UY') : '-'}</td>
                    <td data-label="Accion">${construirAccionesReservaAdmin(reserva, origen)}</td>
                </tr>
            `).join('')}</tbody>
        </table>
        </div>
    ` : '<div class="empty-state"><i class="fas fa-box-open"></i><strong>Sin pedidos por ahora</strong><span>Cuando los socios realicen pedidos mensuales, van a aparecer aca.</span></div>';
}

async function cargarReservasAdmin() {
    const container = document.getElementById('admin-reservasAdmin');
    if (!container) return;
    const { data, error } = await supabaseClient.from('reservas_mensuales').select('*, socios(nombre, apellido)').order('fecha_retiro', { ascending: false });
    if (error) {
        container.innerHTML = '<div class="loading">No se pudieron cargar las reservas.</div>';
        return;
    }
    container.innerHTML = `
        <h3 style="color:var(--text-strong); margin-bottom: 12px;">Pedidos</h3>
        <p style="color:var(--text-muted); margin: 0 0 12px;">Control de pedidos mensuales: variedad, packs, fecha de retiro y estado operativo.</p>
        ${renderizarTablaReservasAdmin(data, 'admin')}
    `;
}

window.actualizarEstadoReservaAdmin = async function(reservaId, estado, origen = 'admin') {
    const { data: reserva, error: loadError } = await supabaseClient
        .from('reservas_mensuales')
        .select('id, socio_id, cantidad_gramos, fecha_retiro, estado')
        .eq('id', reservaId)
        .single();
    if (loadError || !reserva) {
        mostrarMensaje('No se pudo cargar la reserva.', false);
        return;
    }

    const { error } = await supabaseClient
        .from('reservas_mensuales')
        .update({ estado })
        .eq('id', reservaId);
    if (error) {
        mostrarMensaje(`No se pudo actualizar la reserva: ${error.message}`, false);
        return;
    }

    if (typeof notificationService !== 'undefined' && reserva.socio_id) {
        const tipo = estado === 'entregado' ? 'retiro_disponible' : 'reserva_confirmada';
        const mensaje = notificationService.render(tipo, {
            grams: reserva.cantidad_gramos,
            retiro: reserva.fecha_retiro ? new Date(reserva.fecha_retiro).toLocaleDateString('es-UY') : ''
        });
        notificationService
            .send(reserva.socio_id, mensaje, { type: tipo, channel: 'telegram', metadata: { reserva_id: reservaId, estado } })
            .catch((notifyError) => console.warn('No se pudo encolar notificacion de reserva admin:', notifyError));
    }

    mostrarMensaje(estado === 'entregado' ? 'Entrega confirmada' : 'Pedido recibido confirmado', true);
    await cargarReservasAdmin();
    if (typeof cargarMaestroReservas === 'function') await cargarMaestroReservas();
};

async function cargarSociosParaMensajes() {
    const select = document.getElementById('mensajeDestinatario');
    if (!select) return;
    const { data } = await supabaseClient.from('socios').select('id, nombre, apellido, telefono, telegram_enabled, telegram_chat_id').eq('estado', 'activo');
    select.innerHTML = '<option value="todos">Todos los socios</option>' + (data || []).map((socio) => `
        <option value="${socio.id}">${escapeHtml(socio.nombre)} ${escapeHtml(socio.apellido)}${socio.telegram_enabled ? ' · Telegram' : (socio.telefono ? ` · ${escapeHtml(socio.telefono)}` : '')}</option>
    `).join('');
}

async function cargarHistorialMensajes() {
    const container = document.getElementById('mensajesHistorial');
    if (!container) return;
    const { data, error } = await supabaseClient.from('notificaciones_programadas').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) {
        container.innerHTML = '<div class="loading">No se pudo cargar el historial.</div>';
        return;
    }
    container.innerHTML = (data || []).length ? data.map((mensaje) => `
        <div class="mensaje-item">
            <div class="mensaje-fecha">${new Date(mensaje.created_at).toLocaleString()}</div>
            <div class="mensaje-destino">Destino: ${mensaje.tipo === 'todos' ? 'Todos los socios' : 'Socio especifico'} · Canal: ${escapeHtml(mensaje.canal || 'telegram')}</div>
            <div class="mensaje-texto">${escapeHtml(mensaje.mensaje)}</div>
        </div>
    `).join('') : '<div class="loading">No hay mensajes enviados.</div>';
}

function obtenerNombreTelegramInbox(mensaje = {}) {
    const socioNombre = [mensaje.socios?.nombre, mensaje.socios?.apellido].filter(Boolean).join(' ').trim();
    return socioNombre || mensaje.display_name || (mensaje.username ? `@${mensaje.username}` : 'Usuario Telegram');
}

function construirItemTelegramInboxHTML(mensaje = {}) {
    const fecha = mensaje.message_date || mensaje.created_at;
    const fechaTexto = fecha ? new Date(fecha).toLocaleString('es-UY') : 'Fecha no disponible';
    const nombre = obtenerNombreTelegramInbox(mensaje);
    const identificador = mensaje.chat_id || mensaje.telegram_user_id || 'Sin identificador';
    const username = mensaje.username ? `@${mensaje.username}` : '';
    const texto = mensaje.text || '(Mensaje sin texto)';
    return `
        <div class="mensaje-item telegram-inbox-item">
            <div class="mensaje-fecha">${escapeHtml(fechaTexto)}</div>
            <div class="mensaje-destino">
                ${escapeHtml(nombre)}${username && username !== nombre ? ` · ${escapeHtml(username)}` : ''} · chat_id: ${escapeHtml(identificador)}
            </div>
            <div class="mensaje-texto">${escapeHtml(texto)}</div>
        </div>
    `;
}

async function cargarTelegramInboxMensajes() {
    const container = document.getElementById('telegramInboxMensajes');
    if (!container) return;
    container.innerHTML = '<div class="loading">Cargando mensajes recibidos...</div>';

    const { data, error } = await supabaseClient
        .from('telegram_mensajes_entrantes')
        .select('id, chat_id, telegram_user_id, username, display_name, text, message_date, created_at, socio_id, socios(nombre, apellido, email)')
        .order('created_at', { ascending: false })
        .limit(80);

    if (error) {
        console.error('No se pudo cargar la bandeja de Telegram:', error);
        container.innerHTML = '<div class="loading">No se pudieron cargar los mensajes recibidos.</div>';
        return;
    }

    container.innerHTML = (data || []).length
        ? data.map(construirItemTelegramInboxHTML).join('')
        : '<div class="empty-state"><i class="fab fa-telegram"></i><strong>Todavía no hay mensajes recibidos.</strong><span>Cuando un socio escriba al bot, va a aparecer acá.</span></div>';
}

function inicializarAcordeonesMensajesAdmin() {
    const acordeon = document.querySelector('#admin-mensajes .admin-mensajes-acordeon');
    inicializarAcordeonAdmin(acordeon, async (tipoCultivo) => {
        if (tipoCultivo === 'bandeja-entrada') await cargarTelegramInboxMensajes();
    });
}

function inicializarAcordeonAdmin(acordeon, onOpen) {
    if (!acordeon || acordeon.dataset.inicializado === 'true') return;
    acordeon.dataset.inicializado = 'true';
    acordeon.querySelectorAll('.productos-toggle').forEach((toggle) => {
        toggle.addEventListener('click', async () => {
            const tipoCultivo = toggle.dataset.tipoCultivo;
            const columna = toggle.closest('.productos-columna');
            const panel = acordeon.querySelector(`.productos-panel[data-tipo-cultivo="${tipoCultivo}"]`);
            if (!columna || !panel || columna.hidden) return;

            const expandido = toggle.getAttribute('aria-expanded') === 'true';
            acordeon.querySelectorAll('.productos-columna.activa').forEach((columnaActiva) => {
                if (columnaActiva === columna) return;
                const toggleActivo = columnaActiva.querySelector('.productos-toggle');
                if (toggleActivo) toggleActivo.setAttribute('aria-expanded', 'false');
                columnaActiva.classList.remove('activa');
            });
            acordeon.querySelectorAll('.productos-panel').forEach((panelActivo) => {
                if (panelActivo !== panel) panelActivo.hidden = true;
            });

            toggle.setAttribute('aria-expanded', String(!expandido));
            panel.hidden = expandido;
            columna.classList.toggle('activa', !expandido);
            if (!expandido && typeof onOpen === 'function') await onOpen(tipoCultivo);
        });
    });
}

function rolActualNormalizado() {
    return String(appState?.rolUsuario || 'socio').toLowerCase();
}

function manualEsVisibleParaRol(elemento, rol) {
    const roles = String(elemento?.dataset?.manualRoles || '')
        .split(/\s+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    return !roles.length || roles.includes(rol);
}

function aplicarVisibilidadManualPorRol() {
    const acordeon = document.querySelector('#admin-manual .admin-manual-acordeon');
    if (!acordeon) return;
    const rol = rolActualNormalizado();
    const togglesVisibles = [];

    acordeon.querySelectorAll('.productos-columna').forEach((columna) => {
        const toggle = columna.querySelector('.productos-toggle');
        const panel = toggle ? acordeon.querySelector(`.productos-panel[data-tipo-cultivo="${toggle.dataset.tipoCultivo}"]`) : null;
        const visible = manualEsVisibleParaRol(columna, rol) && (!panel || manualEsVisibleParaRol(panel, rol));
        columna.hidden = !visible;
        if (panel) panel.hidden = true;
        columna.classList.remove('activa');
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            if (visible) togglesVisibles.push(toggle);
        }
    });

    const primerToggle = togglesVisibles[0];
    if (!primerToggle) return;
    const primeraColumna = primerToggle.closest('.productos-columna');
    const primerPanel = acordeon.querySelector(`.productos-panel[data-tipo-cultivo="${primerToggle.dataset.tipoCultivo}"]`);
    primerToggle.setAttribute('aria-expanded', 'true');
    if (primeraColumna) primeraColumna.classList.add('activa');
    if (primerPanel) primerPanel.hidden = false;
}

function inicializarAcordeonesManualAdmin() {
    const acordeon = document.querySelector('#admin-manual .admin-manual-acordeon');
    aplicarVisibilidadManualPorRol();
    inicializarAcordeonAdmin(acordeon);
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarAcordeonesMensajesAdmin();
    inicializarAcordeonesManualAdmin();

    document.querySelectorAll('.nav-admin-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.adminSection;
            const panel = document.getElementById(`admin-${section}`);
            const item = btn.closest('.admin-accordion-item');
            const estaAbierto = btn.getAttribute('aria-expanded') === 'true' && panel && panel.style.display !== 'none';

            document.querySelectorAll('.nav-admin-btn').forEach((other) => {
                other.classList.remove('active');
                other.setAttribute('aria-expanded', 'false');
                other.closest('.productos-columna')?.classList.remove('activa');
                other.closest('.admin-accordion-item')?.classList.remove('admin-accordion-open');
            });
            const tone = getComputedStyle(btn).getPropertyValue('--admin-tone').trim() || 'rgba(124, 163, 90, 0.28)';
            const admin = document.getElementById('admin');
            if (admin) {
                admin.classList.add('admin-panel-selected');
                admin.style.setProperty('--admin-panel-bg', tone);
            }
            const empty = document.getElementById('admin-empty');
            ['historia', 'manual', 'productos', 'actividades', 'entregas', 'solicitudes', 'socios', 'reservasAdmin', 'mensajes'].forEach((key) => {
                const el = document.getElementById(`admin-${key}`);
                if (el) el.style.display = key === section ? 'block' : 'none';
            });
            if (estaAbierto && panel) {
                panel.style.display = 'none';
                if (empty) empty.style.display = '';
                return;
            }
            btn.classList.add('active');
            btn.setAttribute('aria-expanded', 'true');
            btn.closest('.productos-columna')?.classList.add('activa');
            item?.classList.add('admin-accordion-open');
            if (empty) empty.style.display = 'none';
            if (section === 'historia' && typeof cargarHistoriaAdmin === 'function') cargarHistoriaAdmin();
            if (section === 'manual') aplicarVisibilidadManualPorRol();
            if (section === 'entregas') cargarEntregasAdmin();
            if (section === 'reservasAdmin' && typeof cargarReservasAdmin === 'function') cargarReservasAdmin();
            if (section === 'mensajes') {
                cargarTelegramInboxMensajes();
                cargarHistorialMensajes();
            }
        });
    });

    document.getElementById('enviarMensajeBtn')?.addEventListener('click', async () => {
        const destinatario = document.getElementById('mensajeDestinatario').value;
        const asunto = document.getElementById('mensajeAsunto').value;
        const texto = document.getElementById('mensajeTexto').value;
        if (!texto.trim()) {
            mostrarMensaje('Escribe un mensaje', false);
            return;
        }
        const mensajeCompleto = asunto ? `${asunto}\n\n${texto}` : texto;
        if (mensajeCompleto.length > MAX_MENSAJE_TELEGRAM_LENGTH) {
            mostrarMensaje(`El mensaje no puede superar ${MAX_MENSAJE_TELEGRAM_LENGTH} caracteres.`, false);
            return;
        }
        if (destinatario === 'todos') {
            const { data: socios } = await supabaseClient.from('socios').select('id, telegram_enabled, telegram_chat_id').eq('estado', 'activo');
            const vinculados = (socios || []).filter((socio) => socio.telegram_enabled && socio.telegram_chat_id);
            if (!vinculados.length) {
                mostrarMensaje('No hay socios con Telegram vinculado todavia.', false);
                return;
            }
            for (const socio of vinculados) {
                await notificationService.send(socio.id, mensajeCompleto, { type: 'aviso_general', channel: 'telegram' });
            }
            mostrarMensaje(`Mensaje cargado para ${vinculados.length} socios con Telegram`, true);
        } else {
            const { data: socio } = await supabaseClient
                .from('socios')
                .select('telegram_enabled, telegram_chat_id')
                .eq('id', destinatario)
                .maybeSingle();
            if (!socio?.telegram_enabled || !socio?.telegram_chat_id) {
                mostrarMensaje('Ese socio todavia no tiene Telegram vinculado.', false);
                return;
            }
            await notificationService.send(destinatario, mensajeCompleto, { type: 'aviso_general', channel: 'telegram' });
            mostrarMensaje('Mensaje cargado', true);
        }
        document.getElementById('mensajeAsunto').value = '';
        document.getElementById('mensajeTexto').value = '';
        await cargarHistorialMensajes();
    });
});
