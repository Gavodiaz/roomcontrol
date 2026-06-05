


// 📄 src/reservas.js
import { obtenerDisponibilidadEquipos, 
    guardarReservaMasiva, 
    getDocentes, 
    getReservasDelMes,
    eliminarReservasMasivas } from './modules/api.js';
import { renderDocentes } from './modules/ui.js';

const appState = {
    idsSeleccionados: [],
    nombresSeleccionados: []
};

document.addEventListener('DOMContentLoaded', async () => {
    

    const inputFecha = document.getElementById('input-fecha');
    const formReservas = document.getElementById('form-reservas');
    
    const btnAbrirModal = document.getElementById('btn-abrir-modal');
    const modalEquipos = document.getElementById('modal-equipos');
    const contenedorEquipos = document.getElementById('contenedor-equipos');
    const btnConfirmarModal = document.getElementById('btn-confirmar-seleccion-modal');

    if (inputFecha) inputFecha.value = ""; 
    if (btnAbrirModal) btnAbrirModal.disabled = true;

    // A: Cargar los docentes
// 2. Esta función es la que realmente va a pintar los datos en tu sidebar
// 2. Esta función es la que realmente va a pintar los datos en tu sidebar
async function renderizarHistorial() {
    const tbody = document.getElementById('tabla-historial-body'); // Asegurate que este ID exista en tu HTML
    if (!tbody) {
        console.warn("No se encuentra el elemento con ID 'tabla-historial-body'");
        return;
    }

    try {
        const reservas = await getReservasDelMes();
        
        const reservasAgrupadas = reservas.reduce((acc, r) => {
            const nombreDocente = r.docentes?.nombre_completo || 'Sin nombre';
            const nombreEquipo = r.equipos?.nombre || 'ID: ' + r.equipo_id;
            const fecha = r.fecha_reserva;

            if (!acc[nombreDocente]) {
                acc[nombreDocente] = { equipos: new Set(), fecha: fecha, ids: [] };
            }
            acc[nombreDocente].equipos.add(nombreEquipo);
            acc[nombreDocente].ids.push(r.id); 
            return acc;
        }, {});

        // --- PINTAMOS LA TABLA AGRUPADA ---
        tbody.innerHTML = '';
        Object.keys(reservasAgrupadas).forEach(docente => {
            const datos = reservasAgrupadas[docente];
            const listaEquipos = Array.from(datos.equipos).join(', '); 
            const cadenaIds = datos.ids.join(','); 

            tbody.innerHTML += `
                <tr>
                    <td style="padding: 10px;">${docente}</td>
                    <td style="padding: 10px;">${listaEquipos}</td>
                    <td style="padding: 10px;">${datos.fecha}</td>
                    <td style="padding: 10px; text-align: center;">
                        <button class="btn-cancelar" data-ids="${cadenaIds}" style="background:none; border:none; cursor:pointer;">
                            ❌
                        </button>
                    </td>
                </tr>`;
        });

        // =========================================================
        // 🎯 EL ESCUCHADOR VA ACÁ (Justo antes de terminar el try)
        // =========================================================
        tbody.onclick = async (e) => {
            const boton = e.target.closest('.btn-cancelar');
            if (!boton) return; 

            const idsTexto = boton.dataset.ids; 
            const idsArray = idsTexto.split(',').map(id => parseInt(id));

            const seguro = confirm(`¿Estás seguro de que deseas cancelar estas reservas agrupadas?`);
            if (!seguro) return;

            try {
                await eliminarReservasMasivas(idsArray);
                alert("¡Reservas canceladas con éxito!");
                await renderizarHistorial(); // Recarga la tabla automáticamente
            } catch (error) {
                console.error("Error al intentar cancelar:", error);
                alert("Hubo un error al intentar cancelar las reservas.");
            }
        };

    } catch (err) {
        console.error("Error al cargar el historial:", err);
    }
}



// Funcion que carga los docentes en el text de docentes
window.onload = async () => {
    console.log("Página cargada al 100%, intentando traer docentes...");
    
    try {
        const docentes = await getDocentes();
        console.log("Docentes recibidos:", docentes);
        
        if (docentes && docentes.length > 0) {
            await renderDocentes(); // Llamamos a la función
            console.log("renderDocentes ejecutado.");
        } else {
            console.warn("La lista de docentes está vacía.");
        }
    } catch (error) {
        console.error("Error fatal al cargar:", error);
    }
};

// LLAMADA AL HISTORIAL
    await renderizarHistorial();

    // 🔒 FUNCIÓN CLAVE: Valida si habilitar o no el botón azul del modal
    function validarRequisitosModal() {
        if (!inputFecha || !btnAbrirModal) return;
        
        const fechaElegida = inputFecha.value;
        // Buscamos cuántos checkboxes de hora están tildados
        const horasTildadas = document.querySelectorAll('input[name="hora"]:checked');

        // Se habilita SOLO si hay fecha Y al menos una hora seleccionada
        btnAbrirModal.disabled = !(fechaElegida && horasTildadas.length > 0);
    }

    // Helper para obtener un array simple con las horas seleccionadas [1, 2, 3]
    function obtenerHorasSeleccionadas() {
        const checkboxes = document.querySelectorAll('input[name="hora"]:checked');
        return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    // =========================================================
    // B: DIBUJAR LA INTERFAZ CON FITRO DE FECHA + HORAS
    // =========================================================
    async function renderEquiposReservas() {
    if (!contenedorEquipos || !inputFecha) return;

    const fechaSeleccionada = inputFecha.value;
    const horasSeleccionadas = obtenerHorasSeleccionadas();

    if (!fechaSeleccionada || horasSeleccionadas.length === 0) return;

    try {
        contenedorEquipos.innerHTML = '<p style="text-align:center; color:#64748b;">Consultando disponibilidad por horas...</p>';

        // Enviamos la fecha Y el array de horas a la API
        const listaEquipos = await obtenerDisponibilidadEquipos(fechaSeleccionada, horasSeleccionadas);

        contenedorEquipos.innerHTML = '';

        if (!listaEquipos || listaEquipos.length === 0) {
            contenedorEquipos.innerHTML = '<p style="text-align:center;">No hay equipos cargados en la base de datos.</p>';
            return;
        }

        listaEquipos.forEach(eq => {
            const btn = document.createElement('button');
            btn.textContent = eq.nombre;
            btn.type = "button";

            // 🔴 Si está ocupado en alguna de esas horas, se bloquea en rojo
            if (eq.ocupado) {
                btn.className = "btn-equipo prestado"; 
                btn.disabled = true;
            } 
            // 🟢 Si está libre todas esas horas, queda disponible
            else {
                const yaSeleccionado = appState.idsSeleccionados.includes(eq.id);
                btn.className = yaSeleccionado ? "btn-equipo disponible seleccionado" : "btn-equipo disponible";
                
                btn.addEventListener('click', () => {
                    if (btn.classList.contains('seleccionado')) {
                        btn.classList.remove('seleccionado');
                        appState.idsSeleccionados = appState.idsSeleccionados.filter(id => id !== eq.id);
                        appState.nombresSeleccionados = appState.nombresSeleccionados.filter(n => n !== eq.nombre);
                    } else {
                        btn.classList.add('seleccionado');
                        appState.idsSeleccionados.push(eq.id);
                        appState.nombresSeleccionados.push(eq.nombre);
                    }
                });
            }
            contenedorEquipos.appendChild(btn);
        });

    } catch (err) {
        console.error("Error renderizando el modal:", err);
        contenedorEquipos.innerHTML = `<p style="color:red; text-align:center;">Error al conectar con la API.</p>`;
    }
}

    // =========================================================
    // C: ESCUCHADORES DE EVENTOS
    // =========================================================
    
    // Escuchar el cambio de fecha
    if (inputFecha) {
        inputFecha.addEventListener('change', () => {
            validarRequisitosModal();
            resetearSeleccionEquipos();
        });
    }

    // Escuchar los clicks en los checkboxes de las horas cátedra
    const contenedorHoras = document.getElementById('contenedor-horas');
    if (contenedorHoras) {
        contenedorHoras.addEventListener('change', (e) => {
            if (e.target.name === 'hora') {
                validarRequisitosModal();
                resetearSeleccionEquipos(); // Si cambia la hora, hay que volver a elegir equipos
            }
        });
    }

    function resetearSeleccionEquipos() {
        appState.idsSeleccionados = [];
        appState.nombresSeleccionados = [];
        if (btnAbrirModal) {
            btnAbrirModal.textContent = "Seleccionar Equipos Masivos";
            btnAbrirModal.style.backgroundColor = '#2563eb';
        }
        if (modalEquipos && !modalEquipos.classList.contains('oculto')) {
            renderEquiposReservas();
        }
    }

    if (btnAbrirModal) {
        btnAbrirModal.addEventListener('click', () => {
            if (modalEquipos) {
                modalEquipos.classList.remove('oculto');
                renderEquiposReservas();
            }
        });
    }

    if (btnConfirmarModal) {
        btnConfirmarModal.addEventListener('click', () => {
            if (modalEquipos) {
                modalEquipos.classList.add('oculto');
                if (appState.idsSeleccionados.length > 0) {
                    btnAbrirModal.textContent = `🟢 ${appState.nombresSeleccionados.length} Equipos Seleccionados`;
                    btnAbrirModal.style.backgroundColor = '#10b981';
                } else {
                    btnAbrirModal.textContent = "Seleccionar Equipos Masivos";
                    btnAbrirModal.style.backgroundColor = '#2563eb';
                }
            }
        });
    }

    window.cerrarModal = function() {
        if (modalEquipos) modalEquipos.classList.add('oculto');
    };

    // =========================================================
    // D: ENVIAR RESERVA CON MULTIPLICACIÓN POR HORA CÁTEDRA
    // =========================================================
  
    if (formReservas) {
        formReservas.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Obtenemos los elementos
    const inputDocente = document.getElementById('docente');
    const datalistProfes = document.getElementById('lista-docentes'); // Asegurate que este ID coincida con tu HTML
    
    // 2. BUSCAMOS EL ID DIRECTAMENTE EN EL DATALIST
    let usuarioId = null;
    const valorEscrito = inputDocente.value.trim().toLowerCase();
    const opciones = datalistProfes.options;

    for (let i = 0; i < opciones.length; i++) {
        if (opciones[i].value.trim().toLowerCase() === valorEscrito) {
            usuarioId = opciones[i].dataset.id; // ¡Acá obtenés el ID real!
            break;
        }
    }

    // 3. Validación
    const fechaSelected = inputFecha.value;
    const horasSelected = obtenerHorasSeleccionadas();

    if (!usuarioId || appState.idsSeleccionados.length === 0 || horasSelected.length === 0) {
        alert("Por favor, selecciona un docente válido de la lista y completa los datos.");
        return;
    }

    // 4. Guardado
    try {
        const filasAInsertar = [];
        appState.idsSeleccionados.forEach(idEquipo => {
            horasSelected.forEach(hora => {
                filasAInsertar.push({
                    docente_id: parseInt(usuarioId), // Usamos el ID encontrado
                    equipo_id: idEquipo,
                    fecha_reserva: fechaSelected,
                    hora_catedra: hora,
                    estado: 'Confirmada'
                });
            });
        });

        await guardarReservaMasiva(filasAInsertar);
        alert("¡Reserva masiva completada!");

        await renderizarHistorial();

        formReservas.reset();
        
        // ... limpiar estados
    } catch (error) {
        console.error(error);
        alert("Error al guardar la reserva.");
    }
});
    }

    await cargarDocentes();
});