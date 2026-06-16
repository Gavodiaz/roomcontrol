// modules/ui.js
import {
    getDocentes,
    getEquipos,
    getPrestamosActivos,
    getDetallesDePrestamo,
    getRegistrosDelDia,
    getReservasDeHoy
} from './api.js';
import { supabaseClient } from './supabase.js';

// 1. PINTAR LOS DOCENTES EN EL SELECT
export async function renderDocentes() {
    const datalist = document.getElementById('lista-docentes');
    if (!datalist) return;

    try {
        const usuarios = await getDocentes(); // Pedimos los profes a la API
        datalist.innerHTML = '';

        usuarios.forEach(user => {
            const option = document.createElement('option');

            // Lo que el usuario escribe/selecciona en la caja (Nombre Completo)
            option.value = user.nombre_completo;

            // 🎯 CLAVE ACÁ: Guardamos el ID real de Supabase en el atributo 'data-id'
            option.dataset.id = user.id;

            // Esto muestra el DNI al lado en la persiana de sugerencias
            option.textContent = user.dni ? `DNI: ${user.dni}` : '';

            datalist.appendChild(option);
        });
    } catch (err) {
        console.error("Error al renderizar docentes en datalist:", err);
    }
}



// 2. PINTAR LOS BOTONES DE EQUIPOS EN EL MODAL (Filtrado preciso por hora_catedra)
export async function renderEquipos(state) {
    const contenedor = document.getElementById('contenedor-equipos');
    if (!contenedor) return;

    try {
        const equipos = await getEquipos();
        contenedor.innerHTML = '';

        let reservasHoy = [];
        try {
            const hoy = new Date().toLocaleDateString('en-CA');
            reservasHoy = await getReservasDeHoy(hoy);
            console.log("📅 Reservas de hoy traídas de Supabase:", reservasHoy);
        } catch (reservaErr) {
            console.warn("Error al traer reservas:", reservaErr);
        }

        // 🔍 Obtenemos las horas tildadas en el formulario principal (ej: [5, 6])
        // 🔍 Obtenemos las horas tildadas desde la ventana principal (siempre buscando la función global)
        const horasTildadas = typeof window.obtenerHorasCatedraSeleccionadas === 'function'
            ? window.obtenerHorasCatedraSeleccionadas()
            : (typeof obtenerHorasCatedraSeleccionadas === 'function' ? obtenerHorasCatedraSeleccionadas() : []);

        state.idsSeleccionados = [];
        state.nombresSeleccionados = [];

        equipos.forEach(eq => {
            const btn = document.createElement('button');
            btn.innerHTML = `💻 ${eq.nombre}`;
            btn.type = "button";

            // 🎯 CRUCE HORARIO CON LA COLUMNA DE SUPABASE (Versión limpia)
            const estaReservadoHoy = reservasHoy.some(reserva => {
                // 1. Validamos que la reserva sea estrictamente de este equipo
                const esMismoEquipo = Number(reserva.equipo_id) === Number(eq.id);
                if (!esMismoEquipo) return false;

                // 2. Si hay horas tildadas en la grilla principal
                if (horasTildadas.length > 0) {
                    const horaBaseDatos = parseInt(reserva.hora_catedra, 10);

                    // Imprime el rastro en la consola para auditar los filtros
                    console.log(`🔎 Evaluando ${eq.nombre}: Interfaz pide:`, horasTildadas, `| Supabase tiene:`, horaBaseDatos);

                    // Si la hora de Supabase está entre las que pide el preceptor, se bloquea (true)
                    return horasTildadas.includes(horaBaseDatos);
                }

                // 3. Si no hay horas seleccionadas (pantalla general de reservas), bloquea todo el día
                return true;
            });

            // Definimos el color del botón (Rojo si coincide el horario, original si está libre)
            const estadoVisual = estaReservadoHoy ? 'prestado' : eq.estado.toLowerCase();
            btn.className = `btn-equipo ${estadoVisual}`;

            if (eq.estado.toLowerCase() === 'disponible' && !estaReservadoHoy) {
                btn.addEventListener('click', () => {
                    if (btn.classList.contains('seleccionado')) {
                        btn.classList.remove('seleccionado');
                        state.idsSeleccionados = state.idsSeleccionados.filter(id => id !== eq.id);
                        state.nombresSeleccionados = state.nombresSeleccionados.filter(n => n !== eq.nombre);
                    } else {
                        btn.classList.add('seleccionado');
                        state.idsSeleccionados.push(eq.id);
                        state.nombresSeleccionados.push(eq.nombre);
                    }
                });
            } else {
                btn.disabled = true; // Queda deshabilitado si coincide la hora de la reserva
            }

            contenedor.appendChild(btn);
        });

    } catch (err) {
        console.error("Error crítico al renderizar equipos:", err);
    }
}



