// app.js
import { renderDocentes, 
    renderEquipos, 
    renderTablaPrestamos, 
    renderHistorialDiario, 
    abrirModal, 
    cerrarModal,
    renderHistorialEnModal
} from './modules/ui.js';
import { insertarPrestamoCabecera, 
    insertarPrestamoDetalle, 
    actualizarEstadoEquipo,
    registrarFechaDevolucion, 
    getDetallesDePrestamo,
    devolverEquipoIndividual,
    agregarEquipoAlDetalle,
    getPrestamosPorFecha
    } from './modules/api.js';

// Un objeto "estado" temporal para compartir la selección de equipos entre el modal y el guardado
const appState = {
    idsSeleccionados: [],
    nombresSeleccionados: []
};
let prestamoSeleccionadoId = null;

// 1. INICIALIZACIÓN: Cuando se abre la página, mandamos a pintar todo
document.addEventListener('DOMContentLoaded', async () => {
    await renderDocentes();
    await renderEquipos(appState);
    await renderTablaPrestamos();
});

// 2. EVENTOS DEL MODAL DE EQUIPOS
document.getElementById('btn-abrir-modal').addEventListener('click', abrirModal);

// Cancelar/Cerrar del Modal (Limpiamos cualquier onclick viejo del HTML)
document.querySelector('.btn-historial[onclick="cerrarModal()"]')?.removeAttribute('onclick'); 
document.querySelector('.btn-historial')?.addEventListener('click', () => {
    // 🔍 ¡ESTE ES EL DETALLE!: Si cierran el modal tocando "Cancelar", limpiamos la memoria
    prestamoSeleccionadoId = null; 
    appState.idsSeleccionados = [];
    appState.nombresSeleccionados = [];
    cerrarModal(); // Ejecuta la función visual original que viene de ui.js
});

// Confirmar la selección adentro del modal
document.getElementById('btn-confirmar-seleccion-modal').addEventListener('click', async () => {
    if (appState.idsSeleccionados.length === 0) {
        alert("Por favor, selecciona al menos un equipo antes de confirmar.");
        return;
    }

    // 🔍 ¡EL CAMBIO CLAVE!: Evaluamos si venimos de presionar el botón "Agregar" de la tabla
    if (prestamoSeleccionadoId !== null) {
        try {
            // Recorremos los equipos tildados e insertamos directo uno por uno en Supabase
            for (const equipoId of appState.idsSeleccionados) {
                await agregarEquipoAlDetalle(prestamoSeleccionadoId, equipoId);
                // Cambiamos el estado del equipo en el inventario a 'Prestado'
                await actualizarEstadoEquipo(equipoId, 'Prestado');
            }

            alert("¡Equipo(s) agregado(s) con éxito al lote!");

            // Limpiamos el estado para que no interfiera en futuros préstamos
            prestamoSeleccionadoId = null;
            appState.idsSeleccionados = [];
            appState.nombresSeleccionados = [];

            // Cerramos el modal usando tu función nativa
            cerrarModal(); 

            // Refrescamos la tabla para que impacte el cambio visual en la pantalla al instante
            await renderTablaPrestamos();
            await renderEquipos(appState);

        } catch (error) {
            console.error("Error al agregar el equipo parcial:", error);
            alert("Hubo un error al agregar el equipo a la base de datos.");
        }
    } else {
        // --- CASO NORMAL: TU CÓDIGO VIEJO DE SIEMPRE PARA PRÉSTAMO NUEVO ---
        // Guardamos los IDs en el input oculto separados por comas
        document.getElementById('input-equipo-oculto').value = appState.idsSeleccionados.join(',');

        if (appState.nombresSeleccionados.length <= 2) {
            document.getElementById('btn-abrir-modal').textContent = `Equipos: ${appState.nombresSeleccionados.join(', ')}`;
        } else {
            document.getElementById('btn-abrir-modal').textContent = `Equipos: (${appState.idsSeleccionados.length}) seleccionados`;
        }
        
        cerrarModal();
    }
});

// 3. EVENTO PARA GUARDAR EL PRÉSTAMO (Clic en Registrar)
const btnRegistrar = document.getElementById('btn-registrar-prestamo');
if (btnRegistrar) {
    btnRegistrar.addEventListener('click', async () => {
        const usuarioId = document.getElementById('docente').value;
        const equiposTexto = document.getElementById('input-equipo-oculto').value; 
        const observaciones = document.getElementById('observaciones').value || "Sin observaciones";

        if (!usuarioId || !equiposTexto) {
            alert("Por favor, seleccione un docente y al menos un equipo.");
            return;
        }

        const arrayEquiposIds = equiposTexto.split(',');

        try {
            const primerEquipoId = parseInt(arrayEquiposIds[0]);
            
            // PASO 1: Insertar la Cabecera del préstamo
            const prestamoId = await insertarPrestamoCabecera(usuarioId, primerEquipoId);

            // PASO 2: Insertar cada equipo en el Detalle y cambiarle el estado
            for (const equipoIdStr of arrayEquiposIds) {
                const equipoIdNum = parseInt(equipoIdStr);
                await insertarPrestamoDetalle(prestamoId, equipoIdNum);
                await actualizarEstadoEquipo(equipoIdNum, 'Prestado');
            }

            alert("¡Préstamo y sus detalles registrados con éxito!");
            
            // Limpiamos los campos del formulario
            document.getElementById('form-prestamo').reset();
            document.getElementById('input-equipo-oculto').value = "";
            document.getElementById('btn-abrir-modal').textContent = "Cambiar / Seleccionar Equipo";
            
            // Le decimos a la UI que vuelva a dibujar las tablas actualizadas
            await renderEquipos(appState);
            await renderTablaPrestamos();

        } catch (err) {
            console.error("Error al registrar préstamo:", err);
            alert("Ocurrió un error inesperado al guardar.");
        }
    });
}

