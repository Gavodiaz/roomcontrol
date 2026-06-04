// app.js
import {
    renderDocentes,
    renderEquipos,
    renderTablaPrestamos,
    renderHistorialDiario,
    abrirModal,
    cerrarModal,
    renderHistorialEnModal,
    renderTablaProfesores,
    mostrarNotificacion,
    renderRegistrosEnLateral,
    renderReservasEnLateral
} from './modules/ui.js';
import {
    insertarPrestamoCabecera,
    insertarPrestamoDetalle,
    actualizarEstadoEquipo,
    registrarFechaDevolucion,
    getDetallesDePrestamo,
    devolverEquipoIndividual,
    agregarEquipoAlDetalle,
    getPrestamosPorFecha,
    getRegistrosDelDia,
    getUsuarios,
    insertUsuario,
    updateUsuario,
    deleteUsuario,
    getReservasDelDia
} from './modules/api.js';




// 📄 src/app.js (Líneas superiores)
import { supabaseClient } from './modules/supabase.js'; // Tu cliente clásico que ya funciona
import { cerrarSesion } from './modules/auth.js'; // Importamos la función de salida

// 🚀 Función para controlar la sesión al cargar el index
// 📄 src/app.js
async function controlarSesion() {
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();

    if (authError || !session) {
        window.location.href = './login.html'; // 👈 Asegurás el rebote correcto en GitHub Pages
        return;
    }

    try {
        // 🎯 Buscamos en tu tabla por la nueva columna compañera 'user_id'
        const { data: usuarioDb, error: dbError } = await supabaseClient
            .from('usuarios')
            .select('nombre_completo') // Nombre exacto de tu columna
            .eq('user_id', session.user.id) // 👈 Filtra comparando tu UID con la columna nueva
            .single();

        if (usuarioDb && usuarioDb.nombre_completo) {
            document.getElementById('user-display-email').textContent = `👤 ${usuarioDb.nombre_completo}`;
        } else {
            document.getElementById('user-display-email').textContent = `👤 ${session.user.email}`;
        }

    } catch (err) {
        console.error("Error al traer el nombre desde la tabla usuarios:", err);
        document.getElementById('user-display-email').textContent = `👤 ${session.user.email}`;
    }
}

// Ejecutamos el control apenas arranca la página
controlarSesion();

// 🛑 Configuración del botón de Cerrar Sesión
document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm("¿Estás seguro de que querés cerrar sesión?")) {
        try {
            await cerrarSesion(); // Llama a tu función original que hace el signOut() y redirige
        } catch (error) {
            console.error("Error al cerrar sesión:", error.message);
            // Por si las moscas falla la red, forzamos la salida igual
            window.location.href = 'login.html';
        }
    }
});



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


//Esto permite que las pestañas se queden fija o moviles
// Asegurate de seleccionar el contenedor principal que tiene la clase .sidebar-flotante
const panelEquipos = document.querySelector('.sidebar-flotante'); 
const btnFijar = document.getElementById('btn-fijar'); 

btnFijar.addEventListener('click', () => {
    // Alternamos la clase 'fija'
    panelEquipos.classList.toggle('fija');
    
    // Cambiamos el texto del botón (opcional)
    btnFijar.textContent = panelEquipos.classList.contains('fija') ? '❌' : '📌';
});


const panelRegistrosDiarios = document.querySelector('.sidebar-flotante-izq'); 
const btnFijarDiarios = document.getElementById('btn-fijar-registro'); 

btnFijarDiarios.addEventListener('click', () => {
    // Alternamos la clase 'fija'
    panelRegistrosDiarios.classList.toggle('fija');
    
    // Cambiamos el texto del botón (opcional)
    btnFijarDiarios.textContent = panelRegistrosDiarios.classList.contains('fija') ? '❌' : '📌';
});

const panelReservas = document.getElementById('sidebar-reservas-diarias');
const btnFijarReservas = document.getElementById('btn-fijar-reserva'); 

btnFijarReservas.addEventListener('click', () => {
    // Alternamos la clase 'fija'
    panelReservas.classList.toggle('fija');
    
    // Cambiamos el texto del botón (opcional)
    btnFijarReservas.textContent = panelReservas.classList.contains('fija') ? '❌' : '📌';
});