// 3. PINTAR EL PANEL DE PRÉSTAMOS ACTIVOS EN FORMATO TARJETAS (DATOS ARRIBA / NETBOOKS ABAJO)
export async function renderTablaPrestamos() {
    // Apuntamos al nuevo contenedor DIV que pusimos en el HTML
    const contenedor = document.getElementById('contenedor-tarjetas-prestamos');
    if (!contenedor) return;

    // FORZAMOS LA LIMPIEZA TOTAL
    contenedor.innerHTML = '';

    try {
        const listaPrestamos = await getPrestamosActivos();

        if (listaPrestamos.length === 0) {
            contenedor.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 20px; background: #ffffff; border-radius: 8px; border: 1px solid #dee2e6;">
                    No hay equipos prestados en este momento.
                </div>
            `;
            return;
        }

        // Variable temporal para acumular el diseño de todas las tarjetas
        let htmlAcumulado = '';

        for (const prestamo of listaPrestamos) {
            const detalles = await getDetallesDePrestamo(prestamo.id);

            // 🔍 1. AGRUPAMOS LOS DETALLES POR EQUIPO FÍSICO ÚNICO
            const equiposMap = new Map();
            if (detalles && detalles.length > 0) {
                detalles.forEach(d => {
                    if (!equiposMap.has(d.equipo_id)) {
                        equiposMap.set(d.equipo_id, {
                            equipo_id: d.equipo_id,
                            prestamo_id: d.prestamo_id,
                            nombre: d.equipos?.nombre || 'Equipo',
                            registrosHoras: []
                        });
                    }
                    equiposMap.get(d.equipo_id).registrosHoras.push(d);
                });
            }

            // 🌐 MAPEO DE EQUIPOS EN FORMATO GRILLA COMPACTA FLUIDA (Fila de Abajo - Ancho Completo)
            let equiposMostrados = `
                <div style="
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); 
                    gap: 5px; 
                    width: 100%; 
                    background-color: #f8f9fc; 
                    border: 1px solid #eaecf4; 
                    border-radius: 6px; 
                    padding: 10px;
                    max-height: 115px;
                    overflow-y: auto;
                ">
            `;

            if (equiposMap.size > 0) {
                // 👇 Convertimos a array y ordenamos numéricamente por el nombre del equipo antes del .map()
                equiposMostrados += Array.from(equiposMap.values())
                    .sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }))
                    .map(eq => {
                        const estaDevueltoPorCompleto = eq.registrosHoras.every(r => r.fecha_devolucion);
                        
                        if (estaDevueltoPorCompleto) {
                            return `
                                <div style="display: inline-flex; align-items: center; justify-content: space-between; background-color: #e9ecef; border: 1px dashed #ced4da; border-radius: 4px; padding: 3px 6px; font-size: 11px; color: #6c757d; text-decoration: line-through; opacity: 0.6; white-space: nowrap;" title="${eq.nombre} (Devuelto)">
                                    <span>Net ${eq.nombre.replace(/[^0-9]/g, '')}</span>
                                    <span style="font-size: 9px; margin-left: 2px; text-decoration: none;">✔</span>
                                </div>
                            `;
                        } else {
                            return `
                                <div style="display: inline-flex; align-items: center; justify-content: space-between; background-color: #ffffff; border: 1px solid #d1d3e2; border-radius: 4px; padding: 3px 6px; font-size: 11px; font-weight: bold; color: #495057; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                    <span>Net ${eq.nombre.replace(/[^0-9]/g, '')}</span>
                                    <button class="btn-devolver-uno" 
                                            data-prestamo="${eq.prestamo_id}" 
                                            data-equipo="${eq.equipo_id}" 
                                            style="background: none; border: none; color: #dc3545; font-weight: bold; margin-left: 6px; cursor: pointer; font-size: 11px; padding: 0 2px; line-height: 1;"
                                            title="Devolver ${eq.nombre}">
                                        ✕
                                    </button>
                                </div>
                            `;
                        }
                    }).join('');
            } else {
                equiposMostrados += `<span style="color: #6c757d; font-style: italic; font-size: 11px;">Sin equipos asignados</span>`;
            }
            equiposMostrados += `</div>`;

            // --- ⏱️ LÓGICA DE TRADUCCIÓN DE HORARIOS ---
            let rangoHorasTexto = 'Sin hora';
            if (detalles && detalles.length > 0) {
                const horasOrdenadas = Array.from(new Set(detalles.map(d => d.hora_catedra)))
                    .filter(h => h !== undefined && h !== null)
                    .sort((a, b) => a - b);

                if (horasOrdenadas.length > 0) {
                    const primera = horasOrdenadas[0];
                    const ultima = horasOrdenadas[horasOrdenadas.length - 1];

                    const inicio = MAPA_HORARIOS[String(primera)]
                        ? MAPA_HORARIOS[String(primera)].split(' a ')[0]
                        : `Mód. ${primera}`;

                    const fin = MAPA_HORARIOS[String(ultima)]
                        ? MAPA_HORARIOS[String(ultima)].split(' a ')[1]
                        : `Mód. ${ultima}`;

                    rangoHorasTexto = `${inicio} a ${fin}`;
                }
            }

            // Formateo de fecha y estado igual al tuyo
            const fechaDiaMes = prestamo.fecha_salida
                ? new Date(prestamo.fecha_salida).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                : '---';

            const devolucionFormateada = prestamo.fecha_devolucion
                ? new Date(prestamo.fecha_devolucion).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '<span style="display: inline-block; background-color: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">⏳ En uso</span>';

            // 📦 CONSTRUIMOS LA ESTRUCTURA DE LA TARJETA INTERACTIVA
            htmlAcumulado += `
                <div class="tarjeta-prestamo" style="
                    background-color: #ffffff; 
                    border: 1px solid #dee2e6; 
                    border-radius: 8px; 
                    padding: 14px; 
                    margin-bottom: 15px; 
                    box-shadow: 0 2px 5px rgba(0,0,0,0.04);
                ">
                    
                    <div style="
                        display: flex; 
                        align-items: center; 
                        justify-content: space-between; 
                        padding-bottom: 12px;
                        border-bottom: 1px dashed #e9ecef;
                        flex-wrap: wrap;
                        gap: 12px;
                    ">
                        <div style="flex: 1; min-width: 150px;">
                            <span style="font-size: 10px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Docente</span>
                            <strong style="font-size: 14px; color: #212529;">${prestamo.usuarios?.nombre_completo || 'N/A'}</strong>
                        </div>

                        <div style="width: 85px; text-align: center;">
                            <span style="font-size: 10px; color: #6c757d; text-transform: uppercase; display: block;">Curso</span>
                            <span style="font-size: 13px; font-weight: bold; color: #495057;">${prestamo.observaciones || '---'}</span>
                        </div>

                        <div style="flex: 1; min-width: 160px;">
                            <span style="font-size: 10px; color: #6c757d; text-transform: uppercase; display: block;">Entrega / Horas</span>
                            <span style="font-size: 12.5px; color: #495057; font-weight: 500;">
                                📅 ${fechaDiaMes} <span style="margin-left: 4px; color: #4e73df; background: #e8f0fe; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">⏱️ ${rangoHorasTexto} hs</span>
                            </span>
                        </div>

                        <div style="width: 90px; text-align: center;">
                            <span style="font-size: 10px; color: #6c757d; text-transform: uppercase; display: block; margin-bottom: 2px;">Estado</span>
                            ${devolucionFormateada}
                        </div>

                        <div style="display: flex; gap: 8px; justify-content: flex-end; min-width: 170px;">
                            <button class="btn-agregar-parcial" data-id="${prestamo.id}" style="background-color: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11.5px; font-weight: bold; cursor: pointer; width: 90px;">
                                Agregar
                            </button>
                            <button class="btn-devolver" data-id="${prestamo.id}" style="background-color: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11.5px; font-weight: bold; cursor: pointer; width: 90px;">
                                Cerrar Lote
                            </button>
                        </div>
                    </div>

                    <div style="margin-top: 10px;">
                        <div style="font-size: 10.5px; font-weight: bold; color: #4e73df; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; text-transform: uppercase;">
                            💻 Lote de Equipos Asignados <span style="background: #4e73df; color: white; border-radius: 10px; padding: 1px 6px; font-size: 10px;">${equiposMap.size}</span>
                        </div>
                        ${equiposMostrados}
                    </div>

                </div>
            `;
        }

        // Inyectamos todo el bloque de tarjetas junto en el contenedor
        contenedor.innerHTML = htmlAcumulado;

    } catch (err) {
        console.error("Error UI Tabla Préstamos:", err);
        contenedor.innerHTML = '<div style="text-align:center; color:red; padding:20px;">Error de sincronización en el panel.</div>';
    }
}


// 4. PINTAR LA TABLA DEL HISTORIAL DIARIO
export async function renderHistorialDiario() {
    const tablaDiaria = document.getElementById('tabla-registros-diarios');
    if (!tablaDiaria) return;

    tablaDiaria.innerHTML = '<tr><td colspan="5" style="text-align:center;">Buscando movimientos de hoy...</td></tr>';

    try {
        const hoy = new Date();
        const stringInicioHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}T00:00:00`;

        const registrosHoy = await getRegistrosDelDia(stringInicioHoy);
        tablaDiaria.innerHTML = '';

        if (!registrosHoy || registrosHoy.length === 0) {
            tablaDiaria.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#64748b;">No se registraron movimientos en el día de hoy.</td></tr>';
            return;
        }

        registrosHoy.forEach(reg => {
            const fila = document.createElement('tr');
            const horaSalida = new Date(reg.fecha_salida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const horaDevolucion = reg.fecha_devolucion
                ? new Date(reg.fecha_devolucion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                : '—';
            const etiquetaEstado = reg.fecha_devolucion
                ? '<span class="badge-devuelto">Devuelto</span>'
                : '<span class="badge-uso">En Uso</span>';

            // 🎯 CONSTRUCCIÓN DINÁMICA DE LOS CHIPS DE EQUIPOS
            // Cambiá 'detalle_prestamos' si tu relación en la consulta de Supabase usa otro nombre
            const detalles = reg.detalle_prestamos || [];
            let htmlChipsEquipos = '';

            // 🎯 Reemplazá el bloque del d.equipos adentro de renderHistorialDiario():
            if (detalles && detalles.length > 0) {
                htmlChipsEquipos = detalles.map(d => {
                    let nombreDisplay = 'Desconocido';

                    if (d.equipos) {
                        nombreDisplay = d.equipos.nombre || 'Sin nombre';
                    }

                    // ✨ Chips con el estilo amarillito del modal
                    return `<span style="
            display: inline-block;
            background-color: #fffbeb;
            color: #b45309;
            padding: 3px 10px;
            margin: 2px 4px;
            border-radius: 12px;
            font-size: 0.82em;
            border: 1px solid #fde68a;
            font-weight: 500;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        ">${nombreDisplay}</span>`;
                }).join('');
            } else {
                htmlChipsEquipos = `<span style="color:#64748b; font-style:italic;">Sin equipos</span>`;
            }

            // 4. Inyectamos las celdas en la fila de la tabla
            fila.innerHTML = `
    <td><strong>${reg.usuarios?.nombre_completo || 'Desconocido'}</strong></td>
    <td>${htmlChipsEquipos}</td> 
    <td>⏱️ ${horaSalida} hs</td>
    <td>⏱️ ${horaDevolucion} hs</td>
    <td style="text-align:center;">${etiquetaEstado}</td>
`; tablaDiaria.appendChild(fila);
        });
    } catch (err) {
        console.error("Error UI Historial:", err);
        tablaDiaria.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error al consultar el historial diario.</td></tr>';
    }
}


// 5. FUNCIONES AUXILIARES DE PANTALLA (MODAL)
export function abrirModal() {
    document.getElementById('modal-equipos').classList.remove('oculto');
}

export function cerrarModal() {
    document.getElementById('modal-equipos').classList.add('oculto');
}




//Funcion que renderiza la tabla de historial (boton historial)
export function renderHistorialEnModal(prestamos) {
    const cuerpoTabla = document.getElementById('tabla-historial-cuerpo');
    cuerpoTabla.innerHTML = '';

    if (!prestamos || prestamos.length === 0) {
        cuerpoTabla.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #6c757d; font-style: italic; padding: 20px;">No se registraron préstamos en la fecha seleccionada.</td></tr>`;
        return;
    }

    prestamos.forEach(p => {
        const fila = document.createElement('tr');

        // Formateamos la hora de salida
        const horaSalida = new Date(p.fecha_salida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        // Procesamos los equipos como chips compactos (gris oscuro si se devolvió, rojo si quedó pendiente)
        let chipsEquipos = `<div style="display: flex; flex-wrap: wrap; gap: 4px;">`;
        let todasLasDevoluciones = [];

        if (p.detalle_prestamos && p.detalle_prestamos.length > 0) {
            p.detalle_prestamos.forEach(d => {
                const colorBorde = d.fecha_devolucion ? '#ced4da' : '#ffc107';
                const colorTexto = d.fecha_devolucion ? '#6c757d' : '#856404';
                const estiloTachado = d.fecha_devolucion ? 'text-decoration: line-through;' : '';

                if (d.fecha_devolucion) {
                    todasLasDevoluciones.push(new Date(d.fecha_devolucion));
                }

                chipsEquipos += `
                    <div style="display: inline-flex; background-color: #f8f9fa; border: 1px solid ${colorBorde}; border-radius: 12px; padding: 2px 8px; font-size: 11px; color: ${colorTexto}; ${estiloTachado}">
                        ${d.equipos?.nombre || 'Equipo'}
                    </div>
                `;
            });
        }
        chipsEquipos += `</div>`;

        // Calculamos hora general de cierre de lote (agarramos la última devolución como referencia)
        let horaDevolucionTotal = `<span style="color: #dc3545; font-weight: bold;">Incompleto</span>`;
        if (p.detalle_prestamos && p.detalle_prestamos.every(d => d.fecha_devolucion) && p.detalle_prestamos.length > 0) {
            // Si el formato nuevo de lotes tiene todas las devoluciones hechas
            const todasLasDevoluciones = p.detalle_prestamos.map(d => new Date(d.fecha_devolucion));
            const ultimaDevo = new Date(Math.max(...todasLasDevoluciones));
            horaDevolucionTotal = ultimaDevo.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs';
        }
        // 🚀 EL SALVAVIDAS: Si lo anterior dio incompleto pero la tabla principal TIENE fecha_devolucion
        else if (p.fecha_devolucion) {
            const dateDevo = new Date(p.fecha_devolucion);
            horaDevolucionTotal = dateDevo.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs';
        }

        fila.innerHTML = `
            <td>${p.usuarios?.nombre_completo || 'N/A'}</td>
            <td>${chipsEquipos}</td>
            <td>${horaSalida} hs</td>
            <td>${horaDevolucionTotal}</td>
            <td style="color: #6c757d; font-size: 13px;">${p.observaciones || '-'}</td>
        `;

        cuerpoTabla.appendChild(fila);
    });
}


/**
 * PINTAR LA TABLA DE PROFESORES EN EL MODAL ABM
 * @param {Array} usuarios - Lista de docentes traídos de la base de datos
 */
export function renderTablaProfesores(usuarios) {
    const cuerpoTabla = document.getElementById('tabla-profesores-cuerpo');
    cuerpoTabla.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
        cuerpoTabla.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #6c757d; padding: 15px;">No hay profesores registrados.</td></tr>`;
        return;
    }

    usuarios.forEach(user => {
        const fila = document.createElement('tr');
        fila.style.borderBottom = '1px solid #dee2e6';

        // Armamos las celdas con los datos correspondientes (si son NULL ponemos un guion)
        fila.innerHTML = `
            <td style="padding: 8px; font-weight: 500;">${user.nombre_completo}</td>
            <td style="padding: 8px; color: #495057;">${user.dni || '-'}</td>
            <td style="padding: 8px; color: #495057;">${user.celular || '-'}</td>
            <td style="padding: 8px; text-align: center;">
                <button class="btn-editar-profe" 
                        data-id="${user.id}" 
                        data-nombre="${user.nombre_completo}" 
                        data-email="${user.email || ''}" 
                        data-dni="${user.dni || ''}" 
                        data-celular="${user.celular || ''}" 
                        style="background: #ffc107; color: #212529; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-size: 12px;">
                    ✏️
                </button>
                <button class="btn-borrar-profe" 
                        data-id="${user.id}" 
                        data-nombre="${user.nombre_completo}" 
                        style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    🗑️
                </button>
            </td>
        `;

        cuerpoTabla.appendChild(fila);
    });
}


// 🔔 FUNCIÓN MEJORADA: Recibe el mensaje y el tipo ('exito' o 'error')
export function mostrarNotificacion(mensaje, tipo = 'exito') {
    const aviso = document.createElement('div');
    aviso.textContent = mensaje;

    // 🎨 Definimos el color de fondo según el tipo
    const esError = tipo === 'error';
    const colorFondo = esError ? '#ef4444' : '#10b981'; // Rojo si es error, Verde si es éxito

    // Estilos modernos para que flote arriba a la derecha
    Object.assign(aviso.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: colorFondo, // 🎯 Usa el color dinámico según el caso
        color: 'white',
        padding: '12px 24px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontWeight: 'bold',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        zIndex: '9999',
        transition: 'opacity 0.5s ease'
    });

    document.body.appendChild(aviso);

    // A los 2.5 segundos empieza a desaparecer y a los 3 se elimina
    setTimeout(() => {
        aviso.style.opacity = '0';
        setTimeout(() => aviso.remove(), 500);
    }, 2500);
}


// 1. FUNCIÓN PARA PINTAR LAS TARJETAS EN EL LATERAL IZQUIERDO
export function renderRegistrosEnLateral(registros) {
    const contenedorLateral = document.getElementById('tabla-registros-lateral');
    if (!contenedorLateral) return;

    contenedorLateral.innerHTML = '';

    // Si no hay movimientos hoy, mostramos el aviso estético de tarjeta vacía
    if (!registros || registros.length === 0) {
        contenedorLateral.innerHTML = `
            <div style="
                text-align: center; 
                color: #6c757d; 
                font-style: italic; 
                padding: 30px 15px; 
                font-size: 13px;
                background-color: #f8f9fc;
                border: 1px dashed #ced4da;
                border-radius: 8px;
                width: 100%;
            ">
                📅 No hay movimientos registrados hoy.
            </div>
        `;
        return;
    }

    let htmlAcumulado = '';

    registros.forEach(reg => {
        
        const docente = reg.usuarios?.nombre_completo || 'Desconocido';
        const curso = reg.observaciones || '---';
        
        // Formateo de horas nativo
        const horaSalida = reg.fecha_salida ? new Date(reg.fecha_salida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';
        const horaDevolucion = reg.fecha_devolucion
            ? new Date(reg.fecha_devolucion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs'
            : '—';

        const tieneDevolucion = reg.fecha_devolucion !== null;
        const claseEstado = tieneDevolucion ? 'badge-devuelto' : 'badge-uso'; // Usa tus clases de CSS
        const textoEstado = tieneDevolucion ? 'Devuelto' : 'En Uso';

        // Procesamos los equipos del préstamo
        const detalles = reg.detalle_prestamos || [];
        let equiposHTML = '';
        let cantidadEquipos = 0;

        if (detalles && detalles.length > 0) {
            const nombresSucios = detalles
                .map(d => d.equipos?.nombre)
                .filter(nom => nom !== undefined && nom !== null);

            const nombresUnicosOrdenados = Array.from(new Set(nombresSucios))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

            cantidadEquipos = nombresUnicosOrdenados.length;

            // Grilla fluida idéntica al panel derecho
            equiposHTML = `
                <div style="
                    display: grid; 
                    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); 
                    gap: 4px; 
                    width: 100%; 
                    max-height: 100px; 
                    overflow-y: auto; 
                    background-color: #fffdf5; 
                    border: 1px solid #fef3c7; 
                    border-radius: 6px; 
                    padding: 8px;
                ">
            `;

            equiposHTML += nombresUnicosOrdenados.map(nombreEquipo => {
                const numeroLimpio = nombreEquipo.replace(/[^0-9]/g, '');
                const textoMostrar = numeroLimpio ? `Net ${numeroLimpio}` : nombreEquipo;
                return `
                    <div style="
                        display: inline-flex; 
                        align-items: center; 
                        justify-content: center; 
                        background-color: #fffbeb; 
                        color: #b45309; 
                        border: 1px solid #fcd34d; 
                        padding: 2px 4px; 
                        border-radius: 4px; 
                        font-size: 11px; 
                        font-weight: bold;
                        white-space: nowrap;
                    }">
                        <span>${textoMostrar}</span>
                    </div>
                `;
            }).join('');

            equiposHTML += `</div>`;
        } else {
            equiposHTML = `<div style="color: #6c757d; font-style: italic; font-size: 11px; padding: 4px;">Sin equipos asignados</div>`;
        }

        // Diseño de la Tarjeta Informativa Bento
        htmlAcumulado += `
            <div class="tarjeta-movimiento-diario" style="
                background-color: #ffffff; 
                border: 1px solid #dee2e6; 
                border-radius: 8px; 
                padding: 12px; 
                box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                text-align: left;
                width: 100%;
            ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
                    <div style="flex: 1;">
                        <span style="font-size: 9px; color: #6c757d; text-transform: uppercase; letter-spacing: 0.5px; display: block;">Docente</span>
                        <strong style="font-size: 13px; color: #212529; display: block; line-height: 1.2;">${docente}</strong>
                    </div>
                    <div style="text-align: right;">
                        <span class="${claseEstado}" style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px;">${textoEstado}</span>
                    </div>
                </div>

                <div style="display: flex; background: #f8f9fc; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; justify-content: space-between; font-size: 11.5px; color: #495057;">
                    <div><strong>Curso:</strong> ${curso}</div>
                    <div style="display: flex; gap: 8px;">
                        <span>🛫 ${horaSalida} hs</span>
                        <span>🛬 ${horaDevolucion}</span>
                    </div>
                </div>

                <div>
                    <div style="font-size: 10px; font-weight: bold; color: #b45309; margin-bottom: 4px; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
                        💻 Equipos <span style="background: #b45309; color: white; border-radius: 10px; padding: 0px 5px; font-size: 9px;">${cantidadEquipos}</span>
                    </div>
                    ${equiposHTML}
                </div>
            </div>
        `;
    });

    contenedorLateral.innerHTML = htmlAcumulado;
}

// 2. FUNCIÓN AUXILIAR COLECTORA DE DATOS
async function cargarYRenderizarLateral() {
    try {
        const hoy = new Date().toLocaleDateString('sv'); // Mantiene tu formato 'sv' que funciona con Supabase
        const registros = await getRegistrosDelDia(hoy);
        renderRegistrosEnLateral(registros);
    } catch (error) {
        console.error("Error al cargar movimientos laterales:", error);
    }
}

// 3. LISTENERS: Carga automática + Refresco al pasar el mouse
const sidebarIzquierda = document.getElementById('sidebar-registros-diarios');

if (sidebarIzquierda) {
    // 🚀 CARGA AUTOMÁTICA AL LEVANTAR LA PÁGINA (Esto evita que quede vacío de entrada!)
    document.addEventListener('DOMContentLoaded', cargarYRenderizarLateral);
    // Por las dudas si ya se cargó el DOM, tiramos una ejecución directa:
    cargarYRenderizarLateral();

    // Mantiene tu comportamiento original para refrescar cuando pasan el mouse
    sidebarIzquierda.addEventListener('mouseenter', cargarYRenderizarLateral);
}


// Función para pintar la tabla lateral izquierda con reservas diarias

/**
 * Inserta múltiples filas en la tabla reservas (Inserción masiva de netbooks)
 * @param {Array} filas - Array de objetos [{docente_id, equipo_id, fecha_reserva, estado}, ...]
 */
export function renderReservasEnLateral(reservas) {
    const tbody = document.getElementById('tabla-reservas-lateral');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!reservas || reservas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No hay reservas registradas para hoy.</td></tr>`;
        return;
    }

    // 1. AGRUPACIÓN: Recolectamos nombres, horas, IDs de reservas e IDs de equipos
    const agrupado = reservas.reduce((acc, res) => {
        const nombreDocente = res.usuarios?.nombre_completo || 'Sin nombre';

        if (!acc[nombreDocente]) {
            acc[nombreDocente] = {
                nombre: nombreDocente,
                usuario_id: res.usuario_id || null,
                equipos: new Set(),
                horas: new Set(),
                reservaIds: [],
                equiposIds: [],
                curso: res.curso || '1° 1°',
                estado: res.estado || 'Confirmada'
            };
        }

        acc[nombreDocente].equipos.add(res.equipos?.nombre);
        acc[nombreDocente].horas.add(res.hora_catedra);

        if (res.id && !acc[nombreDocente].reservaIds.includes(res.id)) {
            acc[nombreDocente].reservaIds.push(res.id);
        }
        if (res.equipo_id && !acc[nombreDocente].equiposIds.includes(res.equipo_id)) {
            acc[nombreDocente].equiposIds.push(res.equipo_id);
        }

        if (res.estado) {
            acc[nombreDocente].estado = res.estado;
        }

        return acc;
    }, {});

    // 2. PINTADO DE FILAS
    Object.values(agrupado).forEach(res => {
        const fila = document.createElement('tr');

        const equiposUnicos = Array.from(res.equipos);
        const equiposHTML = equiposUnicos.map(nombre =>
            `<span class="badge-equipo-item"> ${nombre} </span>`
        ).join(' ');

        // --- ⏱️ NUEVA LÓGICA DE TRADUCCIÓN DE HORARIOS ---
        const horasOrdenadas = Array.from(res.horas).sort((a, b) => a - b);
        let rangoFinal = '';

        if (horasOrdenadas.length > 0) {
            const primera = horasOrdenadas[0];
            const ultima = horasOrdenadas[horasOrdenadas.length - 1];

            // Extrae la hora de entrada de la primera materia (ej: "18:30")
            const inicio = MAPA_HORARIOS[String(primera)]
                ? MAPA_HORARIOS[String(primera)].split(' a ')[0]
                : `Bloque ${primera}`;

            // Extrae la hora de salida de la última materia (ej: "19:50")
            const fin = MAPA_HORARIOS[String(ultima)]
                ? MAPA_HORARIOS[String(ultima)].split(' a ')[1]
                : `Bloque ${ultima}`;

            rangoFinal = `${inicio} a ${fin}`;
        } else {
            rangoFinal = 'Sin hora';
        }

        // --- COLUMNA DE ESTADO / ACCIÓN DINÁMICA ---
        let columnaAccionHTML = '';
        if (res.estado.toLowerCase() === 'confirmada') {
            columnaAccionHTML = `
                <td>
                    <button class="btn-entregar-lote" data-docente="${res.nombre}" style="padding: 5px 10px; background-color: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        🚀 Entregar
                    </button>
                </td>`;
        } else {
            columnaAccionHTML = `<td><span class="badge-en-uso" style="background-color: #2563eb; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${res.estado}</span></td>`;
        }

        // Armamos la estructura de la fila con el rango de reloj
        fila.innerHTML = `
            <td><strong>${res.nombre}</strong></td>
            <td><div style="display: flex; flex-wrap: wrap; gap: 4px;">${equiposHTML}</div></td>
            <td>⏱️ ${rangoFinal} hs</td>
            ${columnaAccionHTML}
        `;

        // 3. EVENTO CLIC DEL BOTÓN ENTREGAR
        const btnEntregar = fila.querySelector('.btn-entregar-lote');
        if (btnEntregar) {
            btnEntregar.addEventListener('click', async () => {
                if (confirm(`¿Confirmás la entrega de equipos para el ${res.nombre}?`)) {
                    await ejecutarTraspasoReservaAUso(res);
                }
            });
        }

        tbody.appendChild(fila);
    });
}


