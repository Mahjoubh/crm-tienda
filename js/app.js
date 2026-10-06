import { supabase } from './supabase-config.js';

class CRMApp {
    constructor() {
        this.dashboardHTML = document.querySelector('.content').innerHTML;
        this.currentPage = 'dashboard';
        this.init();
    }

    async init() {
        this.setupNavigation();
        this.setupMenuToggle();
        this.setupGlobalSearch();
        await this.checkAuth();
        console.log(' CRM + Tienda Online iniciado');
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

    setupGlobalSearch() {
        const searchInput = document.getElementById('global-search');
        if (!searchInput) return;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length < 2) return;
            if (this.currentPage === 'contacts') this.searchContacts(query);
            if (this.currentPage === 'products') this.searchProducts(query);
            if (this.currentPage === 'tickets') this.searchTickets(query);
        });
    }

    async loadPage(pageId) {
        this.currentPage = pageId;
        switch (pageId) {
            case 'dashboard':
                document.querySelector('.content').innerHTML = this.dashboardHTML;
                this.loadDashboardReal();
                break;
            case 'tickets':
                await this.loadTickets();
                break;
            case 'contacts':
                await this.loadContacts();
                break;
            case 'products':
                await this.loadProducts();
                break;
            case 'orders':
                await this.loadOrders();
                break;
            case 'reports':
                await this.loadReports();
                break;
            case 'settings':
                await this.loadSettings();
                break;
            case 'logout':
                await supabase.auth.signOut();
                this.checkAuth();
                break;
            default:
                document.querySelector('.content').innerHTML = '<div class="card"><div class="card-body"><p>🚧 Sección en construcción.</p></div></div>';
        }
    }

    async checkAuth() {
        const loginOverlay = document.getElementById('login-overlay');
        const mainContent = document.querySelector('.main-content');
        const sidebar = document.querySelector('.sidebar');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                loginOverlay.classList.add('hidden');
                mainContent.style.display = '';
                sidebar.style.display = '';
                const userMenu = document.querySelector('.user-menu span');
                if (userMenu) userMenu.textContent = user.email.split('@')[0];
            } else {
                loginOverlay.classList.remove('hidden');
                mainContent.style.display = 'none';
                sidebar.style.display = 'none';
            }
        } catch (e) {
            loginOverlay.classList.remove('hidden');
            mainContent.style.display = 'none';
            sidebar.style.display = 'none';
        }
        this.setupLogin();
    }

    setupLogin() {
        const form = document.getElementById('login-form');
        const errorEl = document.getElementById('login-error');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            errorEl.textContent = 'Iniciando sesión...';
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) errorEl.textContent = '❌ Email o contraseña incorrectos';
            else { errorEl.textContent = ''; this.checkAuth(); }
        });
    }

    // ================= CONTACTOS =================
    async loadContacts() {
        const content = document.querySelector('.content');
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-address-book"></i> Gestión de Contactos</h3>
                    <button class="btn btn-primary" id="btn-new-contact"><i class="fas fa-plus"></i> Nuevo Cliente</button>
                </div>
                <div class="card-body">
                    <div id="contacts-container"><p>Cargando contactos...</p></div>
                </div>
            </div>
            <div class="modal-overlay" id="contact-modal">
                <div class="modal">
                    <h3 id="contact-modal-title">Nuevo Cliente</h3>
                    <form id="contact-form">
                        <input type="hidden" id="contact-id">
                        <label>Nombre completo</label>
                        <input type="text" id="contact-name" required placeholder="Ej: Ana García">
                        <label>Email</label>
                        <input type="email" id="contact-email" required placeholder="ana@empresa.com">
                        <label>Teléfono</label>
                        <input type="text" id="contact-phone" placeholder="+34 600 000 000">
                        <label>Empresa</label>
                        <input type="text" id="contact-company" placeholder="Nombre de la empresa">
                        <label>Ciudad</label>
                        <input type="text" id="contact-city" placeholder="Madrid">
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-contact">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Cliente</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        this.renderContacts();
        this.setupContactEvents();
    }

    async renderContacts(contacts = null) {
        const container = document.getElementById('contacts-container');
        const { data, error } = contacts ? { data: contacts, error: null } : await supabase.from('contacts').select('*').order('name');
        if (error) { container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>'; return; }
        if (!data || data.length === 0) { container.innerHTML = '<p>No hay contactos.</p>'; return; }

        const statusLabels = { active: 'Activo', lead: 'Lead', inactive: 'Inactivo' };
        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Empresa</th><th>Ciudad</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${data.map(c => `
                        <tr>
                            <td><strong>${c.name}</strong></td>
                            <td>${c.email}</td>
                            <td>${c.phone || '—'}</td>
                            <td>${c.company || '—'}</td>
                            <td>${c.city || '—'}</td>
                            <td><span class="badge contact-${c.status}">${statusLabels[c.status] || c.status}</span></td>
                            <td>
                                <button class="btn-edit" data-id="${c.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-delete" data-id="${c.id}"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => this.editContact(btn.dataset.id)));
        container.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => this.deleteContact(btn.dataset.id)));
    }

    async searchContacts(query) {
        const { data } = await supabase.from('contacts').select('*').ilike('name', `%${query}%`);
        this.renderContacts(data);
    }

    async editContact(id) {
        const { data } = await supabase.from('contacts').select('*').eq('id', id).single();
        if (!data) return;
        document.getElementById('contact-modal-title').textContent = 'Editar Cliente';
        document.getElementById('contact-id').value = data.id;
        document.getElementById('contact-name').value = data.name;
        document.getElementById('contact-email').value = data.email;
        document.getElementById('contact-phone').value = data.phone || '';
        document.getElementById('contact-company').value = data.company || '';
        document.getElementById('contact-city').value = data.city || '';
        document.getElementById('contact-modal').style.display = 'flex';
    }

    async deleteContact(id) {
        if (!confirm('¿Eliminar este cliente?')) return;
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else this.renderContacts();
    }

    setupContactEvents() {
        const modal = document.getElementById('contact-modal');
        document.getElementById('btn-new-contact').addEventListener('click', () => {
            document.getElementById('contact-modal-title').textContent = 'Nuevo Cliente';
            document.getElementById('contact-form').reset();
            document.getElementById('contact-id').value = '';
            modal.style.display = 'flex';
        });
        document.getElementById('btn-cancel-contact').addEventListener('click', () => modal.style.display = 'none');
        document.getElementById('contact-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('contact-id').value;
            const contactData = {
                name: document.getElementById('contact-name').value,
                email: document.getElementById('contact-email').value,
                phone: document.getElementById('contact-phone').value,
                company: document.getElementById('contact-company').value,
                city: document.getElementById('contact-city').value,
                status: 'active'
            };
            const { error } = id ? await supabase.from('contacts').update(contactData).eq('id', id) : await supabase.from('contacts').insert([contactData]);
            if (error) alert('❌ Error: ' + error.message);
            else { modal.style.display = 'none'; e.target.reset(); this.renderContacts(); }
        });
    }

    // ================= PRODUCTOS =================
    async loadProducts() {
        const content = document.querySelector('.content');
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-box"></i> Catálogo de Productos</h3>
                    <button class="btn btn-primary" id="btn-new-product"><i class="fas fa-plus"></i> Nuevo Producto</button>
                </div>
                <div class="card-body">
                    <div id="products-container"><p>Cargando productos...</p></div>
                </div>
            </div>
            <div class="modal-overlay" id="product-modal">
                <div class="modal">
                    <h3 id="product-modal-title">Nuevo Producto</h3>
                    <form id="product-form">
                        <input type="hidden" id="product-id">
                        <label>Imagen del producto</label>
                        <input type="file" id="product-image" accept="image/*">
                        <img id="product-image-preview" style="max-width:150px;margin-top:10px;display:none;border-radius:8px;">
                        <label>Nombre del producto</label>
                        <input type="text" id="product-name" required placeholder="Ej: Teclado inalámbrico">
                        <label>Descripción</label>
                        <textarea id="product-description" rows="2" placeholder="Descripción corta"></textarea>
                        <label>Precio (€)</label>
                        <input type="number" id="product-price" step="0.01" min="0" required placeholder="49.99">
                        <label>Stock</label>
                        <input type="number" id="product-stock" min="0" required placeholder="20">
                        <label>Categoría</label>
                        <input type="text" id="product-category" placeholder="Electrónica">
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-product">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Producto</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        this.renderProducts();
        this.setupProductEvents();
    }

    async renderProducts(products = null) {
        const container = document.getElementById('products-container');
        const { data, error } = products ? { data: products, error: null } : await supabase.from('products').select('*').order('name');
        if (error) { container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>'; return; }
        if (!data || data.length === 0) { container.innerHTML = '<p>No hay productos.</p>'; return; }

        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Imagen</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                                                    <td>${p.image_url ? `<img src="${p.image_url}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;">` : '—'}</td>
                            <td><strong>${p.name}</strong></td>
                            <td>${p.category || '—'}</td>
                            <td><strong>${this.formatCurrency(parseFloat(p.price))}</strong></td>
                            <td>${p.stock}</td>
                            <td><span class="badge ${this.stockBadge(p.stock)}">${this.stockLabel(p.stock)}</span></td>
                            <td>
                                <button class="btn-edit" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-delete" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => this.editProduct(btn.dataset.id)));
        container.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => this.deleteProduct(btn.dataset.id)));
    }

    async searchProducts(query) {
        const { data } = await supabase.from('products').select('*').ilike('name', `%${query}%`);
        this.renderProducts(data);
    }

    async editProduct(id) {
        const { data } = await supabase.from('products').select('*').eq('id', id).single();
        if (!data) return;
        document.getElementById('product-modal-title').textContent = 'Editar Producto';
        document.getElementById('product-id').value = data.id;
        document.getElementById('product-name').value = data.name;
        document.getElementById('product-description').value = data.description || '';
        document.getElementById('product-price').value = data.price;
        document.getElementById('product-stock').value = data.stock;
        document.getElementById('product-category').value = data.category || '';
        document.getElementById('product-modal').style.display = 'flex';
    }

    async deleteProduct(id) {
        if (!confirm('¿Eliminar este producto?')) return;
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else this.renderProducts();
    }

    setupProductEvents() {
        const modal = document.getElementById('product-modal');
        document.getElementById('btn-new-product').addEventListener('click', () => {
            document.getElementById('product-modal-title').textContent = 'Nuevo Producto';
            document.getElementById('product-form').reset();
            document.getElementById('product-id').value = '';
            modal.style.display = 'flex';
        });
        document.getElementById('btn-cancel-product').addEventListener('click', () => modal.style.display = 'none');
                // Preview de imagen al seleccionar
        document.getElementById('product-image').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.getElementById('product-image-preview');
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('product-id').value;
                        // Subir imagen si hay archivo
            const imageFile = document.getElementById('product-image').files[0];
            if (imageFile) {
                const fileName = `${Date.now()}-${imageFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, imageFile);
                
                if (uploadError) {
                    alert('Error al subir imagen: ' + uploadError.message);
                    return;
                }
                
                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);
                
                productData.image_url = publicUrl;
            }
            const id = document.getElementById('product-id').value;
            const { error } = id ? await supabase.from('products').update(productData).eq('id', id) : await supabase.from('products').insert([productData]);
            if (error) alert('❌ Error: ' + error.message);
            else { modal.style.display = 'none'; e.target.reset(); this.renderProducts(); }
        });
    }

    stockBadge(stock) { if (stock <= 0) return 'stock-out'; if (stock <= 10) return 'stock-low'; return 'stock-ok'; }
    stockLabel(stock) { if (stock <= 0) return 'Agotado'; if (stock <= 10) return 'Stock bajo'; return 'En stock'; }

    // ================= TICKETS =================
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
                    <h3 id="ticket-modal-title">Nuevo Ticket</h3>
                    <form id="ticket-form">
                        <input type="hidden" id="ticket-id">
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

    async renderTickets(tickets = null) {
        const container = document.getElementById('tickets-container');
        const { data, error } = tickets ? { data: tickets, error: null } : await supabase.from('tickets').select('*, contacts(name, email)').order('created_at', { ascending: false });
        if (error) { container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>'; return; }
        if (!data || data.length === 0) { container.innerHTML = '<p>No hay tickets.</p>'; return; }

        const statusLabels = { open: 'Abierto', in_progress: 'En Progreso', resolved: 'Resuelto', closed: 'Cerrado' };
        const priorityLabels = { low: 'Baja', medium: 'Media', high: 'Alta' };

        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Asunto</th><th>Cliente</th><th>Prioridad</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${data.map(t => `
                        <tr>
                            <td><strong>${t.subject}</strong></td>
                            <td>${t.contacts ? t.contacts.name : '—'}</td>
                            <td><span class="badge priority-${t.priority}">${priorityLabels[t.priority] || t.priority}</span></td>
                            <td>
                                <select class="status-select" data-id="${t.id}">
                                    ${Object.keys(statusLabels).map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
                                </select>
                            </td>
                            <td>${this.formatDate(t.created_at)}</td>
                            <td>
                                <button class="btn-chat" data-id="${t.id}"><i class="fas fa-comments"></i></button>
                                <button class="btn-edit" data-id="${t.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-delete" data-id="${t.id}"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const { error } = await supabase.from('tickets').update({ status: e.target.value }).eq('id', e.target.dataset.id);
                if (error) alert('Error: ' + error.message);
            });
        });
        container.querySelectorAll('.btn-chat').forEach(btn => btn.addEventListener('click', () => this.openTicketChat(btn.dataset.id)));
        container.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => this.editTicket(btn.dataset.id)));
        container.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => this.deleteTicket(btn.dataset.id)));
    }

    async searchTickets(query) {
        const { data } = await supabase.from('tickets').select('*, contacts(name, email)').ilike('subject', `%${query}%`);
        this.renderTickets(data);
    }

    async editTicket(id) {
        const { data } = await supabase.from('tickets').select('*').eq('id', id).single();
        if (!data) return;
        document.getElementById('ticket-modal-title').textContent = 'Editar Ticket';
        document.getElementById('ticket-id').value = data.id;
        document.getElementById('ticket-subject').value = data.subject;
        document.getElementById('ticket-description').value = data.description || '';
        document.getElementById('ticket-priority').value = data.priority;
        document.getElementById('ticket-modal').style.display = 'flex';
    }

    async deleteTicket(id) {
        if (!confirm('¿Eliminar este ticket?')) return;
        const { error } = await supabase.from('tickets').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else this.renderTickets();
    }

    async loadContactOptions() {
        const select = document.getElementById('ticket-contact');
        const { data } = await supabase.from('contacts').select('id, name').order('name');
        if (data) {
            select.innerHTML = '<option value="">-- Selecciona cliente --</option>' + data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    }

    setupTicketEvents() {
        const modal = document.getElementById('ticket-modal');
        document.getElementById('btn-new-ticket').addEventListener('click', () => {
            document.getElementById('ticket-modal-title').textContent = 'Nuevo Ticket';
            document.getElementById('ticket-form').reset();
            document.getElementById('ticket-id').value = '';
            modal.style.display = 'flex';
        });
        document.getElementById('btn-cancel').addEventListener('click', () => modal.style.display = 'none');
        document.getElementById('ticket-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('ticket-id').value;
            const ticketData = {
                contact_id: document.getElementById('ticket-contact').value,
                subject: document.getElementById('ticket-subject').value,
                description: document.getElementById('ticket-description').value,
                priority: document.getElementById('ticket-priority').value,
                status: 'open'
            };
            const { error } = id ? await supabase.from('tickets').update(ticketData).eq('id', id) : await supabase.from('tickets').insert([ticketData]);
            if (error) alert('❌ Error: ' + error.message);
            else { modal.style.display = 'none'; e.target.reset(); this.renderTickets(); }
        });
    }

    // ================= CHAT DE TICKETS =================
    async openTicketChat(ticketId) {
        const { data: ticket } = await supabase.from('tickets').select('subject, contacts(name)').eq('id', ticketId).single();
        const clientName = ticket?.contacts?.name || 'Cliente';

        const modalHTML = `
            <div class="modal-overlay" id="chat-modal" style="display:flex;">
                <div class="modal chat-modal">
                    <div class="chat-header">
                        <h3><i class="fas fa-comments"></i> Chat: ${ticket?.subject || 'Ticket'}</h3>
                        <button id="close-chat" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280;">✕</button>
                    </div>
                    <div class="chat-history" id="chat-history">
                        <p style="text-align:center;color:#9ca3af;">Cargando mensajes...</p>
                    </div>
                    <form id="chat-form" class="chat-input-area">
                        <select id="chat-sender-type" style="width:120px;">
                            <option value="admin">👨‍💼 Agente</option>
                            <option value="client">👤 ${clientName}</option>
                        </select>
                        <input type="text" id="chat-message-input" placeholder="Escribe un mensaje..." required autocomplete="off">
                        <button type="submit" class="btn btn-primary">Enviar</button>
                    </form>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('close-chat').addEventListener('click', () => document.getElementById('chat-modal').remove());
        this.loadChatMessages(ticketId);

        document.getElementById('chat-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-message-input');
            const senderType = document.getElementById('chat-sender-type').value;
            const message = input.value.trim();
            if (!message) return;
            const senderName = senderType === 'admin' ? 'Agente de Soporte' : clientName;
            const isAdmin = senderType === 'admin';
            const { error } = await supabase.from('ticket_messages').insert([{ ticket_id: ticketId, sender_name: senderName, message: message, is_admin: isAdmin }]);
            if (error) alert('Error: ' + error.message);
            else { input.value = ''; this.loadChatMessages(ticketId); }
        });
    }

    async loadChatMessages(ticketId) {
        const history = document.getElementById('chat-history');
        const { data, error } = await supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
        if (error || !data || data.length === 0) {
            history.innerHTML = '<p style="text-align:center;color:#9ca3af;margin-top:20px;">Aún no hay mensajes.</p>';
            return;
        }
        history.innerHTML = data.map(m => `
            <div class="chat-bubble ${m.is_admin ? 'admin' : 'client'}">
                <div class="chat-sender">${m.sender_name} <span class="chat-time">${this.formatDate(m.created_at)}</span></div>
                <div class="chat-text">${m.message}</div>
            </div>
        `).join('');
        history.scrollTop = history.scrollHeight;
    }

    // ================= PEDIDOS =================
    async loadOrders() {
        const content = document.querySelector('.content');
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-shopping-cart"></i> Gestión de Pedidos</h3>
                    <button class="btn btn-primary" id="btn-new-order"><i class="fas fa-plus"></i> Nuevo Pedido</button>
                </div>
                <div class="card-body">
                    <div id="orders-container"><p>Cargando pedidos...</p></div>
                </div>
            </div>
            <div class="modal-overlay" id="order-modal">
                <div class="modal">
                    <h3>Nuevo Pedido</h3>
                    <form id="order-form">
                        <label>Cliente</label>
                        <select id="order-contact" required><option value="">Cargando...</option></select>
                        <label>Producto</label>
                        <select id="order-product" required><option value="">Cargando...</option></select>
                        <label>Cantidad</label>
                        <input type="number" id="order-quantity" min="1" value="1" required>
                        <div class="order-total">Total: <strong id="order-total">0,00 €</strong></div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-order">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Pedido</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        this.renderOrders();
        this.loadOrderOptions();
        this.setupOrderEvents();
    }

    async renderOrders() {
        const container = document.getElementById('orders-container');
        const { data, error } = await supabase.from('orders').select('*, contacts(name)').order('created_at', { ascending: false });
        if (error) { container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>'; return; }
        if (!data || data.length === 0) { container.innerHTML = '<p>No hay pedidos.</p>'; return; }

        const statusLabels = { pending: 'Pendiente', processing: 'Procesando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Nº Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
                <tbody>
                    ${data.map(o => `
                        <tr>
                            <td><strong>${o.order_number}</strong></td>
                            <td>${o.contacts ? o.contacts.name : '—'}</td>
                            <td><strong>${this.formatCurrency(parseFloat(o.total))}</strong></td>
                            <td>
                                <select class="status-select" data-id="${o.id}">
                                    ${Object.keys(statusLabels).map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
                                </select>
                            </td>
                            <td>${this.formatDate(o.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const { error } = await supabase.from('orders').update({ status: e.target.value }).eq('id', e.target.dataset.id);
                if (error) alert('Error: ' + error.message);
            });
        });
    }

    async loadOrderOptions() {
        const contactSelect = document.getElementById('order-contact');
        const { data: contacts } = await supabase.from('contacts').select('id, name').order('name');
        if (contacts) contactSelect.innerHTML = '<option value="">-- Selecciona cliente --</option>' + contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        const productSelect = document.getElementById('order-product');
        const { data: products } = await supabase.from('products').select('id, name, price, stock').order('name');
        if (products) {
            this.productsCache = products;
            productSelect.innerHTML = '<option value="">-- Selecciona producto --</option>' + products.map(p => `<option value="${p.id}">${p.name} — ${this.formatCurrency(parseFloat(p.price))}</option>`).join('');
        }
    }

    setupOrderEvents() {
        const modal = document.getElementById('order-modal');
        document.getElementById('btn-new-order').addEventListener('click', () => modal.style.display = 'flex');
        document.getElementById('btn-cancel-order').addEventListener('click', () => modal.style.display = 'none');
        const updateTotal = () => {
            const productId = document.getElementById('order-product').value;
            const qty = parseInt(document.getElementById('order-quantity').value) || 0;
            const product = (this.productsCache || []).find(p => p.id === productId);
            document.getElementById('order-total').textContent = this.formatCurrency(product ? parseFloat(product.price) * qty : 0);
        };
        document.getElementById('order-product').addEventListener('change', updateTotal);
        document.getElementById('order-quantity').addEventListener('input', updateTotal);
        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('order-product').value;
            const qty = parseInt(document.getElementById('order-quantity').value);
            const product = (this.productsCache || []).find(p => p.id === productId);
            if (!product) { alert('Selecciona un producto'); return; }
            const total = parseFloat(product.price) * qty;
            const { data: order, error } = await supabase.from('orders').insert([{ contact_id: document.getElementById('order-contact').value, order_number: 'ORD-' + Date.now().toString().slice(-6), status: 'pending', total }]).select().single();
            if (error) { alert(' Error: ' + error.message); return; }
            await supabase.from('order_items').insert([{ order_id: order.id, product_id: productId, quantity: qty, unit_price: parseFloat(product.price) }]);
            await supabase.from('products').update({ stock: Math.max(0, product.stock - qty) }).eq('id', productId);
            modal.style.display = 'none'; e.target.reset(); this.renderOrders();
        });
    }

    // ================= REPORTES =================
    async loadReports() {
        const content = document.querySelector('.content');
        content.innerHTML = '<p>Cargando reportes...</p>';
        const { data: tickets } = await supabase.from('tickets').select('status');
        const { data: contacts } = await supabase.from('contacts').select('id');
        const { data: orders } = await supabase.from('orders').select('total, status');
        const { data: items } = await supabase.from('order_items').select('quantity');
        const t = tickets || [], c = contacts || [], o = orders || [], it = items || [];
        const openTickets = t.filter(x => x.status === 'open' || x.status === 'in_progress').length;
        const resolvedTickets = t.filter(x => x.status === 'resolved' || x.status === 'closed').length;
        const revenue = o.filter(x => x.status !== 'cancelled').reduce((sum, x) => sum + parseFloat(x.total), 0);
        const unitsSold = it.reduce((sum, x) => sum + x.quantity, 0);
        const statusLabels = { open: 'Abierto', in_progress: 'En Progreso', resolved: 'Resuelto', closed: 'Cerrado', pending: 'Pendiente', processing: 'Procesando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
        const barBlock = (title, statuses, arr, colorClass) => `
            <div class="card">
                <div class="card-header"><h3>${title}</h3></div>
                <div class="card-body">
                    ${statuses.map(s => {
                        const n = arr.filter(x => x.status === s).length;
                        const pct = arr.length ? Math.round((n / arr.length) * 100) : 0;
                        return `<div class="report-bar-row"><span class="report-label">${statusLabels[s]}</span><div class="report-bar"><div class="report-bar-fill ${colorClass}" style="width: ${pct}%"></div></div><span class="report-value">${n}</span></div>`;
                    }).join('')}
                </div>
            </div>
        `;
        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon" style="background: #3b82f6;"><i class="fas fa-ticket-alt"></i></div><div class="stat-info"><h3>Tickets Abiertos</h3><p class="stat-number">${openTickets}</p><span class="stat-change positive">${resolvedTickets} resueltos</span></div></div>
                <div class="stat-card"><div class="stat-icon" style="background: #10b981;"><i class="fas fa-users"></i></div><div class="stat-info"><h3>Clientes</h3><p class="stat-number">${c.length}</p></div></div>
                <div class="stat-card"><div class="stat-icon" style="background: #f59e0b;"><i class="fas fa-shopping-cart"></i></div><div class="stat-info"><h3>Pedidos</h3><p class="stat-number">${o.length}</p><span class="stat-change positive">${unitsSold} unidades</span></div></div>
                <div class="stat-card"><div class="stat-icon" style="background: #8b5cf6;"><i class="fas fa-euro-sign"></i></div><div class="stat-info"><h3>Ingresos</h3><p class="stat-number">${this.formatCurrency(revenue)}</p></div></div>
            </div>
            <div class="grid-2col">
                ${barBlock('<i class="fas fa-ticket-alt"></i> Tickets por Estado', ['open', 'in_progress', 'resolved', 'closed'], t, 'bar-blue')}
                ${barBlock('<i class="fas fa-shopping-cart"></i> Pedidos por Estado', ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], o, 'bar-green')}
            </div>
        `;
    }

    // ================= DASHBOARD REAL =================
    async loadDashboardReal() {
        const { count: openTickets } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']);
        const { count: totalContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
        const { count: pendingOrders } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { data: orders } = await supabase.from('orders').select('total').neq('status', 'cancelled');
        const totalRevenue = orders ? orders.reduce((sum, o) => sum + parseFloat(o.total), 0) : 0;
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 4) {
            statNumbers[0].textContent = openTickets || 0;
            statNumbers[1].textContent = totalContacts || 0;
            statNumbers[2].textContent = pendingOrders || 0;
            statNumbers[3].textContent = this.formatCurrency(totalRevenue);
        }
        const { data: recentTickets } = await supabase.from('tickets').select('*, contacts(name)').order('created_at', { ascending: false }).limit(3);
        if (recentTickets && recentTickets.length > 0) {
            const ticketList = document.querySelector('.ticket-list');
            if (ticketList) {
                const statusLabels = { open: 'Abierto', in_progress: 'En Progreso', resolved: 'Resuelto', closed: 'Cerrado' };
                ticketList.innerHTML = recentTickets.map(t => `
                    <div class="ticket-item">
                        <div class="ticket-info">
                            <h4>#${t.id.slice(0, 8)} - ${t.subject}</h4>
                            <p class="ticket-meta">${t.contacts ? t.contacts.name : '—'} • ${this.formatDate(t.created_at)}</p>
                        </div>
                        <span class="badge status-${t.status === 'in_progress' ? 'progress' : t.status}">${statusLabels[t.status] || t.status}</span>
                    </div>
                `).join('');
            }
        }
        const { data: recentOrders } = await supabase.from('orders').select('*, contacts(name)').order('created_at', { ascending: false }).limit(3);
        if (recentOrders && recentOrders.length > 0) {
            const orderList = document.querySelector('.order-list');
            if (orderList) {
                const statusLabels = { pending: 'Pendiente', processing: 'Procesando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
                orderList.innerHTML = recentOrders.map(o => `
                    <div class="order-item">
                        <div class="order-info">
                            <h4>Pedido #${o.order_number}</h4>
                            <p class="order-meta">${o.contacts ? o.contacts.name : '—'} • ${this.formatCurrency(parseFloat(o.total))}</p>
                        </div>
                        <span class="badge status-${o.status}">${statusLabels[o.status] || o.status}</span>
                    </div>
                `).join('');
            }
        }
    }

    // ================= CONFIGURACIÓN =================
    async loadSettings() {
        const content = document.querySelector('.content');
        content.innerHTML = `
            <div class="grid-2col">
                <div class="card">
                    <div class="card-header"><h3><i class="fas fa-building"></i> Datos de la Empresa</h3></div>
                    <div class="card-body">
                        <form id="settings-form" class="settings-form">
                            <label>Nombre de la empresa</label><input type="text" id="set-company" placeholder="Mi Empresa SL">
                            <label>Email de contacto</label><input type="email" id="set-email" placeholder="info@empresa.com">
                            <label>Teléfono</label><input type="text" id="set-phone" placeholder="+34 900 000 000">
                            <label>Moneda</label>
                            <select id="set-currency"><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option><option value="MXN">MXN ($)</option></select>
                            <div class="modal-actions"><button type="submit" class="btn btn-primary">Guardar Cambios</button></div>
                            <p id="settings-saved" class="saved-msg"></p>
                        </form>
                    </div>
                </div>
                <div>
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-plug"></i> Conexión Supabase</h3></div>
                        <div class="card-body">
                            <p class="settings-url" id="set-url"></p>
                            <button class="btn btn-primary" id="btn-test-connection"><i class="fas fa-bolt"></i> Probar Conexión</button>
                            <p id="connection-result" style="margin-top:12px"></p>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-database"></i> Copias de Seguridad</h3></div>
                        <div class="card-body">
                            <button class="btn btn-primary" id="btn-export"><i class="fas fa-download"></i> Exportar Backup (JSON)</button>
                            <p style="margin-top:10px; font-size:13px; color:var(--gray-500)">Descarga todos tus datos en un archivo JSON.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const { data } = await supabase.from('settings').select('*').eq('id', 1).single();
        if (data) {
            document.getElementById('set-company').value = data.company_name || '';
            document.getElementById('set-email').value = data.email || '';
            document.getElementById('set-phone').value = data.phone || '';
            document.getElementById('set-currency').value = data.currency || 'EUR';
        }
        document.getElementById('set-url').textContent = '🔗 ' + supabase.supabaseUrl;
        document.getElementById('settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { error } = await supabase.from('settings').update({ company_name: document.getElementById('set-company').value, email: document.getElementById('set-email').value, phone: document.getElementById('set-phone').value, currency: document.getElementById('set-currency').value }).eq('id', 1);
            const msg = document.getElementById('settings-saved');
            msg.textContent = error ? '❌ Error al guardar' : '✅ Cambios guardados';
            setTimeout(() => msg.textContent = '', 2500);
        });
        document.getElementById('btn-test-connection').addEventListener('click', async () => {
            const result = document.getElementById('connection-result');
            result.textContent = '⏳ Probando...';
            const start = performance.now();
            const { error } = await supabase.from('contacts').select('id').limit(1);
            const ms = Math.round(performance.now() - start);
            result.innerHTML = error ? '<span class="error">❌ Error: ' + error.message + '</span>' : '<span class="saved-msg">✅ Conexión correcta (' + ms + ' ms)</span>';
        });
        document.getElementById('btn-export').addEventListener('click', async () => {
            const [c, t, p, o] = await Promise.all([supabase.from('contacts').select('*'), supabase.from('tickets').select('*'), supabase.from('products').select('*'), supabase.from('orders').select('*')]);
            const backup = { exported_at: new Date().toISOString(), contacts: c.data, tickets: t.data, products: p.data, orders: o.data };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'crm-backup-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
        });
    }

    formatDate(date) { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date)); }
    formatCurrency(amount) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount); }
}

new CRMApp();
