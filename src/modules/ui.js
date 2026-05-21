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
        let equiposMostrados = detalles.map(d => {
            // Si TIENE fecha de devolución, ocultamos el botón y lo marcamos
            if (d.fecha_devolucion) {
                return `
                    <span style="display:block; margin-bottom:5px; color: #888;">
                        <s>${d.equipos?.nombre}</s> <em>(Devuelto)</em>
                    </span>
                `;
            } else {
                // Si NO tiene fecha, dibujamos el equipo con su botón normal
                return `
                    <span style="display:block; margin-bottom:5px;">
                        ${d.equipos?.nombre} 
                        <button class="btn-devolver-uno" 
                                data-prestamo="${prestamo.id}" 
                                data-equipo="${d.equipo_id}">
                            Devolver
                        </button>
                    </span>
                `;
            }
        }).join('');

        // Creamos la fila siempre
        const fila = document.createElement('tr');
        const fechaFormateada = new Date(prestamo.fecha_salida).toLocaleString('es-AR');
        
       fila.innerHTML = `
            <td>${prestamo.usuarios?.nombre_completo || 'N/A'}</td>
            <td>${equiposMostrados}</td>
            <td>${fechaFormateada}</td>
            <td>${prestamo.observaciones || 'Sin observaciones'}</td>
            <td>
                <button class="btn-devolver" data-id="${prestamo.id}">Cerrar Lote</button>
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