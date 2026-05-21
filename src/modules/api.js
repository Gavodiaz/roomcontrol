// modules/api.js
import { supabaseClient } from './supabase.js';

// 1. Traer la lista de docentes para el select
export async function getDocentes() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('id, nombre_completo');
    if (error) throw error;
    return data;
}

// 2. Traer todos los equipos para el panel/modal
export async function getEquipos() {
    const { data, error } = await supabaseClient
        .from('equipos')
        .select('id, nombre, estado');
    if (error) throw error;
    return data;
}

// 3. Registrar el préstamo general (Cabecera)
export async function insertarPrestamoCabecera(usuarioId, primerEquipoId) {
    const { data, error } = await supabaseClient
        .from('prestamos')
        .insert([{ usuario_id: parseInt(usuarioId), equipo_id: primerEquipoId }])
        .select();
    if (error) throw error;
    return data[0].id; // Nos devuelve el ID del préstamo que se acaba de crear
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
export async function getRegistrosDelDia(stringInicioHoy) {
    const { data, error } = await supabaseClient
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
    if (error) throw error;
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