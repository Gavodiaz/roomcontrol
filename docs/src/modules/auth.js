// 📄 src/modules/auth.js
import { supabaseClient } from './supabase.js';

/**
 * Intenta iniciar sesión con correo y contraseña en Supabase Auth
 */
export async function iniciarSesion(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        throw error; 
    }

    return data; 
}

/**
 * 📝 NUEVA FUNCIÓN: Registra un nuevo Docente y actualiza su Nombre Completo
 * @param {string} email 
 * @param {string} password 
 * @param {string} nombre 
 */
export async function registrarDocente(email, password, nombre) {
    // 1. Registramos el usuario en la capa segura de Auth
    const { data, error: authError } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
    });

    if (authError) throw authError;

    // 2. Si el usuario se creó bien, actualizamos el nombre en tu tabla pública 'usuarios'
    // El trigger que metimos en la base de datos ya creó la fila en milisegundos usando el id.
    if (data?.user) {
        const { error: updateError } = await supabaseClient
            .from('usuarios')
            .update({ nombre_completo: nombre })
            .eq('user_id', data.user.id);

        if (updateError) {
            console.error("⚠️ Error al actualizar el nombre completo en la tabla:", updateError.message);
            // No tiramos el error con 'throw' acá porque el usuario en Auth ya fue creado con éxito,
            // pero lo dejamos asentado en la consola por las dudas.
        }
    }

    return data;
}

/**
 * Cierra la sesión activa del usuario
 */
export async function cerrarSesion() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    window.location.href = 'login.html'; 
}

/**
 * Verifica si hay un usuario logueado.
 */
export async function protegerRuta() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
    }
}