// 1. Configurar las credenciales de conexión
const SUPABASE_URL = "https://efoqflojnflvjcnwqmbv.supabase.co";
const SUPABASE_KEY = "sb_publishable_vJmwrWruhAuoMa1w1hJNaA_zdagIpTT";
// Usamos 'supabaseClient' para que no repita el identificador global
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Ejecutar apenas se abre la página en el navegador
document.addEventListener('DOMContentLoaded', async () => {
    await cargarDocentesEnFormulario();
    await cargarEquiposEnFormulario();
    await obtenerPrestamosActivos();
});

// 2. FUNCIÓN PARA LLENAR EL SELECT DE DOCENTES DESDE SUPABASE
async function cargarDocentesEnFormulario() {
    const selectDocente = document.getElementById('docente');
    
    // Traemos el ID y Nombre de todos los usuarios de la base de datos
    const { data: usuarios, error } = await supabaseClient
        .from('usuarios')
        .select('id, nombre_completo');

    if (error) {
        console.error("Error al cargar usuarios:", error);
        return;
    }

    // Limpiamos las opciones estáticas e insertamos las reales
    selectDocente.innerHTML = '<option value="">-- Seleccionar Docente --</option>';
    usuarios.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id; // Guardamos el ID como valor lógico
        option.textContent = user.nombre_completo; // Mostramos el nombre en pantalla
        selectDocente.appendChild(option);
    });
}

// 3. FUNCIÓN PARA LLENAR EL SELECT DE EQUIPOS DISPONIBLES
async function cargarEquiposEnFormulario() {
    const contenedor = document.getElementById('contenedor-equipos');
    
    const { data: equipos, error } = await supabaseClient
        .from('equipos')
        .select('id, nombre, estado');

    if (error) {
        console.error("Error al cargar equipos:", error);
        return;
    }

    contenedor.innerHTML = ''; // Limpiar panel
    
    // Arrays temporales para guardar lo que el usuario va tocando
    let idsSeleccionadosTemporal = [];
    let nombresSeleccionadosTemporal = [];

    // CREAMOS O BUSCAMOS EL TEXTO DEL CONTADOR PRIMERO
    let infoContador = document.getElementById('contador-modal');
    if (!infoContador) {
        infoContador = document.createElement('p');
        infoContador.id = 'contador-modal';
        infoContador.style.cssText = "text-align: center; margin-top: 15px; font-weight: bold; color: #475569; font-size: 15px;";
        // Lo metemos en el modal (abajo de donde se dibuja la grilla)
        contenedor.after(infoContador);
    }
    
    // Al principio, no hay ninguno seleccionado
    infoContador.textContent = `Equipos seleccionados: 0`;

    equipos.forEach(eq => {
        const btn = document.createElement('button');
        btn.textContent = eq.nombre;
        btn.type = "button";
        btn.className = `btn-equipo ${eq.estado.toLowerCase()}`;
        
        if (eq.estado === 'Disponible' || eq.estado === 'disponible') {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('seleccionado')) {
                    btn.classList.remove('seleccionado');
                    idsSeleccionadosTemporal = idsSeleccionadosTemporal.filter(id => id !== eq.id);
                    nombresSeleccionadosTemporal = nombresSeleccionadosTemporal.filter(n => n !== eq.nombre);
                } else {
                    btn.classList.add('seleccionado');
                    idsSeleccionadosTemporal.push(eq.id);
                    nombresSeleccionadosTemporal.push(eq.nombre);
                }
                
                // ACTUALIZAMOS EL CONTADOR EN TIEMPO REAL CON CADA CLICK
                infoContador.textContent = `Equipos seleccionados: ${idsSeleccionadosTemporal.length}`;
            });
        } else {
            btn.disabled = true;
        }
        
        contenedor.appendChild(btn);
    });

    // CONFIGURAMOS EL BOTÓN "SELECCIONAR" DEL MODAL
    const btnConfirmar = document.getElementById('btn-confirmar-seleccion-modal');
    
    // Clonamos el botón para limpiar eventos viejos acumulados
    const btnConfirmarNuevo = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(btnConfirmarNuevo, btnConfirmar);

    btnConfirmarNuevo.addEventListener('click', () => {
        if (idsSeleccionadosTemporal.length === 0) {
            alert("Por favor, selecciona al menos un equipo antes de confirmar.");
            return;
        }

        // Guardamos los IDs como texto separado por comas
        document.getElementById('input-equipo-oculto').value = idsSeleccionadosTemporal.join(',');
        
        // Cambiamos el texto del botón de afuera
        const botonAfuera = document.getElementById('btn-abrir-modal');
        if (nombresSeleccionadosTemporal.length <= 2) {
            botonAfuera.textContent = `Equipos: ${nombresSeleccionadosTemporal.join(', ')}`;
        } else {
            botonAfuera.textContent = `Equipos: (${idsSeleccionadosTemporal.length}) seleccionados`;
        }
        
        cerrarModal();
    });
}

// Abrir y cerrar la ventana
document.getElementById('btn-abrir-modal').addEventListener('click', () => {
    document.getElementById('modal-equipos').classList.remove('oculto');
});

