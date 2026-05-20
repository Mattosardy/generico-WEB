const seccionesMaestroImplementadas = ['historia', 'socios', 'reservas', 'config'];

async function subirArchivoPublico(bucket, file, prefijo) {
    if (!file) return '';
    const esImagen = String(file.type || '').toLowerCase().startsWith('image/')
        || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || '');
    const archivoSubida = esImagen && typeof sanitizeImageBeforeUpload === 'function'
        ? await sanitizeImageBeforeUpload(file)
        : file;
    const ext = (archivoSubida.name.split('.').pop() || 'bin').toLowerCase();
    const fileName = `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabaseClient.storage.from(bucket).upload(fileName, archivoSubida, {
        contentType: archivoSubida.type || undefined
    });
    if (error) {
        const mensaje = String(error.message || '').toLowerCase();
        const bucketFaltante = error.statusCode === '400' || error.statusCode === 400 || mensaje.includes('bucket') || mensaje.includes('not found');
        if (bucketFaltante) {
            throw new Error(`No existe o no está listo el bucket "${bucket}" en Supabase Storage.`);
        }
        throw error;
    }
    return supabaseClient.storage.from(bucket).getPublicUrl(fileName).data.publicUrl;
}

function obtenerConfigHistoriaPredeterminada() {
    return {
        texto: `Cururú Club Cannábico

Flores de alta calidad y una experiencia cuidada para quienes buscan elegir y consumir de forma consciente.

Ofrecemos más de 6 variedades durante todo el año, cultivadas con estrategias biominerales en STANDARD y PREMIUM con luz asistida, logrando consistencia en cada cosecha.

¿Qué ofrecemos?
- Calidad superior con variedades a elección
- Mismo estándar todo el año
- Precios según tipo de cultivo (STANDARD o PREMIUM)

Condiciones:
- Mínimo: 20 g por variedad / mes
- Máximo: 40 g por variedad / mes (combinables entre variedades)

Si te interesa, coordinamos una reunión y te contamos cómo trabajamos.