// 4. ESCUCHADOR DE DEVOLUCIONES (Captura el clic en los botones de la tabla)
document.getElementById('tabla-prestamos').addEventListener('click', async (e) => {
    
    // A) CASO: Devolver UN solo equipo (Botón nuevo)
    if (e.target && e.target.classList.contains('btn-devolver-uno')) {
        const pId = e.target.getAttribute('data-prestamo');
        const eId = e.target.getAttribute('data-equipo');
        
        if(confirm("¿Seguro querés devolver esta máquina específica?")) {
            try {
                await devolverEquipoIndividual(pId, eId);
                alert("Equipo devuelto al inventario.");
                await renderEquipos(appState);
                await renderTablaPrestamos();
            } catch (err) {
                console.error("Error al devolver individual:", err);
                alert("No se pudo procesar la devolución.");
            }
        }
        return; // IMPORTANTE: Cortamos acá para que no siga al otro botón
    }

    // B) CASO: Devolver TODO el lote (Botón viejo)
    if (e.target && e.target.classList.contains('btn-devolver')) {
        const idPrestamo = e.target.getAttribute('data-id');
        
        if(confirm("¿Seguro querés cerrar todo el préstamo y devolver todas las máquinas?")) {
            try {
                const detalles = await getDetallesDePrestamo(idPrestamo);
                await registrarFechaDevolucion(idPrestamo);

                if (detalles && detalles.length > 0) {
                    for (const d of detalles) {
                        await actualizarEstadoEquipo(d.equipo_id, 'Disponible');
                    }
                }
                
                alert("¡Lote de equipos devuelto y disponible!");
                await renderEquipos(appState);
                await renderTablaPrestamos();
            } catch (err) {
                console.error("Error en devolución total:", err);
                alert("No se pudo procesar la devolución.");
            }
        }
        return;
    }

    // Caso C agregar un equipo parcial al registro (botón agregar)
    else if (e.target && e.target.classList.contains('btn-agregar-parcial')) {
        const prestamoId = e.target.getAttribute('data-id');
        
        // 1. Guardamos el ID del préstamo en la variable global
        prestamoSeleccionadoId = prestamoId;
        
        // 2. Ejecutamos la función que lee Supabase y dibuja los cuadraditos disponibles
        await renderEquipos(appState);
        
        // 3. ¡Ejecutamos tu función nativa para abrir la ventana emergente!
        abrirModal();
    }
});

// 5. BOTÓN DE HISTORIAL DIARIO (Esconde o muestra la tabla de abajo)
document.getElementById('btn-ver-registros').addEventListener('click', async () => {
    const seccionDiaria = document.getElementById('seccion-registros-diarios');
    if (!seccionDiaria) return;
    
    if (!seccionDiaria.classList.contains('oculto')) {
        seccionDiaria.classList.add('oculto');
        return;
    }

    seccionDiaria.classList.remove('oculto');
    await renderHistorialDiario();
});


// CONTROL DEL MODAL DE HISTORIAL DIARIO
const modalHistorial = document.getElementById('modal-historial');
const inputFecha = document.getElementById('fecha-busqueda');

// 1. Abrir el modal al hacer clic en Registros Diarios
document.getElementById('btn-ver-registros').addEventListener('click', async () => {
    // Ponemos por defecto la fecha de hoy en el calendario (formato YYYY-MM-DD)
    if (!inputFecha.value) {
        const hoy = new Date().toISOString().split('T')[0];
        inputFecha.value = hoy;
    }
    
    // Mostramos el modal usando Flexbox para centrarlo
    modalHistorial.style.display = 'flex';
    
    // Cargamos los datos del día
    await cargarHistorialPorFecha(inputFecha.value);
});

// 2. Escuchar cuando el preceptor cambia la fecha en el calendario
inputFecha.addEventListener('change', async (e) => {
    await cargarHistorialPorFecha(e.target.value);
});

// 3. Cerrar el modal al tocar la "X"
document.getElementById('btn-cerrar-historial').addEventListener('click', () => {
    modalHistorial.style.display = 'none';
});

// Función interna auxiliar para coordinar la búsqueda y el dibujado
async function cargarHistorialPorFecha(fecha) {
    const registros = await getPrestamosPorFecha(fecha);
    renderHistorialEnModal(registros);
}