function cerrarModal() {
    document.getElementById('modal-equipos').classList.add('oculto');
}

// 4. ESCUCHAR EL CLICK DIRECTO EN EL BOTÓN PARA GUARDAR EN MAESTRO-DETALLE
const btnRegistrar = document.getElementById('btn-registrar-prestamo');

if (btnRegistrar) {
    console.log("--> [OK] Botón 'btn-registrar-prestamo' detectado en la pantalla.");
    
    btnRegistrar.addEventListener('click', async () => {
        console.log("--> 1. CLICK DETECTADO EN EL BOTÓN DE CONFIRMAR");

        const usuarioId = document.getElementById('docente').value;
        const equiposTexto = document.getElementById('input-equipo-oculto').value; 
        const observaciones = document.getElementById('observaciones').value || "Sin observaciones";

        console.log("--> 2. DATOS CAPTURADOS:", { usuarioId, equiposTexto, observaciones });

        if (!usuarioId || !equiposTexto) {
            alert("Por favor, seleccione un docente y al menos un equipo.");
            return;
        }

        const arrayEquiposIds = equiposTexto.split(',');
        console.log("--> 3. ARRAY DE EQUIPOS A PROCESAR:", arrayEquiposIds);

        try {
            const primerEquipoId = parseInt(arrayEquiposIds[0]);
            console.log("--> 4. ENVIANDO CABECERA A SUPABASE...");

            // PASO 1: Insertar en la tabla 'prestamos'
            const { data: nuevoPrestamo, error: errorPrestamo } = await supabaseClient
                .from('prestamos')
                .insert([
                    { 
                        usuario_id: parseInt(usuarioId),
                        equipo_id: primerEquipoId 
                    }
                ])
                .select(); 

            console.log("--> 5. RESPUESTA DE SUPABASE CABECERA:", { nuevoPrestamo, errorPrestamo });

            if (errorPrestamo) {
                console.error("--> ERROR EN PASO 1:", errorPrestamo);
                alert("Error en prestamos: " + errorPrestamo.message);
                return;
            }

            const prestamoId = nuevoPrestamo[0].id;
            console.log("--> 6. CABECERA CREADA. ID GENERADO:", prestamoId);

            // PASO 2: Recorrer e insertar en 'detalle_prestamos'
            for (const equipoIdStr of arrayEquiposIds) {
                const equipoIdNum = parseInt(equipoIdStr);
                console.log(`--> 7. INSERTANDO DETALLE PARA EQUIPO ID: ${equipoIdNum}`);

                const { error: errorDetalle } = await supabaseClient
                    .from('detalle_prestamos')
                    .insert([
                        {
                            prestamo_id: prestamoId,
                            equipo_id: equipoIdNum
                        }
                    ]);

                if (errorDetalle) {
                    console.error(`--> ERROR EN DETALLE PARA EQUIPO ${equipoIdNum}:`, errorDetalle);
                    alert("Error en detalle_prestamos: " + errorDetalle.message);
                    return;
                }

                console.log(`--> 8. ACTUALIZANDO ESTADO DEL EQUIPO ID: ${equipoIdNum}`);
                await supabaseClient
                    .from('equipos')
                    .update({ estado: 'Prestado' })
                    .eq('id', equipoIdNum);
            }

            console.log("--> 9. PROCESO FINALIZADO CON ÉXITO");
            alert("¡Préstamo y sus detalles registrados con éxito!");
            
            // Limpiar todo
            document.getElementById('form-prestamo').reset();
            document.getElementById('input-equipo-oculto').value = "";
            document.getElementById('btn-abrir-modal').textContent = "Cambiar / Seleccionar Equipo";
            
            await cargarEquiposEnFormulario();
            await obtenerPrestamosActivos();

        } catch (err) {
            console.error("--> ERROR CRÍTICO:", err);
            alert("Ocurrió un error inesperado.");
        }
    });
} else {
    console.error("CRÍTICO: No se encontró el botón con ID 'btn-registrar-prestamo' en el HTML.");
}






