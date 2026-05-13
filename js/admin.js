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
        const ext = file.name.split('.').pop();
        const fileName = `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabaseClient.storage.from(bucket).upload(fileName, file);
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
    return String(tipoCultivo || '').trim().toLowerCase() === 'exterior' ? 'exterior' : 'invernaculo';
}

function obtenerEtiquetaTipoCultivoAdmin(tipoCultivo) {
    return normalizarTipoCultivoAdmin(tipoCultivo) === 'exterior' ? 'STANDARD' : 'PREMIUM';
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

    const { tipo_cultivo: _omitTipo, indica_sativa: _omitIndica, ...sinTipoNiIndica } = updates;
    variantes.push(sinTipoNiIndica);

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

    const [socios, solicitudes, noticias, productos, reservas] = await Promise.all([
        supabaseClient.from('socios').select('*', { count: 'exact', head: true }),
        supabaseClient.from('solicitudes_membresia').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabaseClient.from('noticias').select('*', { count: 'exact', head: true }),
        supabaseClient.from('productos').select('*', { count: 'exact', head: true }),
        supabaseClient.from('reservas_mensuales').select('*', { count: 'exact', head: true }).eq('estado', 'confirmado')
    ]);

    cards.innerHTML = `
        <div class="card"><div class="card-number">${socios.count || 0}</div><div class="card-label">Socios</div></div>
        <div class="card"><div class="card-number">${solicitudes.count || 0}</div><div class="card-label">Solicitudes</div></div>
        <div class="card"><div class="card-number">${noticias.count || 0}</div><div class="card-label">Noticias</div></div>
        <div class="card"><div class="card-number">${productos.count || 0}</div><div class="card-label">Productos</div></div>
        <div class="card"><div class="card-number">${reservas.count || 0}</div><div class="card-label">Reservas</div></div>
    `;

    await Promise.all([
        cargarHistoriaAdmin(),
        cargarNoticiasAdmin(),
        cargarActividadesAdmin(),
        cargarProductosAdmin(),
        cargarSolicitudesAdmin(),
        cargarSociosAdmin(),
        cargarReservasAdmin(),
        cargarSociosParaMensajes(),
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

async function cargarNoticiasAdmin() {
    const container = document.getElementById('admin-noticias');
    if (!container) return;
    const noticias = (await obtenerNoticias()) || [];

    container.innerHTML = `
        <form id="formNoticiaAdmin">
            <h3>Nueva noticia</h3>
            <p style="color:var(--text-muted); margin: 8px 0 18px; line-height: 1.5;">Completá título, contenido e imágenes opcionales. La noticia se publica al guardar y luego podés borrarla desde la tabla inferior.</p>
            <div class="form-grid">
                <div class="form-group full-width"><input type="text" id="noticiaTituloAdmin" placeholder="Título" required></div>
                <div class="form-group full-width"><textarea id="noticiaContenidoAdmin" rows="4" placeholder="Contenido" required></textarea></div>
                <div class="form-group"><input type="text" id="noticiaAutorAdmin" placeholder="Autor"></div>
            </div>
            <div style="margin: 15px 0;">
                <label style="color: #c8d8b5; display: block; margin-bottom: 8px;"><i class="fas fa-image"></i> Imágenes opcionales</label>
                <input type="file" id="noticiaImagenAdmin" accept="image/*" multiple style="background: rgba(8,15,6,0.8); border: 1px solid rgba(100,140,75,0.4); border-radius: 12px; padding: 10px; color: #e0ecd0; width: 100%;">
            </div>
            <div id="noticiaPreview" style="margin: 10px 0; text-align: center;"></div>
            <button type="submit" class="btn-submit">Publicar noticia</button>
        </form>
        <hr>
        ${noticias.length ? `
            <div class="admin-tabla-scroll">
            <table class="tabla-datos">
                <thead><tr><th>Fecha</th><th>Título</th><th>Imagen</th><th>Acciones</th></tr></thead>
                <tbody>${noticias.map((noticia) => `
                    <tr>
                        <td>${new Date(noticia.fecha_publicacion).toLocaleDateString('es')}</td>
                        <td>${escapeHtml(noticia.titulo)}</td>
                        <td>${normalizarListaImagenes(noticia.imagen_url).length ? 'Si' : 'No'}</td>
                        <td><button class="btn-eliminar" onclick="eliminarNoticiaAdmin('${noticia.id}')">Eliminar</button></td>
                    </tr>
                `).join('')}</tbody>
            </table>
            </div>
        ` : '<div class="loading">No hay noticias todavía.</div>'}
    `;

    configurarInputImagenesConLimite('noticiaImagenAdmin', 'noticiaPreview', 'noticias');

    document.getElementById('formNoticiaAdmin')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        let imagenes = [];
        const imagenFiles = document.getElementById('noticiaImagenAdmin')?.files;
        if (imagenFiles?.length) {
            try {
                imagenes = await subirMultiplesImagenes('noticias', imagenFiles, 'noticia');
            } catch (error) {
                mostrarMensaje(`Las imágenes no se pudieron subir: ${error.message}`, false);
                return;
            }
        }

        const { error } = await supabaseClient.from('noticias').insert([{
            titulo: document.getElementById('noticiaTituloAdmin').value,
            contenido: document.getElementById('noticiaContenidoAdmin').value,
            autor: document.getElementById('noticiaAutorAdmin').value || 'Admin',
            imagen_url: imagenes.length > 1 ? JSON.stringify(imagenes) : (imagenes[0] || null)
        }]);
        if (error) {
            mostrarMensaje(`No se pudo crear la noticia: ${error.message}`, false);
            return;
        }

        mostrarMensaje('Noticia publicada', true);
        await cargarNoticiasAdmin();
        if (typeof cargarNoticias === 'function') await cargarNoticias();
    });
}

window.eliminarNoticiaAdmin = async function(id) {
    if (!confirm('Eliminar noticia?')) return;
    const { error } = await supabaseClient.from('noticias').delete().eq('id', id);
    if (error) {
        mostrarMensaje(`No se pudo eliminar: ${error.message}`, false);
        return;
    }
    await cargarNoticiasAdmin();
    if (typeof cargarNoticias === 'function') await cargarNoticias();
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

async function cargarProductosAdmin() {
    const container = document.getElementById('admin-productos');
    if (!container) return;
    const productos = (await obtenerProductos()) || [];

    container.innerHTML = `
        <form id="formProductoAdmin">
            <h3>Nuevo producto</h3>
            <p style="color:var(--text-muted); margin: 8px 0 18px; line-height: 1.5;">Cargá nombre, tipo de cultivo, precio base e imágenes. La variedad se mostrará en el catálogo dentro de PREMIUM o STANDARD según la opción elegida.</p>
            <div class="form-grid">
                <div class="form-group full-width"><input type="text" id="productoNombreAdmin" placeholder="Nombre" required></div>
                <div class="form-group"><input type="text" id="productoCepaAdmin" placeholder="Cepa"></div>
                <div class="form-group"><input type="number" step="0.1" id="productoThcAdmin" placeholder="THC %"></div>
                <div class="form-group"><input type="number" step="0.1" id="productoCbdAdmin" placeholder="CBD %"></div>
                <div class="form-group">
                    <select id="productoTipoCultivoAdmin">
                        <option value="invernaculo">PREMIUM</option>
                        <option value="exterior">STANDARD</option>
                    </select>
                </div>
                <div class="form-group"><input type="number" step="0.01" id="productoPrecioAdmin" placeholder="Precio base" value="1600"></div>
                <div class="form-group full-width"><textarea id="productoDescripcionAdmin" rows="3" placeholder="Descripción"></textarea></div>
                <div class="form-group full-width"><textarea id="productoImagenAdmin" rows="3" placeholder="URLs de imagen opcionales, una por línea"></textarea></div>
                <div class="form-group full-width">
                    <label style="color: #c8d8b5; margin-bottom: 8px;"><i class="fas fa-image"></i> O subir varias imágenes</label>
                    <input type="file" id="productoImagenFileAdmin" accept="image/*" multiple style="background: rgba(8,15,6,0.8); border: 1px solid rgba(100,140,75,0.4); border-radius: 12px; padding: 10px; color: #e0ecd0; width: 100%;">
                    <div id="productoPreview" style="margin: 10px 0; text-align: center;"></div>
                </div>
            </div>
            <button type="submit" class="btn-submit">Agregar</button>
        </form>
        <hr>
        ${productos.length ? `
            <div class="admin-tabla-scroll">
            <table class="tabla-datos admin-productos-tabla">
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Precio</th><th>Disp.</th><th></th></tr></thead>
                <tbody>${productos.map((producto) => `
                    <tr>
                        <td>${escapeHtml(producto.nombre)}</td>
                        <td>${escapeHtml(obtenerEtiquetaTipoCultivoAdmin(producto.tipo_cultivo))}</td>
                        <td><input type="number" step="0.01" value="${producto.precio_por_10g || 1600}" class="admin-productos-precio" style="background:rgba(8,15,6,0.8);border:1px solid #7ca35a;border-radius:8px;padding:5px;color:#e0ecd0;" onchange="actualizarPrecioProductoAdmin('${producto.id}', this.value)"></td>
                        <td><input type="checkbox" ${producto.disponible !== false ? 'checked' : ''} onchange="actualizarDisponibilidadProductoAdmin('${producto.id}', this.checked)"></td>
                        <td><div class="admin-productos-acciones"><button class="btn-editar" onclick="editarProductoAdmin('${producto.id}')">Editar</button><button class="btn-eliminar" onclick="eliminarProductoAdminClick('${producto.id}')">Eliminar</button></div></td>
                    </tr>
                `).join('')}</tbody>
            </table>
            </div>
        ` : '<div class="loading">No hay productos todavía.</div>'}
    `;

    configurarInputImagenesConLimite('productoImagenFileAdmin', 'productoPreview', 'productos');

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

        const payloadProducto = {
            nombre: document.getElementById('productoNombreAdmin').value,
            cepa: document.getElementById('productoCepaAdmin').value,
            thc_porcentaje: parseFloat(document.getElementById('productoThcAdmin').value) || null,
            cbd_porcentaje: parseFloat(document.getElementById('productoCbdAdmin').value) || null,
            tipo_cultivo: normalizarTipoCultivoAdmin(document.getElementById('productoTipoCultivoAdmin').value),
            precio_por_10g: parseFloat(document.getElementById('productoPrecioAdmin').value) || 1600,
            descripcion: document.getElementById('productoDescripcionAdmin').value,
            imagen_url: imagenes[0] || null,
            disponible: true
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
            <thead><tr><th>Fecha</th><th>Nombre</th><th>Email</th><th>Telefono</th><th>Acciones</th></tr></thead>
            <tbody>${data.map((solicitud) => `
                <tr>
                    <td>${new Date(solicitud.fecha_solicitud).toLocaleDateString('es')}</td>
                    <td>${escapeHtml(solicitud.nombre)} ${escapeHtml(solicitud.apellido)}</td>
                    <td>${escapeHtml(solicitud.email || '-')}</td>
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

