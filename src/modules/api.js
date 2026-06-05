// modules/api.js
import { supabaseClient } from './supabase.js';

// 1. Traer la lista de docentes para el select
export async function getDocentes() {
    const { data, error } = await supabaseClient  // 👈 Usando tu cliente original
        .from('usuarios')
        .select('id, nombre_completo, dni')       // 🚀 CLAVE: Aseguramos que traiga el DNI
        .eq('rol', 'Docente')                      // O como lo tengas filtrado en tu sistema
        .order('nombre_completo', { ascending: true });

    if (error) {
        console.error("Error al traer docentes:", error);
        return [];
    }
    return data;
}

// 2. Traer todos los equipos para el panel/modal
export async function getEquipos() {
    const { data, error } = await supabaseClient // Tu cliente original
        .from('equipos')
        .select('id, nombre, estado') // (O los campos exactos que traigas de ahí)
        .order('nombre', { ascending: true }); // 🚀 LA MAGIA CORREGIDA ACÁ

    if (error) {
        console.error("Error al obtener los equipos ordendados:", error);
        return [];
    }
    return data;
}

// 3. Registrar el préstamo general (Cabecera)
// 3. Registrar el préstamo general (Cabecera) - Corregido con tu campo original
export async function insertarPrestamoCabecera(usuarioId, primerEquipoId, observaciones) {
    const { data, error } = await supabaseClient
        .from('prestamos')
        .insert([{ 
            usuario_id: parseInt(usuarioId), 
            equipo_id: primerEquipoId,
            observaciones: observaciones // 🎯 Mismo nombre que en Supabase
        }])
        .select();

    if (error) throw error;
    return data[0].id; 
}

// 4. Registrar cada máquina del lote en la tabla secundaria (Detalle)
export async function insertarPrestamoDetalle(prestamoId, equipoIdNum) {
    const { error } = await supabaseClient
        .from('detalle_prestamos')
        .insert([{ prestamo_id: prestamoId, equipo_id: equipoIdNum }]);
    if (error) throw error;
}

// 5. Cambiar el estado de un equipo (Disponible / Prestado)
export async function actualizarEstadoEquipo(equipoId, nuevoEstado) {
    const { error } = await supabaseClient
        .from('equipos')
        .update({ estado: nuevoEstado })
        .eq('id', equipoId);
    if (error) throw error;
}

// 6. Traer los préstamos activos que figuran en la tabla principal (sin devolver)
// En api.js
export async function getPrestamosActivos() {
    const { data, error } = await supabaseClient
        .from('prestamos')
        // El secreto está acá: además de traer todo (*), le pedimos el nombre de la tabla usuarios
        .select('*, usuarios(nombre_completo)') 
        .is('fecha_devolucion', null); // O la lógica de activos que estés usando
        
    if (error) throw error;
    return data;
}

// 7. Buscar qué equipos específicos componen un préstamo
export async function getDetallesDePrestamo(prestamoId) {
    const { data, error } = await supabaseClient
        .from('detalle_prestamos')
        .select('*, equipos(nombre)') // <-- El asterisco '*' se asegura de traer TODO (incluyendo fecha_devolucion)
        .eq('prestamo_id', prestamoId);

    if (error) throw error;
    return data;
}

// 8. Marcar la fecha y hora de devolución en la cabecera
export async function registrarFechaDevolucion(prestamoId) {
    const horaActual = new Date().toISOString();
    const { error } = await supabaseClient
        .from('prestamos')
        .update({ fecha_devolucion: horaActual })
        .eq('id', prestamoId);
    if (error) throw error;
}

