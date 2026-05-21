// modules/ui.js
import { getDocentes, getEquipos, getPrestamosActivos, getDetallesDePrestamo, getRegistrosDelDia } from './api.js';

// 1. PINTAR LOS DOCENTES EN EL SELECT
export async function renderDocentes() {
    const selectDocente = document.getElementById('docente');
    if (!selectDocente) return;
    try {
        const usuarios = await getDocentes(); // Le pedimos los datos limpios al "cocinero" api.js
        selectDocente.innerHTML = '<option value="">-- Seleccionar Docente --</option>';
        usuarios.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.nombre_completo;
            selectDocente.appendChild(option);
        });
    } catch (err) {
        console.error("Error UI Docentes:", err);
    }
}

// 2. PINTAR LOS BOTONES DE EQUIPOS EN EL MODAL
export async function renderEquipos(state) {
    const contenedor = document.getElementById('contenedor-equipos');
    if (!contenedor) return;

    try {
        const equipos = await getEquipos(); // Le pedimos los equipos a api.js
        contenedor.innerHTML = '';

        // Reiniciamos las selecciones en el estado temporal
        state.idsSeleccionados = [];
        state.nombresSeleccionados = [];

        let infoContador = document.getElementById('contador-modal');
        if (!infoContador) {
            infoContador = document.createElement('p');
            infoContador.id = 'contador-modal';
            infoContador.style.cssText = "text-align: center; margin-top: 15px; font-weight: bold; color: #475569; font-size: 15px;";
            contenedor.after(infoContador);
        }
        infoContador.textContent = `Equipos seleccionados: 0`;

        equipos.forEach(eq => {
            const btn = document.createElement('button');
            btn.textContent = eq.nombre;
            btn.type = "button";
            btn.className = `btn-equipo ${eq.estado.toLowerCase()}`;

            if (eq.estado.toLowerCase() === 'disponible') {
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
                    infoContador.textContent = `Equipos seleccionados: ${state.idsSeleccionados.length}`;
                });
            } else {
                btn.disabled = true;
            }
            contenedor.appendChild(btn);
        });
    } catch (err) {
        console.error("Error UI Equipos:", err);
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
            <td style="vertical-align: middle;">${prestamo.usuarios?.nombre_completo || 'N/A'}</td>
            <td style="vertical-align: middle;">${equiposMostrados}</td>
            <td style="vertical-align: middle; white-space: nowrap;">${fechaFormateada}</td>
            
            <td style="vertical-align: middle;">
                <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; align-items: center; min-width: 110px;">
                    <button class="btn-agregar-parcial"
                            data-id="${prestamo.id}"
                            style="background-color: #28a745; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; text-align: center;">
                        Agregar
                    </button>
                    <button class="btn-devolver"
                            data-id="${prestamo.id}"
                            style="background-color: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; text-align: center;">
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

            fila.innerHTML = `
                <td><strong>${reg.usuarios?.nombre_completo || 'Desconocido'}</strong></td>
                <td>${reg.equipos?.nombre || 'Equipo Eliminado'}</td>
                <td>⏱️ ${horaSalida} hs</td>
                <td>⏱️ ${horaDevolucion} hs</td>
                <td style="text-align:center;">${etiquetaEstado}</td>
            `;
            tablaDiaria.appendChild(fila);
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