// 🎯 AUTOMATIZACIÓN: Al elegir docente de la lista, abrir modal de equipos
    const inputBuscarDocente = document.getElementById('docente');

    if (inputBuscarDocente) {
        inputBuscarDocente.addEventListener('input', (e) => {
            const valorInput = e.target.value.trim();

            // 1. Buscamos todas las opciones en el datalist
            const opcionesDatalist = document.querySelectorAll('#lista-docentes option');
            let docenteValidoElegido = false;

            opcionesDatalist.forEach(option => {
                if (option.value === valorInput) {
                    docenteValidoElegido = true;
                }
            });

            // 2. Si coincide con un docente real, disparamos el modal automático
            if (docenteValidoElegido) {
                console.log("🚀 Docente válido seleccionado:", valorInput);
                
                // Usamos el ID real de tu línea 101
                const botonEquipos = document.getElementById('btn-abrir-modal');
                if (botonEquipos) {
                    botonEquipos.click(); // 🔥 Simula el clic y abre el panel de netbooks
                }
            }

            
        });
    }

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

    if (!appState.idsSeleccionados || appState.idsSeleccionados.length === 0) {
        // 🎯 Agregamos 'error' al final para que pinte rojo
        mostrarNotificacion("❌ Por favor, selecciona al menos un equipo antes de confirmar.", 'error');
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
            mostrarNotificacion("✅ ¡Equipo(s) agregado(s) con éxito al lote!");
            

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


    // 1. Cerrás tu modal de forma visual (esto ya lo tenés en tu código)
    cerrarModal();

    // 🔥 AUTOMATIZACIÓN: Foco y despliegue automático del datalist de cursos
    const inputCurso = document.getElementById('observaciones'); // 👈 ID real de tu HTML
    
    if (inputCurso) {
        setTimeout(() => {
            inputCurso.focus(); // Le da el foco a la caja de texto
            
            // Forzamos un valor vacío temporal para que el navegador 
            // despliegue la persiana completa con las opciones (1°1°, 1°2°...)
            const valorOriginal = inputCurso.value;
            inputCurso.value = ''; 
            inputCurso.value = valorOriginal;

            // Compatibilidad moderna: si el navegador soporta showPicker en inputs, lo ejecuta
            if (typeof inputCurso.showPicker === 'function') {
                try {
                    inputCurso.showPicker();
                } catch (err) {
                    console.log("showPicker no requerido o no soportado en este elemento");
                }
            }
        }, 100); // Un mini delay de 100ms para esperar que el modal termine de ocultarse
    }

});

// 3. EVENTO PARA GUARDAR EL PRÉSTAMO (Clic en Registrar)

const btnRegistrar = document.getElementById('btn-registrar-prestamo');

