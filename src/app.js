// app.js
import { renderDocentes, renderEquipos, renderTablaPrestamos, renderHistorialDiario, abrirModal, cerrarModal } from './modules/ui.js';
import { insertarPrestamoCabecera, insertarPrestamoDetalle, actualizarEstadoEquipo, registrarFechaDevolucion, getDetallesDePrestamo } from './modules/api.js';

// Un objeto "estado" temporal para compartir la selección de equipos entre el modal y el guardado
const appState = {
    idsSeleccionados: [],
    nombresSeleccionados: []
};

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
document.querySelector('.btn-historial')?.addEventListener('click', cerrarModal);

// Confirmar la selección adentro del modal
document.getElementById('btn-confirmar-seleccion-modal').addEventListener('click', () => {
    if (appState.idsSeleccionados.length === 0) {
        alert("Por favor, selecciona al menos un equipo antes de confirmar.");
        return;
    }
    
    // Guardamos los IDs en el input oculto separados por comas
    document.getElementById('input-equipo-oculto').value = appState.idsSeleccionados.join(',');
    
    const botonAfuera = document.getElementById('btn-abrir-modal');
    if (appState.nombresSeleccionados.length <= 2) {
        botonAfuera.textContent = `Equipos: ${appState.nombresSeleccionados.join(', ')}`;
    } else {
        botonAfuera.textContent = `Equipos: (${appState.idsSeleccionados.length}) seleccionados`;
    }
    cerrarModal();
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
    if (e.target && e.target.classList.contains('btn-devolver')) {
        const idPrestamo = e.target.getAttribute('data-id');
        
        try {
            // Buscamos los equipos que pertenecen a este lote
            const detalles = await getDetallesDePrestamo(idPrestamo);
            
            // Ponemos la fecha de devolución en la cabecera
            await registrarFechaDevolucion(idPrestamo);

            // Liberamos todas las máquinas involucradas
            if (detalles && detalles.length > 0) {
                for (const d of detalles) {
                    await actualizarEstadoEquipo(d.equipo_id, 'Disponible');
                }
            }

            // Actualizamos la pantalla al instante
            await renderEquipos(appState);
            await renderTablaPrestamos();
            alert("¡Lote de equipos devuelto y disponible en el inventario!");
        } catch (err) {
            console.error("Error en devolución:", err);
            alert("No se pudo procesar la devolución.");
        }
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