// Configuración de Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ⚠️ REEMPLAZA estos valores con los de tu proyecto Supabase
const SUPABASE_URL = 'https://aoxwjcfvraecybodyozm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MXbz03717bl2bbhD8MdGMQ_NawqGpvN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== FUNCIONES DE BASE DE DATOS =====

// Tickets
export async function getTickets() {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
    return { data, error };
}

export async function createTicket(ticket) {
    const { data, error } = await supabase
        .from('tickets')
        .insert([ticket])
        .select();
    return { data, error };
}

export async function updateTicket(id, updates) {
    const { data, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select();
    return { data, error };
}

// Contactos
export async function getContacts() {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');
    return { data, error };
}

export async function createContact(contact) {
    const { data, error } = await supabase
        .from('contacts')
        .insert([contact])
        .select();
    return { data, error };
}

// Productos
export async function getProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
    return { data, error };
}

// Pedidos
export async function getOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
    return { data, error };
}

export async function createOrder(order) {
    const { data, error } = await supabase
        .from('orders')
        .insert([order])
        .select();
    return { data, error };
}