if (btnRegistrar) {
    btnRegistrar.addEventListener('click', async () => {

        const inputDocente = document.getElementById('docente');
        const datalistProfes = document.getElementById('lista-docentes');
        let usuarioId = null;

        if (inputDocente && datalistProfes) {
            const valorEscrito = inputDocente.value.trim().toLowerCase();
            const opciones = datalistProfes.options;

            for (let i = 0; i < opciones.length; i++) {
                if (opciones[i].value.trim().toLowerCase() === valorEscrito) {
                    usuarioId = opciones[i].dataset.id;
                    break;
                }
            }
        }

        const inputEquiposOculto = document.getElementById('input-equipo-oculto');
        const inputObservaciones = document.getElementById('observaciones');
       
        

        const equiposTexto = inputEquiposOculto ? inputEquiposOculto.value : '';
        const observaciones = inputObservaciones ? inputObservaciones.value.trim() : '';

        // =========================================================================
        // 🎯 CONTROL DE SEGURIDAD 1: EL DOCENTE
        // =========================================================================
        if (!usuarioId) {
            mostrarNotificacion("❌ Por favor, seleccione un docente válido de la lista antes de confirmar.", 'error');
            return;
        }

        // =========================================================================
        // 🎯 CONTROL DE SEGURIDAD 2: LOS EQUIPOS
        // =========================================================================
        if (!equiposTexto) {
            mostrarNotificacion("❌ Por favor, seleccione al menos un equipo antes de confirmar.", 'error');
            return;
        }

        // =========================================================================
        // 🎯 CONTROL DE SEGURIDAD 3: EL CURSO (¡Acá va el bloque nuevo!)
        // =========================================================================
        const datalistCursos = document.getElementById('lista-cursos');
        let cursoValido = false;

        if (datalistCursos && observaciones) {
            const opcionesCursos = datalistCursos.options;
            for (let i = 0; i < opcionesCursos.length; i++) {
                if (opcionesCursos[i].value.toLowerCase() === observaciones.toLowerCase()) {
                    cursoValido = true;
                    break;
                }
            }
        }

        if (!cursoValido) {
            mostrarNotificacion("❌ Por favor, seleccione un curso válido de la lista desplegable.", 'error');
            return; // Frena acá si el curso no es correcto
        }
        const arrayEquiposIds = equiposTexto.split(',');

        try {
            const primerEquipoId = parseInt(arrayEquiposIds[0]);

            // PASO 1: Insertar la Cabecera del préstamo
            const prestamoId = await insertarPrestamoCabecera(usuarioId, primerEquipoId, observaciones);

            // PASO 2: Insertar cada equipo en el Detalle y cambiarle el estado
            for (const equipoIdStr of arrayEquiposIds) {
                const equipoIdNum = parseInt(equipoIdStr);
                await insertarPrestamoDetalle(prestamoId, equipoIdNum);
                await actualizarEstadoEquipo(equipoIdNum, 'Prestado');
                await renderTablaPrestamos();
            }

            // =========================================================================
            // 🎉 AVISO DE ÉXITO Y LIMPIEZA TOTAL (INCLUYENDO MODAL)
            // =========================================================================

            // 1. Avisamos que se guardó todo joya
            mostrarNotificacion("✅ ¡Préstamo registrado con éxito!");

            // 2. Limpiamos los campos visuales del formulario principal
            if (inputDocente) inputDocente.value = '';
            if (inputObservaciones) inputObservaciones.value = '';
            if (inputEquiposOculto) inputEquiposOculto.value = '';

            // 3. Restauramos el texto del botón azul largo
            const botonEquipos = document.getElementById('btn-abrir-modal'); //
            if (botonEquipos) {
                botonEquipos.textContent = "Cambiar / Seleccionar Equipo"; //
            }

            // 🎯 4. ¡LO NUEVO!: Limpiamos la memoria del Modal para el próximo préstamo
            appState.idsSeleccionados = [];
            appState.nombresSeleccionados = [];

            // 🔄 5. Refrescamos la tabla de abajo y RE-RENDERIZAMOS los botones del modal
            await renderTablaPrestamos(); // Actualiza la grilla "Equipos en Uso"

            if (typeof renderEquipos === 'function') {
                await renderEquipos(appState); // 💥 Esto vuelve a pintar las netbooks en el modal con sus estados reales actuales
            }

        } catch (error) {
            
            alert("❌ Hubo un error al registrar el préstamo en la base de datos.");
        }
    });
}


