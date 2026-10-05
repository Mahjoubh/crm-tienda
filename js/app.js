// CRM + Tienda Online - Lógica principal
import { supabase } from './supabase-config.js';

class CRMApp {
    constructor() {
        this.dashboardHTML = document.querySelector('.content').innerHTML;
        this.init();
    }

    async init() {
        this.setupNavigation();
        this.setupMenuToggle();
        await this.checkAuth();
        console.log('🚀 CRM + Tienda Online iniciado');
    }

    setupNavigation() {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                links.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                document.getElementById('page-title').textContent = link.textContent.trim();
                this.loadPage(link.getAttribute('href').substring(1));
            });
        });
    }

    setupMenuToggle() {
        const menuToggle = document.querySelector('.menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
        }
    }

    async loadPage(pageId) {
        switch (pageId) {
            case 'dashboard':
                document.querySelector('.content').innerHTML = this.dashboardHTML;
                break;
            case 'tickets':
                await this.loadTickets();
                break;
            default:
                document.querySelector('.content').innerHTML = '<div class="card"><div class="card-body"><p>🚧 Sección en construcción.</p></div></div>';
        }
    }

    async checkAuth() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const userMenu = document.querySelector('.user-menu span');
                if (userMenu) userMenu.textContent = user.email.split('@')[0];
            }
        } catch (e) {
            console.log('Sin autenticación');
        }
    }

    // ================= PÁGINA DE TICKETS =================
    async loadTickets() {
        const content = document.querySelector('.content');
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-ticket-alt"></i> Gestión de Tickets</h3>
                    <button class="btn btn-primary" id="btn-new-ticket"><i class="fas fa-plus"></i> Nuevo Ticket</button>
                </div>
                <div class="card-body">
                    <div id="tickets-container"><p>Cargando tickets...</p></div>
                </div>
            </div>

            <div class="modal-overlay" id="ticket-modal">
                <div class="modal">
                    <h3>Nuevo Ticket</h3>
                    <form id="ticket-form">
                        <label>Cliente</label>
                        <select id="ticket-contact" required><option value="">Cargando...</option></select>
                        <label>Asunto</label>
                        <input type="text" id="ticket-subject" required placeholder="Resumen del problema">
                        <label>Descripción</label>
                        <textarea id="ticket-description" rows="3" placeholder="Detalles (opcional)"></textarea>
                        <label>Prioridad</label>
                        <select id="ticket-priority">
                            <option value="low">Baja</option>
                            <option value="medium" selected>Media</option>
                            <option value="high">Alta</option>
                        </select>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="btn-cancel">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Ticket</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        this.renderTickets();
        this.loadContactOptions();
        this.setupTicketEvents();
    }

    // Mostrar tabla de tickets con datos reales
    async renderTickets() {
        const container = document.getElementById('tickets-container');
        const { data, error } = await supabase
            .from('tickets')
            .select('*, contacts(name, email)')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>';
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = '<p>No hay tickets. Crea el primero con "Nuevo Ticket".</p>';
            return;
        }

        const statusLabels = { open: 'Abierto', in_progress: 'En Progreso', resolved: 'Resuelto', closed: 'Cerrado' };
        const priorityLabels = { low: 'Baja', medium: 'Media', high: 'Alta' };

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Asunto</th>
                        <th>Cliente</th>
                        <th>Prioridad</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(t => `
                        <tr>
                            <td><strong>${t.subject}</strong></td>
                            <td>${t.contacts ? t.contacts.name : '—'}</td>
                            <td><span class="badge priority-${t.priority}">${priorityLabels[t.priority] || t.priority}</span></td>
                            <td>
                                <select class="status-select" data-id="${t.id}">
                                    ${Object.keys(statusLabels).map(s =>
                                        `<option value="${s}" ${s === t.status ? 'selected' : ''}>${statusLabels[s]}</option>`
                                    ).join('')}
                                </select>
                            </td>
                            <td>${this.formatDate(t.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Cambiar estado desde el desplegable
        container.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const { error } = await supabase
                    .from('tickets')
                    .update({ status: e.target.value })
                    .eq('id', e.target.dataset.id);
                if (error) alert('Error al actualizar: ' + error.message);
            });
        });
    }

    // Cargar clientes en el formulario
    async loadContactOptions() {
        const select = document.getElementById('ticket-contact');
        const { data } = await supabase.from('contacts').select('id, name').order('name');
        if (data) {
            select.innerHTML = '<option value="">-- Selecciona cliente --</option>' +
                data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    }

    // Botones del formulario
    setupTicketEvents() {
        const modal = document.getElementById('ticket-modal');

        document.getElementById('btn-new-ticket').addEventListener('click', () => {
            modal.style.display = 'flex';
        });

        document.getElementById('btn-cancel').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('ticket-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { error } = await supabase.from('tickets').insert([{
                contact_id: document.getElementById('ticket-contact').value,
                subject: document.getElementById('ticket-subject').value,
                description: document.getElementById('ticket-description').value,
                priority: document.getElementById('ticket-priority').value,
                status: 'open'
            }]);

            if (error) {
                alert('❌ Error al crear: ' + error.message);
            } else {
                modal.style.display = 'none';
                e.target.reset();
                this.renderTickets();
            }
        });
    }

    // Utilidades
    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
    }
}

new CRMApp();
