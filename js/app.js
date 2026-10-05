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
                document.querySelector('.content').innerHTML = this.dashboardHTML;
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
                    <tr><th>Asunto</th><th>Cliente</th><th>Prioridad</th><th>Estado</th><th>Fecha</th></tr>
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

    async loadContactOptions() {
        const select = document.getElementById('ticket-contact');
        const { data } = await supabase.from('contacts').select('id, name').order('name');
        if (data) {
            select.innerHTML = '<option value="">-- Selecciona cliente --</option>' +
                data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    }

    setupTicketEvents() {
        const modal = document.getElementById('ticket-modal');
        document.getElementById('btn-new-ticket').addEventListener('click', () => modal.style.display = 'flex');
        document.getElementById('btn-cancel').addEventListener('click', () => modal.style.display = 'none');

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
                    <h3>Nuevo Cliente</h3>
                    <form id="contact-form">
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

    async renderContacts() {
        const container = document.getElementById('contacts-container');
        const { data, error } = await supabase
            .from('contacts')
            .select('*')
            .order('name');

        if (error) {
            container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>';
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = '<p>No hay contactos. Crea el primero con "Nuevo Cliente".</p>';
            return;
        }

        const statusLabels = { active: 'Activo', lead: 'Lead', inactive: 'Inactivo' };

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Empresa</th><th>Ciudad</th><th>Estado</th></tr>
                </thead>
                <tbody>
                    ${data.map(c => `
                        <tr>
                            <td><strong>${c.name}</strong></td>
                            <td>${c.email}</td>
                            <td>${c.phone || '—'}</td>
                            <td>${c.company || '—'}</td>
                            <td>${c.city || '—'}</td>
                            <td><span class="badge contact-${c.status}">${statusLabels[c.status] || c.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    setupContactEvents() {
        const modal = document.getElementById('contact-modal');
        document.getElementById('btn-new-contact').addEventListener('click', () => modal.style.display = 'flex');
        document.getElementById('btn-cancel-contact').addEventListener('click', () => modal.style.display = 'none');

        document.getElementById('contact-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { error } = await supabase.from('contacts').insert([{
                name: document.getElementById('contact-name').value,
                email: document.getElementById('contact-email').value,
                phone: document.getElementById('contact-phone').value,
                company: document.getElementById('contact-company').value,
                city: document.getElementById('contact-city').value,
                status: 'active'
            }]);
            if (error) {
                alert('❌ Error al crear: ' + error.message);
            } else {
                modal.style.display = 'none';
                e.target.reset();
                this.renderContacts();
            }
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
                    <h3>Nuevo Producto</h3>
                    <form id="product-form">
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

    async renderProducts() {
        const container = document.getElementById('products-container');
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');

        if (error) {
            container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>';
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = '<p>No hay productos. Crea el primero con "Nuevo Producto".</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th></tr>
                </thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td><strong>${p.name}</strong></td>
                            <td>${p.category || '—'}</td>
                            <td><strong>${this.formatCurrency(parseFloat(p.price))}</strong></td>
                            <td>${p.stock}</td>
                            <td><span class="badge ${this.stockBadge(p.stock)}">${this.stockLabel(p.stock)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    stockBadge(stock) {
        if (stock <= 0) return 'stock-out';
        if (stock <= 10) return 'stock-low';
        return 'stock-ok';
    }

    stockLabel(stock) {
        if (stock <= 0) return 'Agotado';
        if (stock <= 10) return 'Stock bajo';
        return 'En stock';
    }

    setupProductEvents() {
        const modal = document.getElementById('product-modal');
        document.getElementById('btn-new-product').addEventListener('click', () => modal.style.display = 'flex');
        document.getElementById('btn-cancel-product').addEventListener('click', () => modal.style.display = 'none');

        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { error } = await supabase.from('products').insert([{
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                stock: parseInt(document.getElementById('product-stock').value),
                category: document.getElementById('product-category').value,
                active: true
            }]);
            if (error) {
                alert('❌ Error al crear: ' + error.message);
            } else {
                modal.style.display = 'none';
                e.target.reset();
                this.renderProducts();
            }
        });
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
        const { data, error } = await supabase
            .from('orders')
            .select('*, contacts(name)')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>';
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = '<p>No hay pedidos. Crea el primero con "Nuevo Pedido".</p>';
            return;
        }

        const statusLabels = { pending: 'Pendiente', processing: 'Procesando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr><th>Nº Pedido</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr>
                </thead>
                <tbody>
                    ${data.map(o => `
                        <tr>
                            <td><strong>${o.order_number}</strong></td>
                            <td>${o.contacts ? o.contacts.name : '—'}</td>
                            <td><strong>${this.formatCurrency(parseFloat(o.total))}</strong></td>
                            <td>
                                <select class="status-select" data-id="${o.id}">
                                    ${Object.keys(statusLabels).map(s =>
                                        `<option value="${s}" ${s === o.status ? 'selected' : ''}>${statusLabels[s]}</option>`
                                    ).join('')}
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
                const { error } = await supabase
                    .from('orders')
                    .update({ status: e.target.value })
                    .eq('id', e.target.dataset.id);
                if (error) alert('Error al actualizar: ' + error.message);
            });
        });
    }

    async loadOrderOptions() {
        const contactSelect = document.getElementById('order-contact');
        const { data: contacts } = await supabase.from('contacts').select('id, name').order('name');
        if (contacts) {
            contactSelect.innerHTML = '<option value="">-- Selecciona cliente --</option>' +
                contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }

        const productSelect = document.getElementById('order-product');
        const { data: products } = await supabase.from('products').select('id, name, price, stock').order('name');
        if (products) {
            this.productsCache = products;
            productSelect.innerHTML = '<option value="">-- Selecciona producto --</option>' +
                products.map(p => `<option value="${p.id}">${p.name} — ${this.formatCurrency(parseFloat(p.price))}</option>`).join('');
        }
    }

    setupOrderEvents() {
        const modal = document.getElementById('order-modal');
        document.getElementById('btn-new-order').addEventListener('click', () => modal.style.display = 'flex');
        document.getElementById('btn-cancel-order').addEventListener('click', () => modal.style.display = 'none');

        // Calcular total automáticamente
        const updateTotal = () => {
            const productId = document.getElementById('order-product').value;
            const qty = parseInt(document.getElementById('order-quantity').value) || 0;
            const product = (this.productsCache || []).find(p => p.id === productId);
            document.getElementById('order-total').textContent =
                this.formatCurrency(product ? parseFloat(product.price) * qty : 0);
        };
        document.getElementById('order-product').addEventListener('change', updateTotal);
        document.getElementById('order-quantity').addEventListener('input', updateTotal);

        // Guardar pedido
        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('order-product').value;
            const qty = parseInt(document.getElementById('order-quantity').value);
            const product = (this.productsCache || []).find(p => p.id === productId);

            if (!product) { alert('Selecciona un producto'); return; }

            const total = parseFloat(product.price) * qty;

            const { data: order, error } = await supabase.from('orders').insert([{
                contact_id: document.getElementById('order-contact').value,
                order_number: 'ORD-' + Date.now().toString().slice(-6),
                status: 'pending',
                total: total
            }]).select().single();

            if (error) { alert('❌ Error al crear pedido: ' + error.message); return; }

            await supabase.from('order_items').insert([{
                order_id: order.id,
                product_id: productId,
                quantity: qty,
                unit_price: parseFloat(product.price)
            }]);

            // Descontar stock automáticamente
            await supabase.from('products')
                .update({ stock: Math.max(0, product.stock - qty) })
                .eq('id', productId);

            modal.style.display = 'none';
            e.target.reset();
            this.renderOrders();
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

        const t = tickets || [];
        const c = contacts || [];
        const o = orders || [];
        const it = items || [];

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
                        return `
                            <div class="report-bar-row">
                                <span class="report-label">${statusLabels[s]}</span>
                                <div class="report-bar"><div class="report-bar-fill ${colorClass}" style="width: ${pct}%"></div></div>
                                <span class="report-value">${n}</span>
                            </div>`;
                    }).join('')}
                </div>
            </div>
        `;

        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon" style="background: #3b82f6;"><i class="fas fa-ticket-alt"></i></div>
                    <div class="stat-info">
                        <h3>Tickets Abiertos</h3>
                        <p class="stat-number">${openTickets}</p>
                        <span class="stat-change positive">${resolvedTickets} resueltos</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: #10b981;"><i class="fas fa-users"></i></div>
                    <div class="stat-info">
                        <h3>Clientes</h3>
                        <p class="stat-number">${c.length}</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: #f59e0b;"><i class="fas fa-shopping-cart"></i></div>
                    <div class="stat-info">
                        <h3>Pedidos</h3>
                        <p class="stat-number">${o.length}</p>
                        <span class="stat-change positive">${unitsSold} unidades vendidas</span>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon" style="background: #8b5cf6;"><i class="fas fa-euro-sign"></i></div>
                    <div class="stat-info">
                        <h3>Ingresos</h3>
                        <p class="stat-number">${this.formatCurrency(revenue)}</p>
                    </div>
                </div>
            </div>

            <div class="grid-2col">
                ${barBlock('<i class="fas fa-ticket-alt"></i> Tickets por Estado', ['open', 'in_progress', 'resolved', 'closed'], t, 'bar-blue')}
                ${barBlock('<i class="fas fa-shopping-cart"></i> Pedidos por Estado', ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], o, 'bar-green')}
            </div>
        `;
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
