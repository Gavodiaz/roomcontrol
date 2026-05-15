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
    const selectEquipo = document.getElementById('equipo');
    
    // Traemos solo los equipos que figuren como 'Disponible'
    const { data: equipos, error } = await supabaseClient
        .from('equipos')
        .select('id, nombre')
        .eq('estado', 'Disponible');

    if (error) {
        console.error("Error al cargar equipos:", error);
        return;
    }

    selectEquipo.innerHTML = '<option value="">-- Seleccionar Equipo --</option>';
    equipos.forEach(eq => {
        const option = document.createElement('option');
        option.value = eq.id;
        option.textContent = eq.nombre;
        selectEquipo.appendChild(option);
    });
}

// 4. ESCUCHAR EL FORMULARIO Y GUARDAR EL PRÉSTAMO REAL EN LA NUBE
const formPrestamo = document.getElementById('form-prestamo');

formPrestamo.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evitamos que la página parpadee o se recargue

    // Ahora obtenemos los IDs numéricos elegidos en los selectores
    const usuarioId = document.getElementById('docente').value;
    const equipoId = document.getElementById('equipo').value;
    const observaciones = document.getElementById('observaciones').value || "Sin observaciones";

    if (!usuarioId || !equipoId) {
        alert("Por favor, seleccione un docente y un equipo válidos.");
        return;
    }

    // Insertar el préstamo en la tabla 'prestamos' de Supabase
    const { error: errorPrestamo } = await supabaseClient
        .from('prestamos')
        .insert([
            { 
                usuario_id: parseInt(usuarioId), 
                equipo_id: parseInt(equipoId), 
                observaciones: observaciones 
            }
        ]);

    if (errorPrestamo) {
        console.error("Error al guardar el préstamo:", errorPrestamo);
        alert("Hubo un error al registrar en la base de datos.");
        return;
    }

    // Si el préstamo se guardó bien, actualizamos el estado del equipo a 'Prestado'
    await supabaseClient
        .from('equipos')
        .update({ estado: 'Prestado' })
        .eq('id', equipoId);

    // Refrescamos toda la pantalla para que se vea reflejado el cambio
    formPrestamo.reset();
    await cargarEquiposEnFormulario(); // El equipo prestado ya no debe aparecer en la lista
    await obtenerPrestamosActivos();   // Aparece abajo en la tabla de activos
    alert("¡Préstamo registrado con éxito en la nube!");
});

// 5. MOSTRAR LOS PRÉSTAMOS ACTIVOS EN LA TABLA
async function obtenerPrestamosActivos() {
    const tabla = document.getElementById('tabla-prestamos');
    tabla.innerHTML = '<tr><td colspan="5" style="text-align:center;">Actualizando datos de RoomControl...</td></tr>';

    const { data: listaPrestamos, error } = await supabaseClient
        .from('prestamos')
        .select(`
            id,
            fecha_salida,
            observaciones,
            usuarios ( nombre_completo ),
            equipos ( nombre )
        `)
        .is('fecha_devolucion', null);

    if (error) {
        console.error("Error al renderizar tabla:", error);
        tabla.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de sincronización.</td></tr>';
        return;
    }

    tabla.innerHTML = '';

    if (listaPrestamos.length === 0) {
        tabla.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">No hay equipos prestados en este momento.</td></tr>`;
        return;
    }

    listaPrestamos.forEach((prestamo) => {
        const fila = document.createElement('tr');
        const fechaFormateada = new Date(prestamo.fecha_salida).toLocaleString('es-AR');
        
        fila.innerHTML = `
            <td><strong>${prestamo.usuarios?.nombre_completo || 'Desconocido'}</strong></td>
            <td>${prestamo.equipos?.nombre || 'Equipo Eliminado'}</td>
            <td>${fechaFormateada}</td>
            <td><small>${prestamo.observaciones}</small></td>
            <td>
                <button class="btn-devolver" onclick="devolverEquipoReal(${prestamo.id}, ${prestamo.equipo_id})">Devolver</button>
            </td>
        `;
        tabla.appendChild(fila);
    });
}