// 🌐 FUNCIÓN DE TRASPASO DEFINITIVA (COLUMNA EN SINGULAR)
async function ejecutarTraspasoReservaAUso(datosAgrupados) {
    console.log("📊 [DIAGNÓSTICO] Iniciando traspaso para:", datosAgrupados.nombre);
    console.log("📦 Datos agrupados recibidos en la UI:", datosAgrupados);

    try {
        // 1️⃣ RESCATE DEL ID DEL DOCENTE
        let idUsuario = datosAgrupados.usuario_id || null;

        if (!idUsuario) {
            console.log("⚠️ El usuario_id vino vacío. Buscando coincidencia por nombre...");
            const { data: usuarios } = await supabaseClient
                .from('usuarios')
                .select('id, nombre_completo');

            if (usuarios) {
                const deDocente = datosAgrupados.nombre.toLowerCase().trim();
                const encontrado = usuarios.find(u =>
                    u.nombre_completo.toLowerCase().trim().includes(deDocente) ||
                    deDocente.includes(u.nombre_completo.toLowerCase().trim())
                );
                if (encontrado) {
                    idUsuario = encontrado.id;
                    console.log("✅ ID de usuario localizado:", idUsuario);
                }
            }
        }

        // 2️⃣ RESCATE INFALIBLE DE LOS IDs DE NETBOOKS
        let listaEquiposIds = [];
        if (datosAgrupados.equiposIds && datosAgrupados.equiposIds.length > 0) {
            listaEquiposIds = datosAgrupados.equiposIds;
        }
        else if (datosAgrupados.equipos && datosAgrupados.equipos.size > 0) {
            console.log("🔍 'equiposIds' estaba vacío. Buscando en BD para el Set:", Array.from(datosAgrupados.equipos));
            const { data: tablaEquipos } = await supabaseClient.from('equipos').select('id, nombre');

            if (tablaEquipos) {
                const nombresSet = Array.from(datosAgrupados.equipos);
                listaEquiposIds = nombresSet.map(nom => {
                    if (!nom) return null;
                    const eq = tablaEquipos.find(e => e.nombre.toLowerCase().trim() === nom.toLowerCase().trim());
                    return eq ? eq.id : null;
                }).filter(id => id !== null);
            }
        }

        console.log("🎯 IDs finales de netbooks listos para impactar:", listaEquiposIds);

        // 🛑 VALIDACIÓN DE SEGURIDAD
        if (listaEquiposIds.length === 0) {
            alert("No se pudieron determinar los IDs de las netbooks. Proceso detenido.");
            return;
        }

        // =========================================================================
        // 🔥 ACTUALIZACIÓN DIRECTA DE LAS NETBOOKS A 'PRESTADO'
        // =========================================================================
        console.log("⚡ [PROCESO] Actualizando estado de los equipos en Supabase...", listaEquiposIds);
        const { error: errorCambioEstado } = await supabaseClient
            .from('equipos')
            .update({ estado: 'Prestado' })
            .in('id', listaEquiposIds);

        if (errorCambioEstado) {
            console.error("❌ Error al actualizar estado físico de equipos:", errorCambioEstado);
            // No tiramos throw para que no congele el registro del préstamo si falla
        } else {
            console.log("✅ Equipos bloqueados como 'Prestado' correctamente.");
        }
        // =========================================================================

        // 2️⃣.5️⃣ RESCATE DE LAS HORAS VINCULADAS A LA RESERVA
        let listaHorasIds = [];
        if (datosAgrupados.horasIds && datosAgrupados.horasIds.length > 0) {
            listaHorasIds = datosAgrupados.horasIds;
        } else if (datosAgrupados.horas) {
            listaHorasIds = Array.from(datosAgrupados.horas);
        } else if (datosAgrupados.hora_catedra) {
            listaHorasIds = [datosAgrupados.hora_catedra];
        }

        console.log("⏰ Horas detectadas para las filas de detalle:", listaHorasIds);

        // 3️⃣ INSERCIÓN MAESTRA EN LA TABLA 'PRESTAMOS'
        const { data: prestamoCreado, error: errorPrestamo } = await supabaseClient
            .from('prestamos')
            .insert([{
                usuario_id: idUsuario,
                fecha_salida: new Date().toISOString(),
                observaciones: datosAgrupados.curso || '1° 1°'
            }])
            .select();

        if (errorPrestamo) throw errorPrestamo;

        const idDelPrestamoMaestro = prestamoCreado[0].id;
        console.log("✅ Registro maestro asentado en 'prestamos'. ID:", idDelPrestamoMaestro);

        // 4️⃣ INSERCIÓN EN 'DETALLE_PRESTAMOS' (¡Ahora sí con hora_catedra!)
        const filasDetalle = [];

        listaEquiposIds.forEach(idEquipo => {
            if (listaHorasIds.length > 0) {
                listaHorasIds.forEach(idHora => {
                    filasDetalle.push({
                        prestamo_id: idDelPrestamoMaestro,
                        equipo_id: idEquipo,
                        hora_catedra: idHora // 💡 CAMBIADO A SINGULAR: nombre exacto de la columna
                    });
                });
            } else {
                filasDetalle.push({
                    prestamo_id: idDelPrestamoMaestro,
                    equipo_id: idEquipo,
                    hora_catedra: null
                });
            }
        });

        console.log("🚀 Enviando filas estructuradas a 'detalle_prestamos':", filasDetalle);

        const { error: errorDetalle } = await supabaseClient
            .from('detalle_prestamos')
            .insert(filasDetalle);

        if (errorDetalle) throw errorDetalle;
        console.log("✅ Relaciones guardadas con éxito en 'detalle_prestamos'.");

       // 5️⃣ MUTACIÓN DE ESTADO: ELIMINAR REGISTROS DE LA TABLA 'RESERVAS'
        if (datosAgrupados.reservaIds && datosAgrupados.reservaIds.length > 0) {
            console.log("🔄 Eliminando reservas vinculadas en Supabase ya entregadas...", datosAgrupados.reservaIds);
            
            try {
                // 🔥 Reutilizamos tu función infalible pasándole el array de IDs
                if (typeof eliminarReservasMasivas === 'function') {
                    await eliminarReservasMasivas(datosAgrupados.reservaIds);
                    console.log("✅ Reservas eliminadas con éxito de la base de datos a través de eliminarReservasMasivas.");
                } else {
                    // Por si la función vive en otro archivo y necesitas llamarla por cliente directo:
                    const { error: errorReservas } = await supabaseClient
                        .from('reservas')
                        .delete()
                        .in('id', datosAgrupados.reservaIds);

                    if (errorReservas) throw errorReservas;
                    console.log("✅ Reservas eliminadas con éxito vía cliente directo.");
                }
            } catch (errBorrado) {
                console.error("⚠️ Error no crítico al borrar reservas:", errBorrado);
                // No cortamos el flujo con un throw para que la UI se refresque igual
            }
        }
       

        // 6️⃣ REFRESCO DE INTERFAZ EN TIEMPO REAL
        alert(`¡Préstamo para ${datosAgrupados.nombre} procesado con éxito absoluto!`);
        window.location.reload();

    } catch (error) {
        console.error("❌ Error crítico en el flujo de traspaso:", error);
        alert(`Error de Supabase: ${error.message || error.details || JSON.stringify(error)}`);
    }
}