// 9. Traer los movimientos que ocurrieron hoy para el Historial Diario
// 9. Traer los movimientos que ocurrieron hoy para el Historial Diario
export async function getRegistrosDelDia(stringInicioHoy) {
    const { data, error } = await supabaseClient
        .from('prestamos')
        .select(`
            id,
            fecha_salida,
            fecha_devolucion,
            usuarios ( nombre_completo ),
            detalle_prestamos (
                id,
                equipos ( nombre )
            )
        `) // 👈 Buscamos la relación exacta: tabla intermedia -> tabla equipos -> columna nombre
        .gte('fecha_salida', stringInicioHoy)
        .order('fecha_salida', { ascending: false });

    if (error) {
        console.error("Error crítico en getRegistrosDelDia:", error);
        throw error;
    }
    return data;
}



//Función que devuelve el equipo parcial en el sector quipos en uso
export async function devolverEquipoIndividual(prestamoId, equipoId) {
    // 1. Liberamos el equipo en inventario
    await actualizarEstadoEquipo(equipoId, 'Disponible');
    
    // 2. En lugar de borrar, marcamos la fecha de devolución
    const { error } = await supabaseClient
        .from('detalle_prestamos')
        .update({ fecha_devolucion: new Date().toISOString() }) // Guardamos el momento exacto
        .eq('prestamo_id', prestamoId)
        .eq('equipo_id', equipoId);
        
    if (error) throw error;
}

//Agrega equipos parciales al lote 
export async function agregarEquipoAlDetalle(prestamoId, equipoId) {
    const { data, error } = await supabaseClient
        .from('detalle_prestamos')
        .insert([
            { 
                prestamo_id: prestamoId, 
                equipo_id: equipoId,
                fecha_devolucion: null // Entra activo listo para usar
            }
        ]);

    if (error) throw error;
    return data;
}

//Consulta que trae los registros por fecha (boton registros)

export async function getPrestamosPorFecha(fechaFormatoISO) {
    // fechaFormatoISO viene como "YYYY-MM-DD" desde el input date
    const inicioDia = `${fechaFormatoISO}T00:00:00.000Z`;
    const finDia = `${fechaFormatoISO}T23:59:59.999Z`;

    const { data, error } = await supabaseClient
        .from('prestamos')
        .select(`
            id,
            fecha_salida,
            fecha_devolucion,
            observaciones,
            usuarios ( nombre_completo ),
            detalle_prestamos (
                fecha_devolucion,
                equipos ( nombre )
            )
        `)
        .gte('fecha_salida', inicioDia)
        .lte('fecha_salida', finDia)
        .order('fecha_salida', { ascending: false });

    if (error) {
        console.error("Error al traer historial:", error);
        return [];
    }
    return data;
}


// =========================================================================
// ABM DE USUARIOS / PROFESORES (Con supabaseClient)
// =========================================================================

/**
 * 1. LEER (Obtener todos los profesores ordenados por nombre)
 */
export async function getUsuarios() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('id, nombre_completo, email, rol, dni, celular')
        .order('nombre_completo', { ascending: true });

    if (error) {
        console.error("Error al obtener usuarios:", error);
        return [];
    }
    return data;
}

/**
 * 2. ALTA (Insertar un nuevo profesor)
 */
export async function insertUsuario(usuarioData) {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .insert([{
            nombre_completo: usuarioData.nombre_completo,
            email: usuarioData.email,
            dni: usuarioData.dni,
            celular: usuarioData.celular,
            rol: usuarioData.rol || 'Docente'
        }])
        .select();

    if (error) {
        console.error("Error al crear usuario:", error);
        throw error;
    }
    return data[0];
}

/**
 * 3. MODIFICACIÓN (Actualizar un profesor existente)
 */
export async function updateUsuario(id, usuarioData) {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .update({
            nombre_completo: usuarioData.nombre_completo,
            email: usuarioData.email,
            dni: usuarioData.dni,
            celular: usuarioData.celular,
            rol: usuarioData.rol || 'Docente'
        })
        .eq('id', id)
        .select();

    if (error) {
        console.error("Error al actualizar usuario:", error);
        throw error;
    }
    return data[0];
}

/**
 * 4. BAJA (Eliminar un profesor por ID)
 */
export async function deleteUsuario(id) {
    const { error } = await supabaseClient
        .from('usuarios')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Error al eliminar usuario:", error);
        throw error;
    }
    return true;
}