// 6. FUNCIÓN GLOBAL PARA DEVOLVER EL EQUIPO (Actualizada con supabaseClient)
window.devolverEquipoReal = async function(idPrestamo) {
    // 1. Buscamos qué equipo era para saber cuál hay que liberar
    const { data: prestamo, error: errorBuscar } = await supabaseClient
        .from('prestamos')
        .select('equipo_id')
        .eq('id', idPrestamo)
        .single();

    if (errorBuscar || !prestamo) {
        console.error("No se encontró el registro del préstamo:", errorBuscar);
        alert("Error al procesar la devolución.");
        return;
    }

    const horaActual = new Date().toISOString();

    // 2. Registramos la fecha y hora de devolución en la tabla de préstamos
    const { error: errorDevolucion } = await supabaseClient
        .from('prestamos')
        .update({ fecha_devolucion: horaActual })
        .eq('id', idPrestamo);

    if (errorDevolucion) {
        console.error("Error al actualizar el préstamo:", errorDevolucion);
        alert("No se pudo registrar la devolución en la base de datos.");
        return;
    }

    // 3. Volvemos a poner el equipo como 'Disponible' en el inventario
    const { error: errorEquipo } = await supabaseClient
        .from('equipos')
        .update({ estado: 'Disponible' })
        .eq('id', prestamo.equipo_id);

    if (errorEquipo) {
        console.error("Error al liberar el equipo:", errorEquipo);
    }

    // 4. Refrescamos la pantalla al instante para ver los cambios
    await cargarEquiposEnFormulario(); // El equipo vuelve a aparecer en el menú desplegable
    await obtenerPrestamosActivos();   // Desaparece de la tabla de "Equipos en Uso"
    
    alert("¡Equipo devuelto y disponible en el inventario!");


};

// ==========================================
// MÓDULO NUEVO: HISTORIAL DE REGISTROS DIARIOS
// ==========================================

// Escuchamos el clic en el botón de Registros Diarios
document.getElementById('btn-ver-registros').addEventListener('click', async () => {
    const seccionDiaria = document.getElementById('seccion-registros-diarios');
    
    // Si la sección ya está a la vista, la ocultamos (efecto interruptor toggle)
    if (!seccionDiaria.classList.contains('oculto')) {
        seccionDiaria.classList.add('oculto');
        return;
    }

    // Si estaba oculta, la mostramos y cargamos los datos frescos de la nube
    seccionDiaria.classList.remove('oculto');
    await cargarRegistrosDelDia();
});

// Función corregida para consultar a Supabase los préstamos del día de hoy
async function cargarRegistrosDelDia() {
    const tablaDiaria = document.getElementById('tabla-registros-diarios');
    tablaDiaria.innerHTML = '<tr><td colspan="5" style="text-align:center;">Buscando movimientos de hoy...</td></tr>';

    // 1. Conseguir el año, mes y día actual de tu computadora (Formato: AAAA-MM-DD)
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
    const dia = String(hoy.getDate()).padStart(2, '0');
    
    // Esto arma una cadena fija: "2026-05-15T00:00:00" sin importar el desvío UTC
    const stringInicioHoy = `${anio}-${mes}-${dia}T00:00:00`;

    // 2. Traer de Supabase todos los préstamos que arrancaron desde la medianoche de hoy
    const { data: registrosHoy, error } = await supabaseClient
        .from('prestamos')
        .select(`
            id,
            fecha_salida,
            fecha_devolucion,
            usuarios ( nombre_completo ),
            equipos ( nombre )
        `)
        .gte('fecha_salida', stringInicioHoy) // Mayor o igual que las 00:00 de hoy local
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

    // 3. Renderizar las filas en la tabla secundaria
    registrosHoy.forEach(reg => {
        const fila = document.createElement('tr');
        
        // Formateamos las horas en formato local 24hs
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