// constantes.js o al inicio de ui.js
const MAPA_HORARIOS = {
    1: "8:00 a 8:40",
    2: "8:40 a 9:20",
    3: "9:30 a 10:10",
    4: "10:10 a 10:50",
    5: "10:50 a 11:30",
    6: "11:40 a 12:20",
    7: "12:20 a 13:00",
    8: "13:30 a 14:10",
    9: "14:10 a 14:50",
    10: "14:50 a 15:30",
    11: "15:40 a 16:20",
    12: "16:20 a 17:00",
    13: "17:10 a 17:50",
    14: "17:50 a 18:30"

};


// Función para calcular el rango de horas de un préstamo en base a sus detalles individuales
function obtenerRangoDesdeDetalles(detalles) {
    if (!detalles || detalles.length === 0) return 'Sin hora';

    // 1. Recolectamos todas las horas únicas de este conjunto de detalles
    const horasSet = new Set();
    detalles.forEach(d => {
        // Buscamos tanto 'hora' como 'hora_catedra' por si las moscas según tu esquema
        if (d.hora !== undefined) horasSet.add(d.hora);
        else if (d.hora_catedra !== undefined) horasSet.add(d.hora_catedra);
    });

    const horasOrdenadas = Array.from(horasSet).sort((a, b) => a - b);

    if (horasOrdenadas.length === 0) return 'Sin hora';

    // 2. Obtenemos extremos
    const primera = horasOrdenadas[0];
    const ultima = horasOrdenadas[horasOrdenadas.length - 1];

    // 3. Tu misma lógica exacta de división con split (' a ')
    const inicio = MAPA_HORARIOS[String(primera)]
        ? MAPA_HORARIOS[String(primera)].split(' a ')[0]
        : `Bloque ${primera}`;

    const fin = MAPA_HORARIOS[String(ultima)]
        ? MAPA_HORARIOS[String(ultima)].split(' a ')[1]
        : `Bloque ${ultima}`;

    return `${inicio} a ${fin}`;
}