Cururú Club Cannábico - calidad y transparencia.`,
        socios: '38',
        cepas: '120',
        anios: '8',
        videoUrl: '',
        imagenes: []
    };
}

async function obtenerConfigHistoriaActual() {
    const configMap = await cargarContenidoInstitucional();
    const predeterminada = obtenerConfigHistoriaPredeterminada();
    return {
        texto: configMap.historia_texto || predeterminada.texto,
        socios: configMap.cifra_socios || predeterminada.socios,
        cepas: configMap.cifra_cepas || predeterminada.cepas,
        anios: configMap.cifra_anios || predeterminada.anios,
        videoUrl: configMap.historia_video_url || predeterminada.videoUrl,
        imagenes: normalizarListaImagenes(configMap.historia_galeria || '[]')
    };
}

function renderizarEditorHistoria(container, opciones = {}) {
    if (!container) return;
    const {
        titulo = 'Editar historia',
        prefijo = 'historia',
        botonGuardar = 'guardarHistoriaMaestro',
        configHistoria = obtenerConfigHistoriaPredeterminada()
    } = opciones;

    container.innerHTML = `
        <h3 style="color:var(--accent-strong);">${escapeHtml(titulo)}</h3>
        <p style="color:var(--text-muted); margin: 8px 0 18px; line-height: 1.5;">Edita el texto visible en la portada, las cifras destacadas y los recursos multimedia. Guarda solo cuando el contenido principal y el bloque de "Mostrar mas" queden en el orden final.</p>
        <div class="form-grid">
            <div class="form-group full-width">
                <label>Texto principal</label>
                <textarea id="${prefijo}Texto" rows="6" style="background:rgba(8,15,6,0.8);border-radius:12px;padding:12px;color:#e0ecd0;">${escapeHtml(configHistoria.texto)}</textarea>
            </div>
            <div class="form-group">
                <label>Socios activos</label>
                <input type="number" id="${prefijo}Socios" value="${escapeHtml(configHistoria.socios)}">
            </div>
            <div class="form-group">
                <label>Cepas cultivadas</label>
                <input type="number" id="${prefijo}Cepas" value="${escapeHtml(configHistoria.cepas)}">
            </div>
            <div class="form-group">
                <label>Años de experiencia</label>
                <input type="number" id="${prefijo}Anios" value="${escapeHtml(configHistoria.anios)}">
            </div>
            <div class="form-group full-width">
                <label>Video por URL</label>
                <input type="url" id="${prefijo}VideoUrl" value="${escapeHtml(configHistoria.videoUrl)}" placeholder="https://.../video.mp4">
            </div>
            <div class="form-group full-width">
                <label>Subir video</label>
                <input type="file" id="${prefijo}VideoFile" accept="video/*" style="background:rgba(8,15,6,0.8);border-radius:12px;padding:12px;color:#e0ecd0;">
                <small style="color:#5f7f45; display:block; margin-top:8px;">Si cargás imágenes, la web muestra primero las fotos. Si no hay imágenes, usa este video.</small>
            </div>
            <div class="form-group full-width">
                <label>Imágenes de historia por URL (una por línea)</label>
                <textarea id="${prefijo}ImagenesUrls" rows="4" style="background:rgba(8,15,6,0.8);border-radius:12px;padding:12px;color:#e0ecd0;">${escapeHtml(configHistoria.imagenes.join('\n'))}</textarea>
            </div>
            <div class="form-group full-width">
                <label>Subir varias imágenes</label>
                <input type="file" id="${prefijo}ImagenesFiles" accept="image/*" multiple style="background:rgba(8,15,6,0.8);border-radius:12px;padding:12px;color:#e0ecd0;">
                <small class="privacy-upload-note"><i class="fas fa-shield-alt" aria-hidden="true"></i> Las imagenes son limpiadas automaticamente para proteger privacidad y ubicacion.</small>
                <div id="${prefijo}ImagenesPreview" style="margin-top: 12px;"></div>
            </div>
            <div class="form-group full-width">
                <button class="btn-submit" onclick="${botonGuardar}()">Guardar cambios</button>
            </div>
        </div>
        <div id="${prefijo}Mensaje" style="margin-top: 15px;"></div>
    `;

    if (typeof configurarInputImagenesConLimite === 'function') {
        configurarInputImagenesConLimite(`${prefijo}ImagenesFiles`, `${prefijo}ImagenesPreview`, 'historia');
    }
}

async function guardarHistoriaDesdeEditor(prefijo = 'historia') {
    const texto = document.getElementById(`${prefijo}Texto`)?.value?.trim();
    const socios = document.getElementById(`${prefijo}Socios`)?.value?.trim();
    const cepas = document.getElementById(`${prefijo}Cepas`)?.value?.trim();
    const anios = document.getElementById(`${prefijo}Anios`)?.value?.trim();
    const videoUrlManual = document.getElementById(`${prefijo}VideoUrl`)?.value?.trim() || '';
    const urlsManual = (document.getElementById(`${prefijo}ImagenesUrls`)?.value || '')
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    const archivos = typeof obtenerArchivosAcumulados === 'function'
        ? obtenerArchivosAcumulados(`${prefijo}ImagenesFiles`)
        : document.getElementById(`${prefijo}ImagenesFiles`)?.files;
    const videoFile = document.getElementById(`${prefijo}VideoFile`)?.files?.[0];
    const mensajeDiv = document.getElementById(`${prefijo}Mensaje`);

    if (!texto) {
        if (mensajeDiv) mensajeDiv.innerHTML = '<p style="color:#e0b8a0;">El texto principal no puede estar vacío.</p>';
        return false;
    }

    const configActual = await obtenerConfigHistoriaActual();
    validarMaximoImagenes(urlsManual, archivos, 'historia');

    let imagenesHistoria = [...urlsManual];
    if (archivos?.length) {
        const subidas = await subirMultiplesImagenes('noticias', archivos, 'historia');
        imagenesHistoria = [...imagenesHistoria, ...subidas];
    }

    let videoHistoria = videoUrlManual;
    if (videoFile) {
        videoHistoria = await subirArchivoPublico('noticias', videoFile, 'historia_video');
    }

    const imagenesEliminadas = (configActual.imagenes || []).filter((url) => !imagenesHistoria.includes(url));
    if (imagenesEliminadas.length && typeof eliminarArchivosStoragePorUrls === 'function') {
        await eliminarArchivosStoragePorUrls(imagenesEliminadas);
    }

    if (
        configActual.videoUrl &&
        configActual.videoUrl !== videoHistoria &&
        typeof eliminarArchivoStoragePorUrl === 'function'
    ) {
        await eliminarArchivoStoragePorUrl(configActual.videoUrl);
    }

    const updates = [
        { clave: 'historia_texto', valor: texto },
        { clave: 'cifra_socios', valor: socios || '0' },
        { clave: 'cifra_cepas', valor: cepas || '0' },
        { clave: 'cifra_anios', valor: anios || '0' },
        { clave: 'historia_video_url', valor: videoHistoria || '' },
        { clave: 'historia_galeria', valor: JSON.stringify(imagenesHistoria) }
    ];
    for (const item of updates) {
        const { error } = await supabaseClient.from('configuracion_sistema').upsert(item, { onConflict: 'clave' });
        if (error) throw error;
    }

    aplicarContenidoInstitucional({
        historia_texto: texto,
        cifra_socios: socios || '0',
        cifra_cepas: cepas || '0',
        cifra_anios: anios || '0',
        historia_video_url: videoHistoria || '',
        historia_galeria: JSON.stringify(imagenesHistoria)
    });
    if (mensajeDiv) mensajeDiv.innerHTML = '<p style="color:#000000;">Historia actualizada correctamente.</p>';
    return true;
}

async function cargarMaestroDataCompleta() {
    const cards = document.getElementById('maestroCards');
    if (!cards) return;
    const [socios, admins] = await Promise.all([
        supabaseClient.from('socios').select('*', { count: 'exact', head: true }),
        supabaseClient.from('socios').select('*', { count: 'exact', head: true }).in('rol', ['admin', 'maestro'])
    ]);
    cards.innerHTML = `
        <div class="card"><div class="card-number">${socios.count || 0}</div><div class="card-label">Socios</div></div>
        <div class="card"><div class="card-number">${admins.count || 0}</div><div class="card-label">Admins</div></div>
    `;
    await cargarMaestroHistoria();
    await cargarMaestroSocios();
    await cargarMaestroConfig();
}

async function cargarMaestroHistoria() {
    const container = document.getElementById('maestro-historia');
    if (!container) return;
    const configHistoria = await obtenerConfigHistoriaActual();
    renderizarEditorHistoria(container, {
        titulo: 'Editar historia',
        prefijo: 'maestroHistoria',
        botonGuardar: 'guardarHistoriaMaestro',
        configHistoria
    });
}

window.guardarHistoriaMaestro = async function() {
    try {
        await guardarHistoriaDesdeEditor('maestroHistoria');
        mostrarMensaje('Historia guardada', true);
    } catch (error) {
        mostrarMensaje('No se pudo guardar la historia', false);
    }
};

async function cargarMaestroSocios() {
    const container = document.getElementById('maestro-socios');
    if (!container) return;
    const { data, error } = await supabaseClient.from('socios').select('*').order('fecha_ingreso', { ascending: false });
    if (error) {
        container.innerHTML = '<p>No se pudieron cargar los socios.</p>';
        return;
    }
    container.innerHTML = `
        <h3>Socios</h3>
        <p style="color:var(--text-muted); margin: 8px 0 14px;">El maestro comparte la misma edicion completa de usuarios que Admin.</p>
        <div class="admin-tabla-scroll">
        <table class="tabla-datos">
            <thead><tr><th>Nombre</th><th>Apellido</th><th>Cedula</th><th>Nro.</th><th>Telefono</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
            <tbody>${(data || []).map((socio) => `
                <tr>
                    <td><input type="text" class="socio-edit-input" id="socioNombre_maestro_${socio.id}" value="${escapeHtml(socio.nombre || '')}" placeholder="Nombre"></td>
                    <td><input type="text" class="socio-edit-input" id="socioApellido_maestro_${socio.id}" value="${escapeHtml(socio.apellido || '')}" placeholder="Apellido"></td>
                    <td><input type="text" class="socio-edit-input small" id="socioCedula_maestro_${socio.id}" value="${escapeHtml(socio.cedula || '')}" placeholder="Cedula"></td>
                    <td><input type="number" class="socio-edit-input tiny" id="socioNumero_maestro_${socio.id}" value="${escapeHtml(socio.numero_socio || '')}" placeholder="Nro."></td>
                    <td>
                        <div class="telefono-edit-row">
                            <input type="tel" class="telefono-socio-input" id="socioTelefono_maestro_${socio.id}" value="${escapeHtml(socio.telefono || '')}" placeholder="09XXXXXXX">
                        </div>
                    </td>
                    <td>
                        <select class="socio-edit-input tiny" id="socioRol_maestro_${socio.id}">
                            <option value="socio" ${(socio.rol || 'socio') === 'socio' ? 'selected' : ''}>Socio</option>
                            <option value="admin" ${socio.rol === 'admin' ? 'selected' : ''}>Admin</option>
                            <option value="maestro" ${socio.rol === 'maestro' ? 'selected' : ''}>Maestro</option>
                        </select>
                    </td>
                    <td>
                        <select class="socio-edit-input small" id="socioEstado_maestro_${socio.id}">
                            <option value="activo" ${(socio.estado || 'activo') === 'activo' ? 'selected' : ''}>Activo</option>
                            <option value="pendiente" ${socio.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="inactivo" ${socio.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                            <option value="rechazado" ${socio.estado === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                        </select>
                    </td>
                    <td><button type="button" class="btn-editar" onclick="guardarSocioAdmin('${socio.id}', 'maestro')">Guardar</button></td>
                </tr>
            `).join('')}</tbody>
        </table>
        </div>
    `;
}

async function cargarMaestroConfig() {
    const container = document.getElementById('maestro-config');
    if (!container) return;
    await cargarContenidoInstitucional();
    const fechasEntrega = calcularFechasEntrega();
    const fechaPrimer = configSistema.fechaEntregaPrimer || formatearFechaClave(fechasEntrega.primerJueves);
    const fechaUltimo = configSistema.fechaEntregaUltimo || formatearFechaClave(fechasEntrega.ultimoJueves);
    container.innerHTML = `
        <h3>Configuracion</h3>
        <div class="form-grid">
            <div class="form-group">
                <label>Fecha primera entrega</label>
                <input type="date" id="confFechaPrimer" value="${escapeHtml(fechaPrimer)}">
            </div>
            <div class="form-group">
                <label>Fecha ultima entrega</label>
                <input type="date" id="confFechaUltimo" value="${escapeHtml(fechaUltimo)}">
            </div>
            <div class="form-group full-width">
                <label>Limite de reserva</label>
                <input type="text" value="48 horas antes de la fecha de entrega" readonly>
            </div>
            <div class="form-group full-width">
                <button class="btn-submit" onclick="guardarConfigMaestro()">Guardar</button>
            </div>
        </div>
    `;
}

async function cargarMaestroReservas() {
    const container = document.getElementById('maestro-reservas');
    if (!container) return;
    const { data, error } = await supabaseClient
        .from('reservas_mensuales')
        .select('*, socios(nombre, apellido)')
        .order('fecha_retiro', { ascending: false });
    if (error) {
        container.innerHTML = '<p>No se pudieron cargar las reservas.</p>';
        return;
    }
    container.innerHTML = `
        <h3>Pedidos</h3>
        <p style="color:var(--text-muted); margin: 8px 0 14px;">Control general de pedidos mensuales para confirmar recepcion y cerrar entregas.</p>
        ${typeof renderizarTablaReservasAdmin === 'function' ? renderizarTablaReservasAdmin(data, 'maestro') : '<div class="loading">No se pudo renderizar la tabla.</div>'}
    `;
}

window.cargarMaestroReservas = cargarMaestroReservas;

window.guardarConfigMaestro = async function() {
    const fechaPrimer = document.getElementById('confFechaPrimer')?.value || '';
    const fechaUltimo = document.getElementById('confFechaUltimo')?.value || '';
    const primerDate = parsearFechaConfigEntrega(fechaPrimer);
    const ultimoDate = parsearFechaConfigEntrega(fechaUltimo);

    if (!primerDate || !ultimoDate) {
        mostrarMensaje('Elegí fechas válidas para las entregas.', false);
        return;
    }

    const diferenciaDias = Math.round((ultimoDate.getTime() - primerDate.getTime()) / (24 * 60 * 60 * 1000));
    if (diferenciaDias < 7) {
        mostrarMensaje('La ultima entrega debe quedar al menos una semana despues de la primera.', false);
        return;
    }

    const updates = [
        { clave: 'fecha_entrega_primer', valor: fechaPrimer },
        { clave: 'fecha_entrega_ultimo', valor: fechaUltimo },
        { clave: 'horas_limite_primer', valor: '48' },
        { clave: 'horas_limite_ultimo', valor: '48' }
    ];
    for (const item of updates) {
        const { error } = await supabaseClient.from('configuracion_sistema').upsert(item, { onConflict: 'clave' });
        if (error) {
            mostrarMensaje(`No se pudo guardar la configuración: ${error.message}`, false);
            return;
        }
    }
    configSistema.fechaEntregaPrimer = fechaPrimer;
    configSistema.fechaEntregaUltimo = fechaUltimo;
    configSistema.horasLimitePrimer = 48;
    configSistema.horasLimiteUltimo = 48;
    if (typeof cargarReservasSocio === 'function') await cargarReservasSocio();
    mostrarMensaje('Configuración guardada', true);
};

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-maestro-btn').forEach((btn) => {
        const section = btn.dataset.maestroSection;
        if (!seccionesMaestroImplementadas.includes(section)) {
            btn.style.display = 'none';
            return;
        }
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-maestro-btn').forEach((other) => other.classList.remove('active'));
            btn.classList.add('active');
            seccionesMaestroImplementadas.forEach((key) => {
                const el = document.getElementById(`maestro-${key}`);
                if (el) el.style.display = key === section ? 'block' : 'none';
            });
            if (section === 'historia') cargarMaestroHistoria();
            if (section === 'socios') cargarMaestroSocios();
            if (section === 'reservas') cargarMaestroReservas();
            if (section === 'config') cargarMaestroConfig();
        });
    });
});
