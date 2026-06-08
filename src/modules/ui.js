// modules/ui.js
import { getDocentes, 
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

// 2. PINTAR LOS BOTONES DE EQUIPOS EN EL MODAL
// 📄 Funcion actualizada que bloquea los equipos reservados
// 📄 src/modules/ui.js
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

        state.idsSeleccionados = [];
        state.nombresSeleccionados = [];

        equipos.forEach(eq => {
            const btn = document.createElement('button');
            btn.textContent = eq.nombre;
            btn.type = "button";

            // 🌟 PASO EN MODO FÁCIL: Ignoramos la hora. 
            // Si el equipo aparece en alguna reserva de hoy, se tiene que bloquear.
            const estaReservadoHoy = reservasHoy.some(reserva => {
                // Prueba 1: Por ID directo (si es que la tabla guarda un ID numérico por fila)
                const coincidenciaPorId = reserva.equipo_id === eq.id;
                
                // Prueba 2: Por texto (por si guardó el renglón con muchos nombres juntos, ej: "Netbook 04")
                const coincidenciaPorTexto = JSON.stringify(reserva).toLowerCase().includes(eq.nombre.toLowerCase());

                return coincidenciaPorId || coincidenciaPorTexto;
            });

            // Si está reservado hoy, le clavamos la clase 'prestado' (rojo)
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
                btn.disabled = true; // Deshabilitado si ya está reservado
            }
            
            contenedor.appendChild(btn);
        });
    } catch (err) {
        console.error("Error crítico al renderizar equipos:", err);
    }
}