async function cargarReservasAdmin() {
    const container = document.getElementById('admin-reservasAdmin');
    if (!container) return;
    const { data, error } = await supabaseClient.from('reservas_mensuales').select('*, socios(nombre, apellido)').order('fecha_retiro', { ascending: false });
    if (error) {
        container.innerHTML = '<div class="loading">No se pudieron cargar las reservas.</div>';
        return;
    }
    container.innerHTML = (data || []).length ? `
        <div class="admin-tabla-scroll">
        <table class="tabla-datos">
            <thead><tr><th>Fecha</th><th>Socio</th><th>Cantidad</th><th>Estado</th></tr></thead>
            <tbody>${data.map((reserva) => `
                <tr>
                    <td>${new Date(reserva.fecha_retiro).toLocaleDateString('es')}</td>
                    <td>${escapeHtml(reserva.socios?.nombre || '-')} ${escapeHtml(reserva.socios?.apellido || '')}</td>
                    <td>${reserva.cantidad_gramos}g</td>
                    <td>${escapeHtml(reserva.estado)}</td>
                </tr>
            `).join('')}</tbody>
        </table>
        </div>
    ` : '<div class="loading">No hay reservas.</div>';
}

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

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-admin-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-admin-btn').forEach((other) => other.classList.remove('active'));
            btn.classList.add('active');
            const section = btn.dataset.adminSection;
            ['historia', 'noticias', 'productos', 'actividades', 'solicitudes', 'socios', 'reservasAdmin', 'mensajes'].forEach((key) => {
                const el = document.getElementById(`admin-${key}`);
                if (el) el.style.display = key === section ? 'block' : 'none';
            });
            if (section === 'historia' && typeof cargarHistoriaAdmin === 'function') cargarHistoriaAdmin();
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

console.log('Admin loaded');