// 5. MOSTRAR LOS PRÉSTAMOS ACTIVOS EN LA TABLA (Muestra múltiples equipos)
async function obtenerPrestamosActivos() {
    const tabla = document.getElementById('tabla-prestamos');
    if (!tabla) return;
    
    tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;">Actualizando datos de RoomControl...</td></tr>';

    // 1. Traemos los préstamos que NO han sido devueltos todavía
    const { data: listaPrestamos, error } = await supabaseClient
        .from('prestamos')
        .select(`
            id,
            fecha_salida,
            observaciones,
            usuarios ( nombre_completo )
        `)
        .is('fecha_devolucion', null)
        .order('fecha_salida', { ascending: false });

    if (error) {
        console.error("Error al renderizar tabla:", error);
        tabla.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de sincronización.</td></tr>';
        return;
    }

    tabla.innerHTML = '';

    if (!listaPrestamos || listaPrestamos.length === 0) {
        tabla.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay equipos prestados en este momento.</td></tr>`;
        return;
    }

    // 2. Procesamos cada préstamo activo para buscar sus detalles correspondientes
    for (const prestamo of listaPrestamos) {
        
        // Consultamos la tabla secundaria filtrando por el ID de este préstamo específico
        const { data: detalles, error: errorDetalles } = await supabaseClient
            .from('detalle_prestamos')
            .select(`
                equipos ( nombre )
            `)
            .eq('prestamo_id', prestamo.id);

        let equiposMostrados = "Sin equipos";

        if (!errorDetalles && detalles && detalles.length > 0) {
            // Extraemos los nombres reales de los equipos y los unimos limpiamente con una coma
            const nombresArray = detalles.map(d => d.equipos?.nombre).filter(n => n);
            equiposMostrados = nombresArray.join(', ');
        }

        const fila = document.createElement('tr');
        const fechaFormateada = new Date(prestamo.fecha_salida).toLocaleString('es-AR');
        
        fila.innerHTML = `
            <td><strong>${prestamo.usuarios?.nombre_completo || 'Desconocido'}</strong></td>
            <td style="color: #1e40af; font-weight: 600;">${equiposMostrados}</td>
            <td>${fechaFormateada}</td>
            <td><small>${prestamo.observaciones || 'Sin observaciones'}</small></td>
            <td>
                <button class="btn-devolver" onclick="devolverEquipoReal(${prestamo.id})">Devolver</button>
            </td>
        `;
        tabla.appendChild(fila);
    }
}






// 6. FUNCIÓN GLOBAL PARA DEVOLVER EL EQUIPO (Libera todos los equipos del lote)
window.devolverEquipoReal = async function(idPrestamo) {
    
    // 1. Buscamos TODOS los equipos vinculados a este préstamo en el detalle
    const { data: detalles, error: errorBuscar } = await supabaseClient
        .from('detalle_prestamos')
        .select('equipo_id')
        .eq('id', idPrestamo); // Busca las relaciones vinculadas

    const horaActual = new Date().toISOString();

    // 2. Registramos el fin del préstamo en la cabecera general
    const { error: errorDevolucion } = await supabaseClient
        .from('prestamos')
        .update({ fecha_devolucion: horaActual })
        .eq('id', idPrestamo);

    if (errorDevolucion) {
        console.error("Error al actualizar el préstamo:", errorDevolucion);
        alert("No se pudo registrar la devolución en la base de datos.");
        return;
    }

    // 3. Volvemos a poner TODOS los equipos involucrados como 'Disponible'
    if (detalles && detalles.length > 0) {
        for (const d of detalles) {
            await supabaseClient
                .from('equipos')
                .update({ estado: 'Disponible' })
                .eq('id', d.equipo_id);
        }
    } else {
        // Por resguardo, si no hay detalle_prestamos aún procesado, libera el de la cabecera por defecto
        const { data: prestamoCabecera } = await supabaseClient
            .from('prestamos')
            .select('equipo_id')
            .eq('id', idPrestamo)
            .single();
            
        if (prestamoCabecera && prestamoCabecera.equipo_id) {
            await supabaseClient
                .from('equipos')
                .update({ estado: 'Disponible' })
                .eq('id', prestamoCabecera.equipo_id);
        }
    }

    // 4. Refrescamos toda la interfaz al instante
    await cargarEquiposEnFormulario();
    await obtenerPrestamosActivos();   
    
    alert("¡Lote de equipos devuelto y disponible en el inventario!");
};



// ==========================================
// MÓDULO NUEVO: HISTORIAL DE REGISTROS DIARIOS
// ==========================================
const btnVerRegistros = document.getElementById('btn-ver-registros');
if (btnVerRegistros) {
    btnVerRegistros.addEventListener('click', async () => {
        const seccionDiaria = document.getElementById('seccion-registros-diarios');
        if (!seccionDiaria) return;
        
        if (!seccionDiaria.classList.contains('oculto')) {
            seccionDiaria.classList.add('oculto');
            return;
        }

        seccionDiaria.classList.remove('oculto');
        await cargarRegistrosDelDia();
    });
}

async function cargarRegistrosDelDia() {
    const tablaDiaria = document.getElementById('tabla-registros-diarios');
    if (!tablaDiaria) return;
    
    tablaDiaria.innerHTML = '<tr><td colspan="5" style="text-align:center;">Buscando movimientos de hoy...</td></tr>';

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0'); 
    const dia = String(hoy.getDate()).padStart(2, '0');
    
    const stringInicioHoy = `${anio}-${mes}-${dia}T00:00:00`;

    const { data: registrosHoy, error } = await supabaseClient
        .from('prestamos')
        .select(`
            id,
            fecha_salida,
            fecha_devolucion,
            usuarios ( nombre_completo ),
            equipos ( nombre )
        `)
        .gte('fecha_salida', stringInicioHoy) 
        .order('fecha_salida', { ascending: false });

    if (error) {
        console.error("Error al traer registros diarios:", error);
        tablaDiaria.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error al consultar el historial diario.</td></tr>';
        return;
    }

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
}