// 4. ESCUCHADOR DE DEVOLUCIONES (Captura el clic en los botones de la tabla)
document.getElementById('tabla-prestamos').addEventListener('click', async (e) => {

    // A) CASO: Devolver UN solo equipo (Botón nuevo)
    if (e.target && e.target.classList.contains('btn-devolver-uno')) {
        const pId = e.target.getAttribute('data-prestamo');
        const eId = e.target.getAttribute('data-equipo');

        if (confirm("¿Seguro querés devolver esta máquina específica?")) {
            try {
                await devolverEquipoIndividual(pId, eId);
                mostrarNotificacion("✅ Equipo devuelto al inventario");
                await renderEquipos(appState);
                await renderTablaPrestamos();
            } catch (err) {
                console.error("Error al devolver individual:", err);
                mostrarNotificacion("No se pudo procesar la devolución!!!");
            }
        }
        return; // IMPORTANTE: Cortamos acá para que no siga al otro botón
    }

    // B) CASO: Devolver TODO el lote (Botón viejo)
    if (e.target && e.target.classList.contains('btn-devolver')) {
        const idPrestamo = e.target.getAttribute('data-id');

        if (confirm("¿Seguro querés cerrar todo el préstamo y devolver todas las máquinas?")) {
            try {
                const detalles = await getDetallesDePrestamo(idPrestamo);
                await registrarFechaDevolucion(idPrestamo);

                if (detalles && detalles.length > 0) {
                    for (const d of detalles) {
                        await actualizarEstadoEquipo(d.equipo_id, 'Disponible');
                    }
                }
                mostrarNotificacion("✅ ¡Lote de equipos devuelto y disponible!");
                
                await renderEquipos(appState);
                await renderTablaPrestamos();
            } catch (err) {
                
                mostrarNotificacion("✅ ¡Préstamo registrado con éxito!");
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
// document.getElementById('btn-ver-registros').addEventListener('click', async () => {
//     const seccionDiaria = document.getElementById('seccion-registros-diarios');
//     if (!seccionDiaria) return;

//     if (!seccionDiaria.classList.contains('oculto')) {
//         seccionDiaria.classList.add('oculto');
//         return;
//     }

//     seccionDiaria.classList.remove('oculto');
//     await renderHistorialDiario();
// });


// // CONTROL DEL MODAL DE HISTORIAL DIARIO
// const modalHistorial = document.getElementById('modal-historial');
// const inputFecha = document.getElementById('fecha-busqueda');

// // 1. Abrir el modal al hacer clic en Registros Diarios
// document.getElementById('btn-ver-registros').addEventListener('click', async () => {
//     // Ponemos por defecto la fecha de hoy en el calendario (formato YYYY-MM-DD)
//     if (!inputFecha.value) {
//         const hoy = new Date().toISOString().split('T')[0];
//         inputFecha.value = hoy;
//     }

//     // Mostramos el modal usando Flexbox para centrarlo
//     modalHistorial.style.display = 'flex';

//     // Cargamos los datos del día
//     await cargarHistorialPorFecha(inputFecha.value);
// });

// // 2. Escuchar cuando el preceptor cambia la fecha en el calendario
// inputFecha.addEventListener('change', async (e) => {
//     await cargarHistorialPorFecha(e.target.value);
// });

// // 3. Cerrar el modal al tocar la "X"
// document.getElementById('btn-cerrar-historial').addEventListener('click', () => {
//     modalHistorial.style.display = 'none';
// });

// // Función interna auxiliar para coordinar la búsqueda y el dibujado
// async function cargarHistorialPorFecha(fecha) {
//     const registros = await getPrestamosPorFecha(fecha);
//     renderHistorialEnModal(registros);
// }





// =========================================================================
// LÓGICA PARA EL ABM DE PROFESORES
// =========================================================================

// 1. Captura de Elementos del DOM
const modalProfes = document.getElementById('modal-profesores');
const btnGestionarProfes = document.getElementById('btn-gestionar-profes');
const btnCloseModalProfes = document.getElementById('close-modal-profes');
const formProfesor = document.getElementById('form-profesor');
const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');

const inputProfeId = document.getElementById('profe-id');
const inputProfeNombre = document.getElementById('profe-nombre');
const inputProfeEmail = document.getElementById('profe-email');
const inputProfeDni = document.getElementById('profe-dni');
const inputProfeCelular = document.getElementById('profe-celular');
const formTituloProfe = document.getElementById('form-titulo-profe');

// 2. Función auxiliar para recargar la lista y refrescar la tabla
async function cargarYMostrarProfesores() {
    const profesores = await getUsuarios();
    renderTablaProfesores(profesores);
}

// 3. Abrir el Modal al hacer clic en "Gestionar Profesores"
if (btnGestionarProfes) {
    btnGestionarProfes.addEventListener('click', () => {
        modalProfes.style.display = 'block';
        resetearFormularioProfe();
        cargarYMostrarProfesores(); // Trae los profes frescos de Supabase
    });
}

// 4. Cerrar el Modal
if (btnCloseModalProfes) {
    btnCloseModalProfes.addEventListener('click', () => {
        modalProfes.style.display = 'none';
    });
}

// 5. Escuchar el envío del Formulario (Alta o Modificación)
if (formProfesor) {
    formProfesor.addEventListener('submit', async (e) => {
        e.preventDefault(); // Evita que la página se recargue

        const idActual = inputProfeId.value;
        const datosProfe = {
            nombre_completo: inputProfeNombre.value.trim(),
            email: inputProfeEmail.value.trim() || null,
            dni: inputProfeDni.value.trim() || null,
            celular: inputProfeCelular.value.trim() || null
        };

        try {
            if (idActual) {
                // ✏️ MODO MODIFICACIÓN: Si el ID oculto tiene valor, actualizamos
                await updateUsuario(idActual, datosProfe);
                mostrarNotificacion("✅ ¡Profesor actualizado con éxito!");
                
            } else {
                // ➕ MODO ALTA: Si no hay ID, es un profesor nuevo
                await insertUsuario(datosProfe);
                mostrarNotificacion("✅ ¡Profesor registrado con éxito!");
                
            }

            resetearFormularioProfe();
            await cargarYMostrarProfesores(); // Recarga la tabla con los cambios

            // Opcional: Si en tu pantalla principal tenés un select de profesores para los préstamos,
            // acá podrías llamar a la función que lo llena para que aparezca el nuevo profe al instante.

        } catch (error) {
            mostrarNotificacion("❌ Por favor, seleccione un curso válido de la lista desplegable.", 'error');
            
            console.error(error);
        }
    });
}

// 6. Escuchar los clics de la Tabla (Editar y Borrar usando Delegación de Eventos)
const cuerpoTablaProfes = document.getElementById('tabla-profesores-cuerpo');
if (cuerpoTablaProfes) {
    cuerpoTablaProfes.addEventListener('click', async (e) => {

        // BOTÓN EDITAR ✏️
        const btnEditar = e.target.closest('.btn-editar-profe');
        if (btnEditar) {
            // Pasamos los atributos 'data-' del botón al formulario arriba
            inputProfeId.value = btnEditar.dataset.id;
            inputProfeNombre.value = btnEditar.dataset.nombre;
            inputProfeEmail.value = btnEditar.dataset.email;
            inputProfeDni.value = btnEditar.dataset.dni;
            inputProfeCelular.value = btnEditar.dataset.celular;

            // Cambiamos el aspecto del formulario para avisar que estamos editando
            formTituloProfe.textContent = "Modificar Datos del Profesor";
            btnCancelarEdicion.style.display = 'inline-block';
            inputProfeNombre.focus();
        }

        // BOTÓN BORRAR 🗑️
        const btnBorrar = e.target.closest('.btn-borrar-profe');
        if (btnBorrar) {
            const id = btnBorrar.dataset.id;
            const nombre = btnBorrar.dataset.nombre;

            // Confirmación de seguridad
            const confirmar = confirm(`¿Estás seguro de que querés eliminar al ${nombre} de la base de datos?`);
            if (confirmar) {
                try {
                    await deleteUsuario(id);
                    alert("Profesor eliminado correctamente.");
                    await cargarYMostrarProfesores(); // Refrescamos la tabla
                } catch (error) {
                    alert("No se pudo eliminar al profesor. Comprobá que no tenga préstamos asociados.");
                    console.error(error);
                }
            }
        }
    });
}

// 7. Botón Cancelar Edición
if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener('click', () => {
        resetearFormularioProfe();
    });
}

// 8. Función para limpiar el formulario y volver a modo Alta
function resetearFormularioProfe() {
    formProfesor.reset();
    inputProfeId.value = '';
    formTituloProfe.textContent = "Registrar Nuevo Profesor";
    btnCancelarEdicion.style.display = 'none';
}

// =========================================================================
// LÓGICA PARA LAS RESERVAS
// =========================================================================
//Botón llamar a las reservas
document.getElementById('btn-ir-reservas').addEventListener('click', () => {
    window.location.href = 'reservas.html';
});


const inputDocente = document.getElementById('docente');
const btnLimpiarDocente = document.getElementById('btn-limpiar-busqueda');

if (btnLimpiarDocente && inputDocente) {
    btnLimpiarDocente.addEventListener('click', () => {
        inputDocente.value = ''; // Borra el texto escrito
        
        // 🔥 Limpiamos también el input de los cursos
        const inputCurso = document.getElementById('observaciones');
        if (inputCurso) {
            inputCurso.value = '';
        }

        // 🎯 FOCUS CORRECTO: Buscamos el botón de confirmación mediante su ID real para que no tire error
        // Cambiá 'btn-registrar-prestamo' por el ID real que tenga en tu HTML si es que difiere
        const btnConfirmar = document.getElementById('btn-registrar-prestamo') 
                        

        if (btnConfirmar) {
           btnConfirmar.focus({ preventScroll: true }); // 👈 Le agregamos esto adentro
    console.log("💥 Foco enviado sin mover la pantalla");
        }

        console.log("🧹 Formulario limpio y foco en Confirmar");
    });
}


// Listener: Carga y renderiza los movimientos del día en la barra lateral
const sidebarIzquierda = document.getElementById('sidebar-registros-diarios');

if (sidebarIzquierda) {
    sidebarIzquierda.addEventListener('mouseenter', async () => {
        try {
            const hoy = new Date().toLocaleDateString('sv');
            const registros = await getRegistrosDelDia(hoy); // 1. Traigo datos
            renderRegistrosEnLateral(registros);            // 2. Pinto
            console.log("✨ Renderizado con éxito");
        } catch (error) {
            console.error("Error:", error);
        }
    });
}


// =========================================================================
// 📅 CONSULTA: Llena la pestaña de Reservas Diarias
// =========================================================================

const sidebarReservas = document.getElementById('sidebar-reservas-diarias');

if (sidebarReservas) {
    sidebarReservas.addEventListener('mouseenter', async () => {
        const hoy = new Date().toLocaleDateString('sv');
        const reservas = await getReservasDelDia(hoy); // Asegurate que esta función exista en api.js
        renderReservasEnLateral(reservas); 
    });
}