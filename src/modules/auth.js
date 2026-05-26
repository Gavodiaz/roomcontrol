// 📄 src/modules/auth.js
// Importamos el cliente de Supabase que ya tenés configurado en tu proyecto
import { supabaseClient } from './supabase.js';
/**
 * Intenta iniciar sesión con correo y contraseña en Supabase Auth
 * @param {string} email 
 * @param {string} password 
 */
export async function iniciarSesion(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        throw error; // Si las credenciales son malas, tira el error para atraparlo en la UI
    }

    return data; // Devuelve la información de la sesión si todo sale de diez
}

/**
 * Cierra la sesión activa del usuario
 */
export async function cerrarSesion() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    window.location.href = 'login.html'; // Al salir, lo mandamos al login de cabeza
}

/**
 * Verifica si hay un usuario logueado. 
 * Si no hay nadie, te expulsa al login de forma automática.
 */
export async function protegerRuta() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
    }
}