// 3. PINTAR LA TABLA PRINCIPAL DE PRÉSTAMOS ACTIVOS
export async function renderTablaPrestamos() {
    const tabla = document.getElementById('tabla-prestamos');
    if (!tabla) return;

    // FORZAMOS LA LIMPIEZA TOTAL: Esto asegura que no quede nada de la ejecución anterior
    tabla.innerHTML = '';

    try {
        const listaPrestamos = await getPrestamosActivos();

        // 2. Limpiamos la tabla ANTES de empezar a iterar
        tabla.innerHTML = '';

        if (listaPrestamos.length === 0) {
            tabla.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay equipos prestados en este momento.</td></tr>`;
            return;
        }

        // Armamos las filas de la tabla mezclando la cabecera y el lote de equipos
        console.log("Limpiando tabla. ¿Cuántos hijos tiene ahora?:", tabla.children.length);
        for (const prestamo of listaPrestamos) {
            const detalles = await getDetallesDePrestamo(prestamo.id);
            console.log(`Préstamo ID ${prestamo.id} - Detalles que llegan a la UI:`, detalles);
            // Mapeamos TODOS los detalles, decidiendo qué mostrar para cada uno
            // Mapeamos los detalles dándole formato de Chips/Etiquetas horizontales con Flexbox
            let equiposMostrados = `<div style="display: flex; flex-wrap: wrap; gap: 6px; max-width: 450px; justify-content: flex-start; vertical-align: middle;">`;

            if (detalles && detalles.length > 0) {
                equiposMostrados += detalles.map(d => {
                    // Si TIENE fecha de devolución, lo dejamos tachado de forma discreta o lo ocultás si preferís
                    if (d.fecha_devolucion) {
                        return `
                        <div style="display: inline-flex; align-items: center; background-color: #e9ecef; border: 1px dashed #ced4da; border-radius: 16px; padding: 4px 10px; font-size: 12px; color: #6c757d; text-decoration: line-through; opacity: 0.7; white-space: nowrap;">
                            <span>${d.equipos?.nombre || 'Equipo'}</span>
                            <span style="font-size: 10px; margin-left: 5px; font-style: italic; text-decoration: none;">(Devuelto)</span>
                        </div>
                    `;
                    } else {
                        // Si NO tiene fecha, dibujamos la etiqueta activa con la ✕ roja minimalista
                        return `
                        <div style="display: inline-flex; align-items: center; background-color: #f1f3f5; border: 1px solid #ced4da; border-radius: 16px; padding: 4px 10px; font-size: 12px; font-weight: bold; color: #495057; white-space: nowrap;">
                            <span>${d.equipos?.nombre || 'Equipo'}</span>
                            <button class="btn-devolver-uno" 
                                    data-prestamo="${d.prestamo_id}" 
                                    data-equipo="${d.equipo_id}" 
                                    style="background: none; border: none; color: #dc3545; font-weight: bold; margin-left: 8px; cursor: pointer; font-size: 13px; padding: 0 2px; line-height: 1;"
                                    title="Devolver este equipo">
                                ✕
                            </button>
                        </div>
                    `;
                    }
                }).join('');
            } else {
                equiposMostrados += `<span style="color: #6c757d; font-style: italic;">Sin equipos</span>`;
            }

            equiposMostrados += `</div>`;

            // Creamos la fila siempre
            const fila = document.createElement('tr');
            const fechaFormateada = new Date(prestamo.fecha_salida).toLocaleString('es-AR');

            fila.innerHTML = `
        <td style="vertical-align: middle; text-align: left;">${prestamo.usuarios?.nombre_completo || 'N/A'}</td>
        <td style="vertical-align: middle; text-align: center;">${equiposMostrados}</td>
        
        <td style="vertical-align: middle; font-weight: bold; color: #4b5563; text-align: center;">
            ${prestamo.observaciones || '---'}
        </td>
        
        <td style="vertical-align: middle; white-space: nowrap; text-align: center;">${fechaFormateada}</td>
        
        <td style="vertical-align: middle; text-align: center;">
            <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; align-items: center; width: 100%;">
                <button class="btn-agregar-parcial" data-id="${prestamo.id}" style="background-color: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; width: 90px;">
                    Agregar
                </button>
                <button class="btn-devolver" data-id="${prestamo.id}" style="background-color: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; width: 90px;">
                    Cerrar Lote
                </button>
            </div>
        </td>
    `;

            tabla.appendChild(fila);
           
        }
    } catch (err) {
        console.error("Error UI Tabla Préstamos:", err);
        tabla.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de sincronización.</td></tr>';
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


// Funcion para pintar la barra lateral izquierda con regitros diarios
export function renderRegistrosEnLateral(registros) {
    const tbodyLateral = document.getElementById('tabla-registros-lateral');
    if (!tbodyLateral) return;

    tbodyLateral.innerHTML = '';

    if (!registros || registros.length === 0) {
        tbodyLateral.innerHTML = `<tr><td colspan="5">No hay movimientos hoy.</td></tr>`;
        return;
    }

    registros.forEach(reg => {
        const fila = document.createElement('tr');

        // Extraemos el nombre del docente de la relación directa
        const docente = reg.usuarios?.nombre_completo || 'Sin datos';

        // 🔥 RECORREMOS TODOS LOS EQUIPOS DEL PRÉSTAMO Y ARMAMOS LOS BADGES
        let equiposHTML = '';
        if (reg.detalle_prestamos && reg.detalle_prestamos.length > 0) {
            // Iteramos por cada equipo del array y le clavamos la estructura visual
            equiposHTML = reg.detalle_prestamos.map(dp => {
                const nombreEquipo = dp.equipos?.nombre || 'Desconocido';
                // Usamos las clases nativas de tus burbujas de equipos
                return `<span class="badge-equipo-item" style="display: inline-block; background-color: #fffbeb; color: #b45309; border: 1px solid #fcd34d; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; margin: 2px;">${nombreEquipo}</span>`;
            }).join(' '); // Los une dejando un espacio entre burbujas
        } else {
            equiposHTML = `<span style="color: #6c757d;">Sin equipos</span>`;
        }

        // Recortamos los strings de fecha para mostrar HH:MM de forma prolija
        const salida = reg.fecha_salida ? reg.fecha_salida.substring(11, 16) : '—';
        const devolucion = reg.fecha_devolucion ? reg.fecha_devolucion.substring(11, 16) : '—';

        const tieneDevolucion = reg.fecha_devolucion !== null;
        const claseEstado = tieneDevolucion ? 'badge-devuelto' : 'badge-en-uso';
        const textoEstado = tieneDevolucion ? 'Devuelto' : 'En Uso';

        fila.innerHTML = `
                            <td><strong>${docente}</strong></td>
                            <td><div style="display: flex; flex-wrap: wrap; gap: 4px;">${equiposHTML}</div></td>
                            <td>⏱️ ${salida} hs</td>
                            <td>⏱️ ${devolucion} hs</td>
                            <td><span class="${claseEstado}">${textoEstado}</span></td>
                        `;

        tbodyLateral.appendChild(fila);
    });
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

// 🌐 FUNCIÓN CORREGIDA (SIN EL TYPO DE VARIABLE)
async function ejecutarTraspasoReservaAUso(datosAgrupados) {
    console.log("📊 [DIAGNÓSTICO] Iniciando traspaso para:", datosAgrupados.nombre);
    
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
        
        // Intento A: Si ya venían IDs físicos en el array, los usamos
        if (datosAgrupados.equiposIds && datosAgrupados.equiposIds.length > 0) {
            listaEquiposIds = datosAgrupados.equiposIds;
        } 
        // Intento B: Si venían como texto en el Set (ej: "Netbook 04"), buscamos sus IDs correspondientes
        else if (datosAgrupados.equipos && datosAgrupados.equipos.size > 0) {
            console.log("🔍 'equiposIds' estaba vacío. Buscando correspondencias en BD para el Set:", Array.from(datosAgrupados.equipos));
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

        if (listaEquiposIds.length === 0) {
            alert("No se pudieron determinar los IDs de las netbooks. Proceso detenido para evitar registros vacíos.");
            return;
        }

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
        console.log("✅ Registro maestro asentado en 'prestamos'. ID asignado:", idDelPrestamoMaestro);

        // 4️⃣ INSERCIÓN EN 'DETALLE_PRESTAMOS' (Relación Muchos a Muchos)
        const filasDetalle = listaEquiposIds.map(idEquipo => ({
            prestamo_id: idDelPrestamoMaestro,
            equipo_id: idEquipo
        }));

        const { error: errorDetalle } = await supabaseClient
            .from('detalle_prestamos')
            .insert(filasDetalle);

        if (errorDetalle) throw errorDetalle;
        console.log("✅ Relaciones guardadas con éxito en 'detalle_prestamos'.");

        // 5️⃣ MUTACIÓN DE ESTADO: DE 'Confirmada' A 'En Uso' EN LA TABLA 'RESERVAS'
        if (datosAgrupados.reservaIds && datosAgrupados.reservaIds.length > 0) {
            console.log("🔄 Actualizando estado de reservas vinculadas en Supabase...", datosAgrupados.reservaIds);
            const { error: errorReservas } = await supabaseClient
                .from('reservas')
                .update({ estado: 'En Uso' })
                .in('id', datosAgrupados.reservaIds);

            if (errorReservas) throw errorReservas;
            console.log("✅ Reservas actualizadas a 'En Uso' en la base de datos.");
        }

        // 6️⃣ REFRESCO DE INTERFAZ EN TIEMPO REAL
        alert(`¡Préstamo para ${datosAgrupados.nombre} procesado con éxito absoluto!`);
        window.location.reload(); // Recarga la app para limpiar los paneles y actualizar las pestañas lateral/central

    } catch (error) {
        console.error("❌ Error crítico en el flujo de traspaso:", error);
        alert("Ocurrió un error al guardar el préstamo. Revisá los detalles en la consola de desarrollador.");
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