/**
 * Trae todos los equipos de Supabase y marca cuáles están ocupados en una fecha y horas específicas.
 */
export async function obtenerDisponibilidadEquipos(fechaSeleccionada, horasSeleccionadas) {
    try {
        // 1. Traer todos los equipos de la escuela ORDENADOS NUMÉRICAMENTE
        const { data: todosLosEquipos, error: errEq } = await supabaseClient
            .from('equipos')
            .select('id, nombre')
            .order('nombre', { ascending: true }); // 🎯 ¡ESTA ES LA LÍNEA MÁGICA!

        if (errEq) throw errEq;

        // 2. Traer reservas ocupadas en esa fecha y horas (Esto queda igual)
        const { data: reservasOcupadas, error: errRes } = await supabaseClient
            .from('reservas')
            .select('equipo_id')
            .eq('fecha_reserva', fechaSeleccionada)
            .in('hora_catedra', horasSeleccionadas);

        if (errRes) throw errRes;

        const idsOcupados = reservasOcupadas ? reservasOcupadas.map(r => r.equipo_id) : [];

        // 3. Mapeamos (Esto también queda igual)
        return todosLosEquipos.map(eq => ({
            id: eq.id,
            nombre: eq.nombre,
            ocupado: idsOcupados.includes(eq.id)
        }));
        
    } catch (error) {
        console.error("Error en obtenerDisponibilidadEquipos con horas:", error.message);
        throw error;
    }
}

/**
 * Inserta múltiples filas en la tabla reservas (Inserción masiva de netbooks)
 * @param {Array} filas - Array de objetos [{docente_id, equipo_id, fecha_reserva, estado}, ...]
 */
export async function guardarReservaMasiva(filas) {
    try {
        const { data, error } = await supabaseClient
            .from('reservas')
            .insert(filas);
        if (error) throw error;
        return data;
    } catch (error) {
        console.error("Error en guardarReservaMasiva:", error.message);
        throw error;
    }
}



// Consulta para obtener las reservas del día
export async function getReservasDelDia(fechaISO) {
    const fecha = fechaISO.split('T')[0]; // Formato YYYY-MM-DD
    
    const { data, error } = await supabaseClient
        .from('reservas')
        .select(`
            id,
            fecha_reserva,
            hora_catedra,
            estado,
            usuarios ( nombre_completo ),
            equipos ( nombre )
        `)
        .eq('fecha_reserva', fecha)
        .eq('estado', 'Confirmada')
        .order('hora_catedra', { ascending: true });

    if (error) {
        console.error("Error al traer reservas:", error);
        return [];
    }
    return data;
}

// Hace la consulta para obtener las reservas del mes 
export async function getReservasDelMes() {
    // 1. Obtenemos el primer día del mes en formato YYYY-MM-DD
    const ahora = new Date();
    const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    
    // Convertimos manualmente a formato YYYY-MM-DD para evitar errores de zona horaria
    const fechaString = primerDia.toISOString().split('T')[0]; 
    
    console.log("FILTRANDO DESDE:", fechaString);

    const { data, error } = await supabaseClient
        .from('reservas')
        .select(`
            *,
            docentes:docente_id(nombre_completo),
            equipos:equipo_id(nombre)
        `)
        .gte('fecha_reserva', fechaString); // Usamos el string simple

    if (error) {
        console.error("Error en consulta:", error);
        throw error;
    }

    return data || [];
}



// 📄 Permite eliminar reservas de la tabla
export async function eliminarReservasMasivas(idsArray) {
    // Reemplazá 'supabase' por el nombre de tu cliente de Supabase si se llama distinto
    const { data, error } = await supabaseClient
        .from('reservas')
        .delete()
        .in('id', idsArray); // Elimina todas las filas cuyo 'id' esté en la lista [96, 97, 98]

    if (error) {
        throw new Error("No se pudieron eliminar las reservas de la base de datos: " + error.message);
    }
    return data;
}