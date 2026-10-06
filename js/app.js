import { supabase } from './supabase-config.js';

class CRMApp {
    constructor() {
        this.dashboardHTML = document.querySelector('.content').innerHTML;
        this.currentPage = 'dashboard';
        this.charts = {};
        this.init();
    }

    async init() {
        this.injectWhatsAppLink();
        this.injectSocialLink();
        this.setupNavigation();
        this.setupMenuToggle();
        this.setupGlobalSearch();
        await this.checkAuth();
        this.setupSoundAndRealtime();
        this.fixStoreButton();
        this.injectLanguageSelector();
        this.applyLanguage(localStorage.getItem('crm_lang') || 'es');
        this.observeTranslations();
        console.log('CRM + Tienda Online iniciado');
    }

    injectWhatsAppLink() {
        if (document.querySelector('a[href="#whatsapp"]')) return;
        const settingsLink = document.querySelector('a[href="#settings"]');
        if (!settingsLink) return;
        const inner = '<i class="fab fa-whatsapp"></i> WhatsApp';
        const settingsLi = settingsLink.closest('li');
        if (settingsLi) {
            const li = document.createElement('li');
            li.innerHTML = '<a href="#whatsapp" class="nav-link">' + inner + '</a>';
            settingsLi.parentElement.insertBefore(li, settingsLi);
        } else {
            const a = document.createElement('a');
            a.href = '#whatsapp';
            a.className = 'nav-link';
            a.innerHTML = inner;
            settingsLink.parentNode.insertBefore(a, settingsLink);
        }
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
            case 'whatsapp':
                await this.loadWhatsApp();
                break;
            case 'social':
                await this.loadSocial();
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

    // 🔓 LOGIN DESACTIVADO TEMPORALMENTE + avatar + notificaciones
    async checkAuth() {
        const loginOverlay = document.getElementById('login-overlay');
        const mainContent = document.querySelector('.main-content');
        const sidebar = document.querySelector('.sidebar');
        if (loginOverlay) loginOverlay.classList.add('hidden');
        if (mainContent) mainContent.style.display = '';
        if (sidebar) sidebar.style.display = '';

        const userName = 'Desarrollo';
        const userMenu = document.querySelector('.user-menu span');
        if (userMenu) userMenu.textContent = userName;

        const userMenuBox = document.querySelector('.user-menu');
        if (userMenuBox) {
            const badImg = userMenuBox.querySelector('img');
            if (badImg) badImg.remove();
            if (!userMenuBox.querySelector('.avatar-init')) {
                const av = document.createElement('div');
                av.className = 'avatar-init';
                av.style.cssText = 'width:36px;height:36px;border-radius:50%;background:#3b82f6;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;margin-right:8px;flex:none;';
                av.textContent = (userName || 'U').charAt(0).toUpperCase();
                if (userMenu) userMenuBox.insertBefore(av, userMenu);
                else userMenuBox.appendChild(av);
            }
        }

        await this.setupNotifications();
        this.setupLogin();
    }

    async setupNotifications() {
        const icon = document.querySelector('.user-menu i.fa-bell') || document.querySelector('i.fa-bell');
        if (!icon) return;
        const bellWrap = icon.parentElement;
        if (!bellWrap) return;

        const [prod, pend, open] = await Promise.all([
            supabase.from('products').select('id, name, stock, min_stock'),
            supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress'])
        ]);

        const items = [];
        (prod.data || []).forEach(p => {
            const min = p.min_stock != null ? p.min_stock : 5;
            if (p.stock <= min) items.push('📦 Stock bajo: ' + p.name + ' (' + p.stock + ')');
        });
        if (pend.count) items.push('🛒 ' + pend.count + ' pedido(s) pendiente(s)');
        if (open.count) items.push('🎫 ' + open.count + ' ticket(s) abierto(s)');

        let badge = bellWrap.querySelector('span');
        if (!badge) { badge = document.createElement('span'); bellWrap.appendChild(badge); }
        badge.textContent = items.length;
        badge.style.display = items.length > 0 ? '' : 'none';

        bellWrap.style.cursor = 'pointer';
        bellWrap.onclick = (e) => {
            e.stopPropagation();
            const existing = document.getElementById('notif-panel');
            if (existing) { existing.remove(); return; }
            const panel = document.createElement('div');
            panel.id = 'notif-panel';
            panel.style.cssText = 'position:fixed;right:16px;top:60px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);width:300px;padding:12px;z-index:999;color:#111827;';
            panel.innerHTML = '<strong style="font-size:13px;">🔔 Notificaciones</strong>' +
                '<div style="margin-top:8px;font-size:13px;color:#374151;max-height:260px;overflow:auto;">' +
                (items.length ? items.map(i => '<div style="padding:7px 0;border-bottom:1px solid #f3f4f6;">' + i + '</div>').join('') : '<div style="padding:7px 0;">Sin notificaciones. ✅</div>') +
                '</div>';
            document.body.appendChild(panel);
        };

        if (!this._notifOutsideBound) {
            this._notifOutsideBound = true;
            document.addEventListener('click', (e) => {
                const panel = document.getElementById('notif-panel');
                if (panel && !panel.contains(e.target) && !bellWrap.contains(e.target)) panel.remove();
            });
        }
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

    // ================= SONIDOS + TIEMPO REAL =================
    setupSoundAndRealtime() {
        this.soundEnabled = localStorage.getItem('crm_sound') !== 'off';
        this.injectSoundToggle();
        const unlock = () => { this.ensureAudio(); };
        document.addEventListener('click', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
        this.setupRealtime();
    }

    injectSoundToggle() {
        const userMenu = document.querySelector('.user-menu');
        if (!userMenu || document.getElementById('sound-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'sound-toggle';
        btn.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;margin-right:8px;';
        btn.textContent = this.soundEnabled ? '🔊' : '🔇';
        btn.title = 'Activar / silenciar sonidos';
        btn.onclick = (e) => {
            e.stopPropagation();
            this.soundEnabled = !this.soundEnabled;
            localStorage.setItem('crm_sound', this.soundEnabled ? 'on' : 'off');
            btn.textContent = this.soundEnabled ? '🔊' : '🔇';
            if (this.soundEnabled) this.playMessageSound();
        };
        userMenu.insertBefore(btn, userMenu.firstChild);
    }

    ensureAudio() {
        if (!this.audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            this.audioCtx = new AC();
        }
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        return this.audioCtx;
    }

    beep(freq, start, dur, type, gain) {
        const ctx = this.ensureAudio();
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        const t = ctx.currentTime + start;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain || 0.2, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); o.stop(t + dur + 0.02);
    }

    playMessageSound() {
        if (!this.soundEnabled) return;
        this.beep(880, 0, 0.15, 'sine', 0.25);
        this.beep(1320, 0.12, 0.18, 'sine', 0.22);
    }

    playNotifSound() {
        if (!this.soundEnabled) return;
        this.beep(520, 0, 0.18, 'triangle', 0.25);
        this.beep(392, 0.16, 0.22, 'triangle', 0.25);
    }

    showToast(text) {
        let wrap = document.getElementById('toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'toast-wrap';
            wrap.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:1000;display:flex;flex-direction:column;gap:8px;';
            document.body.appendChild(wrap);
        }
        const t = document.createElement('div');
        t.style.cssText = 'background:#111827;color:#fff;padding:10px 14px;border-radius:10px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:280px;';
        t.textContent = text;
        wrap.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, 4000);
    }

    setupRealtime() {
        if (this.rtChannel) return;
        this.rtChannel = supabase.channel('crm-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_messages' }, () => {
                this.playMessageSound();
                this.showToast('💬 Nuevo mensaje recibido');
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
                this.playNotifSound();
                this.showToast('🛒 Nuevo pedido entrante');
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, () => {
                this.playNotifSound();
                this.showToast('🎫 Nuevo ticket creado');
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
                const o = payload.old, n = payload.new;
                if (o && n && o.status !== n.status) { this.playNotifSound(); this.showToast('🔔 Pedido cambiado a: ' + n.status); }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, (payload) => {
                const o = payload.old, n = payload.new;
                if (o && n && o.status !== n.status) { this.playNotifSound(); this.showToast('🔔 Ticket cambiado a: ' + n.status); }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
                const o = payload.old, n = payload.new;
                if (o && n) {
                    const min = n.min_stock != null ? n.min_stock : 5;
                    if (n.stock <= min && o.stock > min) { this.playNotifSound(); this.showToast('📦 Stock bajo: ' + n.name); }
                }
            })
            .subscribe();
    }

    // ================= WHATSAPP =================
    whatsappTemplates() {
        return [
            { id: 'bienvenida', label: '👋 Bienvenida', text: 'Hola {nombre}! Gracias por confiar en {empresa}. ¿En qué podemos ayudarte?' },
            { id: 'confirmacion', label: '✅ Pedido confirmado', text: 'Hola {nombre}, hemos recibido tu pedido {pedido} por {total}. Te avisaremos cuando lo enviemos. ¡Gracias!' },
            { id: 'enviado', label: '🚚 Pedido enviado', text: 'Hola {nombre}, tu pedido {pedido} por {total} ya está en camino. Entrega estimada: {fecha}.' },
            { id: 'pago', label: '💳 Recordatorio de pago', text: 'Hola {nombre}, te recordamos que el pedido {pedido} por {total} está pendiente de pago. ¿Te enviamos el enlace?' },
            { id: 'lead', label: '🎯 Seguimiento de lead', text: 'Hola {nombre}, ¿sigues interesado? Tenemos novedades que pueden interesarte.' },
            { id: 'ticket', label: '🎫 Consulta actualizada', text: 'Hola {nombre}, tu consulta "{asunto}" ha sido actualizada. Seguimos trabajando en ella.' }
        ];
    }

    fillWhatsAppTemplate(text, vars) {
        return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '') ? vars[k] : '');
    }
    openLink(url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
      openLink(url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    cleanPhone(p) { return (p || '').replace(/\D/g, ''); }

     async openWhatsAppModal(opts) {
        const { data: settings } = await supabase.from('settings').select('company_name').eq('id', 1).single();
        const vars = {
            nombre: opts.name || '',
            empresa: (settings && settings.company_name) || 'Mi Empresa',
            pedido: opts.order || '',
            total: opts.total ? this.formatCurrency(parseFloat(opts.total)) : '',
            fecha: opts.date || '',
            asunto: opts.subject || ''
        };
        const templates = this.whatsappTemplates();
        const modalHTML = `
            <div class="modal-overlay" id="wa-modal" style="display:flex;">
                <div class="modal">
                    <h3>💬 Enviar WhatsApp</h3>
                    <label>Cliente</label>
                    <input type="text" value="${(opts.name || '').replace(/"/g, '&quot;')}" disabled>
                    <label>Teléfono (con prefijo, ej: 34600000000)</label>
                    <input type="text" id="wa-phone" value="${opts.phone || ''}">
                    <label>Plantilla</label>
                    <select id="wa-template">
                        <option value="">-- Mensaje libre --</option>
                        ${templates.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
                    </select>
                    <label>Mensaje</label>
                    <textarea id="wa-message" rows="4" placeholder="Escribe o elige una plantilla..."></textarea>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" id="wa-cancel">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="wa-send">📨 Abrir WhatsApp y registrar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('wa-modal');
        const tplSelect = document.getElementById('wa-template');
        const msgBox = document.getElementById('wa-message');
        tplSelect.addEventListener('change', () => {
            const t = templates.find(x => x.id === tplSelect.value);
            msgBox.value = t ? this.fillWhatsAppTemplate(t.text, vars) : '';
        });
        document.getElementById('wa-cancel').addEventListener('click', () => modal.remove());
        document.getElementById('wa-send').addEventListener('click', async () => {
            const phone = this.cleanPhone(document.getElementById('wa-phone').value);
            const message = msgBox.value.trim();
            if (!phone) { alert('Pon un teléfono con prefijo (ej: 34600000000)'); return; }
            if (!message) { alert('Escribe un mensaje o elige una plantilla'); return; }
            this.openLink('https://wa.me/' + phone + '?text=' + encodeURIComponent(message));
            await supabase.from('whatsapp_logs').insert([{
                contact_id: opts.contactId || null,
                phone: phone,
                template: tplSelect.value || 'libre',
                message: message,
                source: opts.source || 'manual'
            }]);
            modal.remove();
        });
    }

    async loadWhatsApp() {
        const content = document.querySelector('.content');
        const fieldStyle = 'width:100%;padding:9px 10px;border:1px solid #bbe5d0;border-radius:8px;margin-bottom:12px;display:block;font-size:14px;background:#f6fdf9;';
        const labelStyle = 'display:block;font-size:13px;font-weight:600;color:#075E54;margin-bottom:5px;';
        const headerStyle = 'background:linear-gradient(135deg,#075E54,#128C7E);color:#fff;';
        content.innerHTML = `
            <div style="background:linear-gradient(135deg,#075E54,#25D366);color:#fff;border-radius:12px;padding:18px 20px;margin-bottom:18px;display:flex;align-items:center;gap:12px;">
                <i class="fab fa-whatsapp" style="font-size:34px;"></i>
                <div>
                    <h2 style="margin:0;color:#fff;font-size:20px;">WhatsApp</h2>
                    <p style="margin:2px 0 0;color:#e7f8ef;font-size:13px;">Envía mensajes a tus clientes y consulta el historial</p>
                </div>
            </div>
            <div class="grid-2col">
                <div class="card" style="border:1px solid #bbe5d0;">
                    <div class="card-header" style="${headerStyle}"><h3 style="color:#fff;margin:0;"><i class="fab fa-whatsapp"></i> Nuevo mensaje</h3></div>
                    <div class="card-body">
                        <form class="settings-form" id="wa-page-form">
                            <label style="${labelStyle}">Cliente</label>
                            <select id="wa-contact" style="${fieldStyle}"><option value="">-- Selecciona cliente --</option></select>
                            <label style="${labelStyle}">Plantilla</label>
                            <select id="wa-tpl" style="${fieldStyle}"><option value="">-- Mensaje libre --</option></select>
                            <label style="${labelStyle}">Mensaje</label>
                            <textarea id="wa-msg" rows="4" style="${fieldStyle}" placeholder="Escribe o elige plantilla..."></textarea>
                            <button type="button" id="wa-send-page" style="background:#25D366;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;">📨 Abrir WhatsApp y registrar</button>
                        </form>
                    </div>
                </div>
                <div class="card" style="border:1px solid #bbe5d0;">
                    <div class="card-header" style="${headerStyle}"><h3 style="color:#fff;margin:0;">📜 Historial de envíos</h3></div>
                    <div class="card-body"><div id="wa-history"><p>Cargando...</p></div></div>
                </div>
            </div>
        `;
        const { data: contacts } = await supabase.from('contacts').select('id, name, phone').order('name');
        const sel = document.getElementById('wa-contact');
        if (contacts) sel.innerHTML = '<option value="">-- Selecciona cliente --</option>' + contacts.map(c => `<option value="${c.id}" data-phone="${c.phone || ''}" data-name="${(c.name || '').replace(/"/g, '&quot;')}">${c.name}</option>`).join('');
        const templates = this.whatsappTemplates();
        document.getElementById('wa-tpl').innerHTML = '<option value="">-- Mensaje libre --</option>' + templates.map(t => `<option value="${t.id}">${t.label}</option>`).join('');

        document.getElementById('wa-tpl').addEventListener('change', async () => {
            const t = templates.find(x => x.id === document.getElementById('wa-tpl').value);
            const msgBox = document.getElementById('wa-msg');
            if (!t) { msgBox.value = ''; return; }
            const { data: settings } = await supabase.from('settings').select('company_name').eq('id', 1).single();
            const opt = sel.selectedOptions[0];
            const v = { nombre: (opt && opt.dataset.name) || '', empresa: (settings && settings.company_name) || 'Mi Empresa', pedido: '', total: '', fecha: '', asunto: '' };
            msgBox.value = this.fillWhatsAppTemplate(t.text, v);
        });

        document.getElementById('wa-send-page').addEventListener('click', async () => {
            const opt = sel.selectedOptions[0];
            if (!opt || !opt.value) { alert('Selecciona un cliente'); return; }
            const phone = this.cleanPhone(opt.dataset.phone);
            const message = document.getElementById('wa-msg').value.trim();
            if (!phone) { alert('El cliente no tiene teléfono o falta el prefijo'); return; }
            if (!message) { alert('Escribe un mensaje o elige plantilla'); return; }
            this.openLink('https://wa.me/' + phone + '?text=' + encodeURIComponent(message));
            await supabase.from('whatsapp_logs').insert([{ contact_id: opt.value, phone: phone, template: document.getElementById('wa-tpl').value || 'libre', message: message, source: 'compositor' }]);
            this.renderWhatsAppLogs();
        });

        this.renderWhatsAppLogs();
    }

    async renderWhatsAppLogs() {
        const box = document.getElementById('wa-history');
        if (!box) return;
        const { data, error } = await supabase.from('whatsapp_logs').select('*, contacts(name)').order('created_at', { ascending: false }).limit(50);
        if (error) { box.innerHTML = '<p class="error">❌ ' + error.message + '</p>'; return; }
        if (!data || data.length === 0) { box.innerHTML = '<p>Aún no hay envíos.</p>'; return; }
        box.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Teléfono</th><th>Plantilla</th><th>Mensaje</th></tr></thead>
                <tbody>
                    ${data.map(l => `
                        <tr>
                            <td>${this.formatDate(l.created_at)}</td>
                            <td>${l.contacts ? l.contacts.name : '—'}</td>
                            <td>${l.phone}</td>
                            <td>${l.template}</td>
                            <td>${(l.message || '').substring(0, 60)}${(l.message || '').length > 60 ? '…' : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
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
                        <label>CIF / NIF</label>
                        <input type="text" id="contact-taxid" placeholder="B12345678">
                        <label>Empresa</label>
                        <input type="text" id="contact-company" placeholder="Nombre de la empresa">
                        <label>Tipo de cliente</label>
                        <select id="contact-type"><option value="particular">Particular</option><option value="empresa">Empresa</option></select>
                        <label>Dirección</label>
                        <input type="text" id="contact-address" placeholder="Calle, número, CP, ciudad">
                        <label>Ciudad</label>
                        <input type="text" id="contact-city" placeholder="Madrid">
                        <label>Estado</label>
                        <select id="contact-status"><option value="active">Activo</option><option value="lead">Lead</option><option value="inactive">Inactivo</option></select>
                        <label>Fecha último contacto</label>
                        <input type="date" id="contact-lastcontact">
                        <label>Notas / observaciones</label>
                        <textarea id="contact-notes" rows="2" placeholder="Notas internas"></textarea>
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
        const typeLabels = { particular: 'Particular', empresa: 'Empresa' };
        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Email</th><th>CIF/NIF</th><th>Empresa</th><th>Ciudad</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${data.map(c => `
                        <tr>
                            <td><strong>${c.name}</strong></td>
                            <td>${typeLabels[c.customer_type] || 'Particular'}</td>
                            <td>${c.email}</td>
                            <td>${c.tax_id || '—'}</td>
                            <td>${c.company || '—'}</td>
                            <td>${c.city || '—'}</td>
                            <td><span class="badge contact-${c.status}">${statusLabels[c.status] || c.status}</span></td>
                            <td>
                                <button class="btn-whatsapp" style="background:#25D366;color:#fff;border:none;border-radius:6px;padding:6px 9px;cursor:pointer;margin-right:4px;" data-id="${c.id}" data-phone="${c.phone || ''}" data-name="${(c.name || '').replace(/"/g, '&quot;')}" title="WhatsApp">💬</button>
                                <button class="btn-edit" data-id="${c.id}"><i class="fas fa-edit"></i></button>
                                <button class="btn-delete" data-id="${c.id}"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.querySelectorAll('.btn-whatsapp').forEach(btn => btn.addEventListener('click', () => this.openWhatsAppModal({ contactId: btn.dataset.id, name: btn.dataset.name, phone: btn.dataset.phone, source: 'contacto' })));
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
        document.getElementById('contact-taxid').value = data.tax_id || '';
        document.getElementById('contact-company').value = data.company || '';
        document.getElementById('contact-type').value = data.customer_type || 'particular';
        document.getElementById('contact-address').value = data.address || '';
        document.getElementById('contact-city').value = data.city || '';
        document.getElementById('contact-status').value = data.status || 'active';
        document.getElementById('contact-lastcontact').value = data.last_contact_date || '';
        document.getElementById('contact-notes').value = data.notes || '';
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
                tax_id: document.getElementById('contact-taxid').value,
                company: document.getElementById('contact-company').value,
                customer_type: document.getElementById('contact-type').value,
                address: document.getElementById('contact-address').value,
                city: document.getElementById('contact-city').value,
                status: document.getElementById('contact-status').value,
                last_contact_date: document.getElementById('contact-lastcontact').value || null,
                notes: document.getElementById('contact-notes').value
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
                        <label>SKU / código interno</label>
                        <input type="text" id="product-sku" placeholder="TEC-001">
                        <label>Descripción</label>
                        <textarea id="product-description" rows="2" placeholder="Descripción corta"></textarea>
                        <label>Precio venta (€)</label>
                        <input type="number" id="product-price" step="0.01" min="0" required placeholder="49.99">
                        <label>Coste (€)</label>
                        <input type="number" id="product-cost" step="0.01" min="0" placeholder="20.00">
                        <label>Stock</label>
                        <input type="number" id="product-stock" min="0" required placeholder="20">
                        <label>Stock mínimo (aviso)</label>
                        <input type="number" id="product-minstock" min="0" value="5">
                        <label>Categoría</label>
                        <input type="text" id="product-category" placeholder="Electrónica">
                        <label>IVA del producto (%)</label>
                        <input type="number" id="product-iva" step="0.1" value="21">
                        <label>Estado</label>
                        <select id="product-active"><option value="1">Activo (visible en tienda)</option><option value="0">Inactivo (oculto)</option></select>
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
                <thead><tr><th>Imagen</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Margen</th><th>Stock</th><th>Estado</th><th>Activo</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td>${p.image_url ? `<img src="${p.image_url}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;">` : '—'}</td>
                            <td><strong>${p.name}</strong>${p.sku ? `<br><small style="color:#9ca3af;">${p.sku}</small>` : ''}</td>
                            <td>${p.category || '—'}</td>
                            <td><strong>${this.formatCurrency(parseFloat(p.price))}</strong></td>
                            <td>${this.marginLabel(p)}</td>
                            <td><span class="badge ${this.stockBadge(p)}">${p.stock}</span></td>
                            <td>${this.stockLabel(p)}</td>
                            <td><span class="badge ${p.active ? 'contact-active' : 'contact-inactive'}">${p.active ? 'Sí' : 'No'}</span></td>
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

    marginLabel(p) {
        const price = parseFloat(p.price || 0), cost = parseFloat(p.cost || 0);
        if (price <= 0) return '—';
        const m = ((price - cost) / price) * 100;
        return m.toFixed(0) + '%';
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
        document.getElementById('product-sku').value = data.sku || '';
        document.getElementById('product-description').value = data.description || '';
        document.getElementById('product-price').value = data.price;
        document.getElementById('product-cost').value = data.cost || 0;
        document.getElementById('product-stock').value = data.stock;
        document.getElementById('product-minstock').value = data.min_stock != null ? data.min_stock : 5;
        document.getElementById('product-category').value = data.category || '';
        document.getElementById('product-iva').value = data.iva_rate != null ? data.iva_rate : 21;
        document.getElementById('product-active').value = data.active ? '1' : '0';
        const preview = document.getElementById('product-image-preview');
        if (data.image_url) { preview.src = data.image_url; preview.style.display = 'block'; }
        else { preview.src = ''; preview.style.display = 'none'; }
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
            document.getElementById('product-image-preview').style.display = 'none';
            modal.style.display = 'flex';
        });
        document.getElementById('btn-cancel-product').addEventListener('click', () => modal.style.display = 'none');
        document.getElementById('product-image').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const preview = document.getElementById('product-image-preview');
                    preview.src = ev.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('product-id').value;

            const productData = {
                name: document.getElementById('product-name').value,
                sku: document.getElementById('product-sku').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                cost: parseFloat(document.getElementById('product-cost').value) || 0,
                stock: parseInt(document.getElementById('product-stock').value),
                min_stock: parseInt(document.getElementById('product-minstock').value) || 0,
                category: document.getElementById('product-category').value,
                iva_rate: parseFloat(document.getElementById('product-iva').value) || 21,
                active: document.getElementById('product-active').value === '1'
            };

            const imageFile = document.getElementById('product-image').files[0];
            if (imageFile) {
                const fileName = `${Date.now()}-${imageFile.name}`;
                const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, imageFile);
                if (uploadError) { alert('Error al subir imagen: ' + uploadError.message); return; }
                const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(fileName);
                productData.image_url = publicUrl;
            }

            const { error } = id ? await supabase.from('products').update(productData).eq('id', id) : await supabase.from('products').insert([productData]);
            if (error) alert('❌ Error: ' + error.message);
            else { modal.style.display = 'none'; e.target.reset(); this.renderProducts(); }
        });
    }

    stockBadge(p) { const min = p.min_stock != null ? p.min_stock : 10; if (p.stock <= 0) return 'stock-out'; if (p.stock <= min) return 'stock-low'; return 'stock-ok'; }
    stockLabel(p) { const min = p.min_stock != null ? p.min_stock : 10; if (p.stock <= 0) return 'Agotado'; if (p.stock <= min) return 'Stock bajo'; return 'En stock'; }

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
                        <label>Categoría</label>
                        <input type="text" id="ticket-category" placeholder="Soporte, Facturación, Envío...">
                        <label>Descripción</label>
                        <textarea id="ticket-description" rows="3" placeholder="Detalles (opcional)"></textarea>
                        <label>Agente asignado</label>
                        <input type="text" id="ticket-agent" placeholder="Nombre del agente">
                        <label>Prioridad</label>
                        <select id="ticket-priority">
                            <option value="low">Baja</option>
                            <option value="medium" selected>Media</option>
                            <option value="high">Alta</option>
                        </select>
                        <label>Fecha límite de resolución</label>
                        <input type="date" id="ticket-due">
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
        const { data, error } = tickets ? { data: tickets, error: null } : await supabase.from('tickets').select('*, contacts(name, email, phone)').order('created_at', { ascending: false });
        if (error) { container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>'; return; }
        if (!data || data.length === 0) { container.innerHTML = '<p>No hay tickets.</p>'; return; }

        const statusLabels = { open: 'Abierto', in_progress: 'En Progreso', resolved: 'Resuelto', closed: 'Cerrado' };
        const priorityLabels = { low: 'Baja', medium: 'Media', high: 'Alta' };

        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Asunto</th><th>Cliente</th><th>Agente</th><th>Prioridad</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${data.map(t => `
                        <tr>
                            <td><strong>${t.subject}</strong>${t.category ? `<br><span class="badge priority-low">${t.category}</span>` : ''}</td>
                            <td>${t.contacts ? t.contacts.name : '—'}</td>
                            <td>${t.assigned_to || '—'}</td>
                            <td><span class="badge priority-${t.priority}">${priorityLabels[t.priority] || t.priority}</span></td>
                            <td>
                                <select class="status-select" data-id="${t.id}">
                                    ${Object.keys(statusLabels).map(s => `<option value="${s}" ${s === t.status ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
                                </select>
                            </td>
                            <td>${this.formatDate(t.created_at)}${t.due_date ? `<br><small style="color:#ef4444;">Vence: ${t.due_date}</small>` : ''}</td>
                            <td>
                                <button class="btn-whatsapp" style="background:#25D366;color:#fff;border:none;border-radius:6px;padding:6px 9px;cursor:pointer;margin-right:4px;" data-id="${t.contact_id || ''}" data-phone="${(t.contacts && t.contacts.phone) || ''}" data-name="${(t.contacts && t.contacts.name) || ''}" data-subject="${(t.subject || '').replace(/"/g, '&quot;')}" title="WhatsApp">💬</button>
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
        container.querySelectorAll('.btn-whatsapp').forEach(btn => btn.addEventListener('click', () => this.openWhatsAppModal({ contactId: btn.dataset.id || null, name: btn.dataset.name, phone: btn.dataset.phone, subject: btn.dataset.subject, source: 'ticket' })));
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
        document.getElementById('ticket-category').value = data.category || '';
        document.getElementById('ticket-description').value = data.description || '';
        document.getElementById('ticket-agent').value = data.assigned_to || '';
        document.getElementById('ticket-priority').value = data.priority;
        document.getElementById('ticket-due').value = data.due_date || '';
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
                category: document.getElementById('ticket-category').value,
                description: document.getElementById('ticket-description').value,
                assigned_to: document.getElementById('ticket-agent').value,
                priority: document.getElementById('ticket-priority').value,
                due_date: document.getElementById('ticket-due').value || null,
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
                            <option value="admin">👨‍ Agente</option>
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
                        <label>Descuento (%)</label>
                        <input type="number" id="order-discount" min="0" max="100" value="0">
                        <label>Método de pago</label>
                        <select id="order-payment"><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="paypal">PayPal</option></select>
                        <label>Dirección de envío</label>
                        <input type="text" id="order-shipping" placeholder="Calle, número, CP, ciudad">
                        <label>Fecha estimada de entrega</label>
                        <input type="date" id="order-delivery">
                        <label>Notas del pedido</label>
                        <textarea id="order-notes" rows="2" placeholder="Observaciones"></textarea>
                        <div class="order-total">Total: <strong id="order-total">0,00 €</strong></div>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-order">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Pedido</button>
                        </div>
                    </form>
                </div>
            </div>
            <div class="modal-overlay" id="order-edit-modal">
                <div class="modal">
                    <h3>Editar Pedido</h3>
                    <form id="order-edit-form">
                        <input type="hidden" id="order-edit-id">
                        <label>Estado</label>
                        <select id="order-edit-status">
                            <option value="pending">Pendiente</option><option value="processing">Procesando</option><option value="shipped">Enviado</option><option value="delivered">Entregado</option><option value="cancelled">Cancelado</option>
                        </select>
                        <label>Método de pago</label>
                        <select id="order-edit-payment"><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="efectivo">Efectivo</option><option value="paypal">PayPal</option></select>
                        <label>Descuento (%)</label>
                        <input type="number" id="order-edit-discount" min="0" max="100" value="0">
                        <label>Dirección de envío</label>
                        <input type="text" id="order-edit-shipping">
                        <label>Fecha estimada de entrega</label>
                        <input type="date" id="order-edit-delivery">
                        <label>Notas del pedido</label>
                        <textarea id="order-edit-notes" rows="2"></textarea>
                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" id="btn-cancel-order-edit">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Cambios</button>
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
        const { data, error } = await supabase.from('orders').select('*, contacts(name, phone)').order('created_at', { ascending: false });
        if (error) { container.innerHTML = '<p class="error">❌ Error: ' + error.message + '</p>'; return; }
        if (!data || data.length === 0) { container.innerHTML = '<p>No hay pedidos.</p>'; return; }

        const statusLabels = { pending: 'Pendiente', processing: 'Procesando', shipped: 'Enviado', delivered: 'Entregado', cancelled: 'Cancelado' };
        const paymentLabels = { transferencia: 'Transferencia', tarjeta: 'Tarjeta', efectivo: 'Efectivo', paypal: 'PayPal' };
        container.innerHTML = `
            <table class="data-table">
                <thead><tr><th>Nº Pedido</th><th>Factura</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
                <tbody>
                    ${data.map(o => `
                        <tr>
                            <td><strong>${o.order_number}</strong></td>
                            <td>${o.invoice_number || '—'}</td>
                            <td>${o.contacts ? o.contacts.name : '—'}</td>
                            <td><strong>${this.formatCurrency(parseFloat(o.total))}</strong></td>
                            <td>${paymentLabels[o.payment_method] || 'Transferencia'}</td>
                            <td>
                                <select class="status-select" data-id="${o.id}">
                                    ${Object.keys(statusLabels).map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${statusLabels[s]}</option>`).join('')}
                                </select>
                            </td>
                            <td>${this.formatDate(o.created_at)}</td>
                            <td>
                                <button class="btn-whatsapp" style="background:#25D366;color:#fff;border:none;border-radius:6px;padding:6px 9px;cursor:pointer;margin-right:4px;" data-id="${o.contact_id || ''}" data-phone="${(o.contacts && o.contacts.phone) || ''}" data-name="${(o.contacts && o.contacts.name) || ''}" data-order="${o.order_number}" data-total="${o.total}" data-date="${o.delivery_date || ''}" title="WhatsApp">💬</button>
                                <button class="btn-edit" data-id="${o.id}" title="Editar pedido"><i class="fas fa-edit"></i></button>
                                <button class="btn-edit btn-invoice" data-id="${o.id}" title="Descargar factura en PDF">📄</button>
                            </td>
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
        container.querySelectorAll('.btn-whatsapp').forEach(btn => btn.addEventListener('click', () => this.openWhatsAppModal({ contactId: btn.dataset.id || null, name: btn.dataset.name, phone: btn.dataset.phone, order: btn.dataset.order, total: btn.dataset.total, date: btn.dataset.date, source: 'pedido' })));
        container.querySelectorAll('.btn-invoice').forEach(btn => btn.addEventListener('click', () => this.generateInvoicePDF(btn.dataset.id)));
        container.querySelectorAll('.btn-edit:not(.btn-invoice)').forEach(btn => btn.addEventListener('click', () => this.editOrder(btn.dataset.id)));
    }

    async editOrder(id) {
        const { data } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!data) return;
        document.getElementById('order-edit-id').value = data.id;
        document.getElementById('order-edit-status').value = data.status;
        document.getElementById('order-edit-payment').value = data.payment_method || 'transferencia';
        document.getElementById('order-edit-discount').value = data.discount || 0;
        document.getElementById('order-edit-shipping').value = data.shipping_address || '';
        document.getElementById('order-edit-delivery').value = data.delivery_date || '';
        document.getElementById('order-edit-notes').value = data.notes || '';
        document.getElementById('order-edit-modal').style.display = 'flex';
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
        const editModal = document.getElementById('order-edit-modal');
        document.getElementById('btn-new-order').addEventListener('click', () => modal.style.display = 'flex');
        document.getElementById('btn-cancel-order').addEventListener('click', () => modal.style.display = 'none');
        document.getElementById('btn-cancel-order-edit').addEventListener('click', () => editModal.style.display = 'none');

        const updateTotal = () => {
            const productId = document.getElementById('order-product').value;
            const qty = parseInt(document.getElementById('order-quantity').value) || 0;
            const disc = parseFloat(document.getElementById('order-discount').value) || 0;
            const product = (this.productsCache || []).find(p => p.id === productId);
            const subtotal = product ? parseFloat(product.price) * qty : 0;
            document.getElementById('order-total').textContent = this.formatCurrency(subtotal * (1 - disc / 100));
        };
        document.getElementById('order-product').addEventListener('change', updateTotal);
        document.getElementById('order-quantity').addEventListener('input', updateTotal);
        document.getElementById('order-discount').addEventListener('input', updateTotal);

        document.getElementById('order-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const productId = document.getElementById('order-product').value;
            const qty = parseInt(document.getElementById('order-quantity').value);
            const disc = parseFloat(document.getElementById('order-discount').value) || 0;
            const product = (this.productsCache || []).find(p => p.id === productId);
            if (!product) { alert('Selecciona un producto'); return; }
            const subtotal = parseFloat(product.price) * qty;
            const total = subtotal * (1 - disc / 100);
            const { data: order, error } = await supabase.from('orders').insert([{
                contact_id: document.getElementById('order-contact').value,
                order_number: 'ORD-' + Date.now().toString().slice(-6),
                status: 'pending',
                total,
                discount: disc,
                payment_method: document.getElementById('order-payment').value,
                shipping_address: document.getElementById('order-shipping').value,
                delivery_date: document.getElementById('order-delivery').value || null,
                notes: document.getElementById('order-notes').value
            }]).select().single();
            if (error) { alert('Error: ' + error.message); return; }
            await supabase.from('order_items').insert([{ order_id: order.id, product_id: productId, quantity: qty, unit_price: parseFloat(product.price) }]);
            await supabase.from('products').update({ stock: Math.max(0, product.stock - qty) }).eq('id', productId);
            modal.style.display = 'none'; e.target.reset(); this.renderOrders();
        });

        document.getElementById('order-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('order-edit-id').value;
            const { error } = await supabase.from('orders').update({
                status: document.getElementById('order-edit-status').value,
                payment_method: document.getElementById('order-edit-payment').value,
                discount: parseFloat(document.getElementById('order-edit-discount').value) || 0,
                shipping_address: document.getElementById('order-edit-shipping').value,
                delivery_date: document.getElementById('order-edit-delivery').value || null,
                notes: document.getElementById('order-edit-notes').value
            }).eq('id', id);
            if (error) alert('❌ Error: ' + error.message);
            else { editModal.style.display = 'none'; this.renderOrders(); }
        });
    }

    // ================= FACTURA PDF =================
    async loadImageDataUrl(url) {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            return await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
            });
        } catch (e) { return null; }
    }

    async generateInvoicePDF(orderId) {
        if (typeof window.jspdf === 'undefined') { alert('❌ Falta cargar jsPDF en index.html'); return; }
        const { jsPDF } = window.jspdf;

        const { data: order } = await supabase.from('orders').select('*, contacts(name, email, company, city, tax_id, address)').eq('id', orderId).single();
        if (!order) { alert('Pedido no encontrado'); return; }
        const { data: items } = await supabase.from('order_items').select('*, products(name, iva_rate)').eq('order_id', orderId);
        const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();

        const series = (settings && settings.invoice_series) || 'F';
        let invoiceNumber = order.invoice_number;
        if (!invoiceNumber) {
            const start = parseInt((settings && settings.invoice_start) || 1, 10);
            const counter = Math.max(parseInt((settings && settings.invoice_counter) || 0, 10), start - 1) + 1;
            const year = new Date().getFullYear();
            invoiceNumber = series + '-' + year + '-' + String(counter).padStart(4, '0');
            await supabase.from('settings').update({ invoice_counter: counter }).eq('id', 1);
            await supabase.from('orders').update({ invoice_number: invoiceNumber }).eq('id', orderId);
        }

        const money = (n) => parseFloat(n || 0).toFixed(2) + ' EUR';
        const doc = new jsPDF();
        const company = (settings && settings.company_name) ? settings.company_name : 'Mi Empresa';
        const defaultRate = parseFloat((settings && settings.iva_rate) || 21);

        let cx = 15, cy0 = 20;
        if (settings && settings.logo_url) {
            const dataUrl = await this.loadImageDataUrl(settings.logo_url);
            if (dataUrl) {
                const fmt = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
                const img = new Image();
                await new Promise(r => { img.onload = r; img.src = dataUrl; });
                const ratio = img.width / img.height || 1;
                let h = 16, w = h * ratio;
                if (w > 55) { w = 55; h = w / ratio; }
                try { doc.addImage(dataUrl, fmt, 15, 10, w, h); cx = 15 + w + 5; cy0 = 18; } catch (e) {}
            }
        }

        doc.setFontSize(18); doc.setTextColor(37, 99, 235);
        doc.text(company, cx, cy0);
        doc.setFontSize(9); doc.setTextColor(90);
        let hy = cy0 + 6;
        if (settings && settings.address) { doc.text(settings.address, cx, hy); hy += 5; }
        if (settings && settings.tax_id) { doc.text('CIF/NIF: ' + settings.tax_id, cx, hy); hy += 5; }
        const contactLine = [settings && settings.email, settings && settings.phone].filter(Boolean).join('  |  ');
        if (contactLine) doc.text(contactLine, cx, hy);

        doc.setFontSize(16); doc.setTextColor(0);
        doc.text('FACTURA', 195, 20, { align: 'right' });
        doc.setFontSize(10);
        doc.text('Nº: ' + invoiceNumber, 195, 26, { align: 'right' });
        doc.text('Pedido: ' + order.order_number, 195, 31, { align: 'right' });
        doc.text('Fecha: ' + new Date(order.created_at).toLocaleDateString('es-ES'), 195, 36, { align: 'right' });

        doc.setDrawColor(200); doc.line(15, 44, 195, 44);

        doc.setFontSize(11); doc.setTextColor(0);
        doc.text('Facturar a:', 15, 52);
        doc.setFontSize(10); doc.setTextColor(60);
        let cy = 58;
        const ct = order.contacts || {};
        doc.text(ct.name || 'Cliente', 15, cy); cy += 5;
        if (ct.company) { doc.text(ct.company, 15, cy); cy += 5; }
        if (ct.address) { doc.text(ct.address, 15, cy); cy += 5; }
        if (ct.tax_id) { doc.text('CIF/NIF: ' + ct.tax_id, 15, cy); cy += 5; }
        if (ct.email) { doc.text(ct.email, 15, cy); cy += 5; }

        if (order.shipping_address) {
            doc.setFontSize(11); doc.setTextColor(0);
            doc.text('Enviar a:', 110, 52);
            doc.setFontSize(10); doc.setTextColor(60);
            doc.text(order.shipping_address, 110, 58, { maxWidth: 80 });
        }

        let y = Math.max(cy + 6, 78);
        doc.setFillColor(37, 99, 235); doc.rect(15, y - 6, 180, 8, 'F');
        doc.setTextColor(255); doc.setFontSize(10);
        doc.text('Concepto', 17, y - 1);
        doc.text('Cant.', 115, y - 1);
        doc.text('Precio', 140, y - 1);
        doc.text('Subtotal', 193, y - 1, { align: 'right' });
        doc.setTextColor(0);
        y += 6;

        const lines = items || [];
        const linesSum = lines.reduce((s, it) => s + (it.quantity || 0) * parseFloat(it.unit_price || 0), 0);
        const factor = linesSum > 0 ? (parseFloat(order.total || 0) / linesSum) : 1;

        lines.forEach((it) => {
            const name = (it.products && it.products.name) ? it.products.name : 'Producto';
            const qty = it.quantity || 0;
            const unit = parseFloat(it.unit_price || 0);
            const sub = qty * unit;
            doc.text(name.substring(0, 45), 17, y);
            doc.text(String(qty), 115, y);
            doc.text(money(unit), 140, y);
            doc.text(money(sub), 193, y, { align: 'right' });
            doc.setDrawColor(230); doc.line(15, y + 2, 195, y + 2);
            y += 8;
        });

        const discountPct = parseFloat(order.discount || 0);
        if (discountPct > 0) {
            doc.setTextColor(220, 38, 38);
            doc.text('Descuento (' + discountPct + '%):', 140, y);
            doc.text('-' + money(linesSum - parseFloat(order.total || 0)), 193, y, { align: 'right' });
            doc.setTextColor(0);
            y += 7;
        }

        const groups = {};
        lines.forEach((it) => {
            const rate = parseFloat((it.products && it.products.iva_rate) || defaultRate);
            const sub = (it.quantity || 0) * parseFloat(it.unit_price || 0) * factor;
            const base = sub / (1 + rate / 100);
            if (!groups[rate]) groups[rate] = { base: 0, quota: 0 };
            groups[rate].base += base;
            groups[rate].quota += sub - base;
        });

        y += 4;
        doc.setFontSize(10); doc.setTextColor(60);
        Object.keys(groups).forEach(rate => {
            doc.text('Base imponible (' + rate + '%):', 120, y); doc.text(money(groups[rate].base), 193, y, { align: 'right' }); y += 5;
            doc.text('IVA (' + rate + '%):', 120, y); doc.text(money(groups[rate].quota), 193, y, { align: 'right' }); y += 6;
        });
        doc.setFontSize(13); doc.setTextColor(0);
        doc.text('TOTAL:', 120, y); doc.text(money(order.total), 193, y, { align: 'right' });

        y += 12;
        doc.setFontSize(9); doc.setTextColor(60);
        const payLabels = { transferencia: 'Transferencia bancaria', tarjeta: 'Tarjeta', efectivo: 'Efectivo', paypal: 'PayPal' };
        doc.text('Forma de pago: ' + (payLabels[order.payment_method] || 'Transferencia bancaria'), 15, y);
        if (settings && settings.iban) doc.text('IBAN: ' + settings.iban, 15, y + 5);
        if (order.delivery_date) doc.text('Entrega estimada: ' + order.delivery_date, 15, y + 10);
        if (order.notes) { doc.text('Observaciones: ' + order.notes, 15, y + 15, { maxWidth: 120 }); }

        doc.setFontSize(8); doc.setTextColor(140);
        const footer = (settings && settings.invoice_footer) ? settings.invoice_footer : 'Gracias por su compra. Documento generado automáticamente por MiCRM.';
        doc.text(footer, 15, 285, { maxWidth: 180 });

        doc.save('factura-' + invoiceNumber + '.pdf');
    }

    // ================= REPORTES CON CHART.JS =================
    async loadReports() {
        const content = document.querySelector('.content');
        content.innerHTML = '<p>Cargando reportes...</p>';

        if (typeof Chart === 'undefined') {
            content.innerHTML = '<div class="card"><div class="card-body"><p>❌ Falta cargar Chart.js en index.html</p></div></div>';
            return;
        }

        Object.values(this.charts).forEach(ch => { try { ch.destroy(); } catch (e) {} });
        this.charts = {};

        const { data: tickets } = await supabase.from('tickets').select('status');
        const { data: contacts } = await supabase.from('contacts').select('id');
        const { data: orders } = await supabase.from('orders').select('total, status, created_at');
        const { data: items } = await supabase.from('order_items').select('quantity, products(name)');

        const t = tickets || [], c = contacts || [], o = orders || [], it = items || [];

        const openTickets = t.filter(x => x.status === 'open' || x.status === 'in_progress').length;
        const resolvedTickets = t.filter(x => x.status === 'resolved' || x.status === 'closed').length;
        const revenue = o.filter(x => x.status !== 'cancelled').reduce((sum, x) => sum + parseFloat(x.total), 0);
        const unitsSold = it.reduce((sum, x) => sum + x.quantity, 0);

        const monthLabels = [], revenueByMonth = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            monthLabels.push(d.toLocaleDateString('es-ES', { month: 'short' }));
            const sum = o.filter(x => x.status !== 'cancelled' && x.created_at && x.created_at.slice(0, 7) === key)
                         .reduce((s, x) => s + parseFloat(x.total), 0);
            revenueByMonth.push(sum);
        }

        const prodMap = {};
        it.forEach(x => {
            const name = (x.products && x.products.name) ? x.products.name : 'Producto';
            prodMap[name] = (prodMap[name] || 0) + x.quantity;
        });
        const top = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const orderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        const orderLabels = ['Pendiente', 'Procesando', 'Enviado', 'Entregado', 'Cancelado'];
        const orderCounts = orderStatuses.map(s => o.filter(x => x.status === s).length);

        const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed'];
        const ticketLabels = ['Abierto', 'En Progreso', 'Resuelto', 'Cerrado'];
        const ticketCounts = ticketStatuses.map(s => t.filter(x => x.status === s).length);

        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-icon" style="background: #3b82f6;"><i class="fas fa-ticket-alt"></i></div><div class="stat-info"><h3>Tickets Abiertos</h3><p class="stat-number">${openTickets}</p><span class="stat-change positive">${resolvedTickets} resueltos</span></div></div>
                <div class="stat-card"><div class="stat-icon" style="background: #10b981;"><i class="fas fa-users"></i></div><div class="stat-info"><h3>Clientes</h3><p class="stat-number">${c.length}</p></div></div>
                <div class="stat-card"><div class="stat-icon" style="background: #f59e0b;"><i class="fas fa-shopping-cart"></i></div><div class="stat-info"><h3>Unidades Vendidas</h3><p class="stat-number">${unitsSold}</p></div></div>
                <div class="stat-card"><div class="stat-icon" style="background: #8b5cf6;"><i class="fas fa-euro-sign"></i></div><div class="stat-info"><h3>Ingresos</h3><p class="stat-number">${this.formatCurrency(revenue)}</p></div></div>
            </div>
            <div class="grid-2col">
                <div class="card"><div class="card-header"><h3>💰 Ingresos por mes</h3></div><div class="card-body"><div style="position:relative;height:260px;"><canvas id="chart-revenue"></canvas></div></div></div>
                <div class="card"><div class="card-header"><h3>📦 Pedidos por estado</h3></div><div class="card-body"><div style="position:relative;height:260px;"><canvas id="chart-orders"></canvas></div></div></div>
                <div class="card"><div class="card-header"><h3>🎫 Tickets por estado</h3></div><div class="card-body"><div style="position:relative;height:260px;"><canvas id="chart-tickets"></canvas></div></div></div>
                <div class="card"><div class="card-header"><h3>🏆 Top productos vendidos</h3></div><div class="card-body"><div style="position:relative;height:260px;"><canvas id="chart-top"></canvas></div></div></div>
            </div>
        `;

        const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

        this.charts.revenue = new Chart(document.getElementById('chart-revenue'), {
            type: 'line',
            data: { labels: monthLabels, datasets: [{ label: 'Ingresos (€)', data: revenueByMonth, borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)', fill: true, tension: 0.35, pointRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });

        this.charts.orders = new Chart(document.getElementById('chart-orders'), {
            type: 'bar',
            data: { labels: orderLabels, datasets: [{ label: 'Pedidos', data: orderCounts, backgroundColor: palette }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
        });

        this.charts.tickets = new Chart(document.getElementById('chart-tickets'), {
            type: 'doughnut',
            data: { labels: ticketLabels, datasets: [{ data: ticketCounts, backgroundColor: palette }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        this.charts.top = new Chart(document.getElementById('chart-top'), {
            type: 'bar',
            data: { labels: top.map(x => x[0]), datasets: [{ label: 'Unidades', data: top.map(x => x[1]), backgroundColor: '#10b981' }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
        });
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
                            <label>CIF / NIF</label><input type="text" id="set-taxid" placeholder="B12345678">
                            <label>Dirección fiscal</label><input type="text" id="set-address" placeholder="Calle, número, CP, ciudad">
                            <label>Email de contacto</label><input type="email" id="set-email" placeholder="info@empresa.com">
                            <label>Teléfono</label><input type="text" id="set-phone" placeholder="+34 900 000 000">
                            <label>IBAN</label><input type="text" id="set-iban" placeholder="ES00 0000 0000 0000 0000 0000">
                            <label>IVA por defecto (%)</label><input type="number" id="set-iva" step="0.1" value="21">
                            <label>Moneda</label>
                            <select id="set-currency"><option value="EUR">EUR (€)</option><option value="USD">USD ($)</option><option value="MXN">MXN ($)</option></select>
                            <div class="modal-actions"><button type="submit" class="btn btn-primary">Guardar Cambios</button></div>
                            <p id="settings-saved" class="saved-msg"></p>
                        </form>
                    </div>
                </div>
                <div>
                    <div class="card">
                        <div class="card-header"><h3><i class="fas fa-file-invoice"></i> Facturación</h3></div>
                        <div class="card-body">
                            <form id="invoice-form" class="settings-form">
                                <label>Logo de la empresa (PDF)</label>
                                <input type="file" id="set-logo" accept="image/*">
                                <img id="set-logo-preview" style="max-width:120px;margin-top:8px;display:none;border-radius:6px;">
                                <input type="hidden" id="set-logo-url">
                                <label>Serie de factura</label>
                                <input type="text" id="set-series" value="F" placeholder="F">
                                <label>Número de inicio</label>
                                <input type="number" id="set-start" value="1" min="1">
                                <label>Texto legal / pie de factura</label>
                                <textarea id="set-footer" rows="3" placeholder="Gracias por su compra..."></textarea>
                                <div class="modal-actions"><button type="submit" class="btn btn-primary">Guardar Facturación</button></div>
                                <p id="invoice-saved" class="saved-msg"></p>
                            </form>
                        </div>
                    </div>
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
            document.getElementById('set-taxid').value = data.tax_id || '';
            document.getElementById('set-address').value = data.address || '';
            document.getElementById('set-email').value = data.email || '';
            document.getElementById('set-phone').value = data.phone || '';
            document.getElementById('set-iban').value = data.iban || '';
            document.getElementById('set-iva').value = data.iva_rate || 21;
            document.getElementById('set-currency').value = data.currency || 'EUR';
            document.getElementById('set-series').value = data.invoice_series || 'F';
            document.getElementById('set-start').value = data.invoice_start || 1;
            document.getElementById('set-footer').value = data.invoice_footer || '';
            document.getElementById('set-logo-url').value = data.logo_url || '';
            const lp = document.getElementById('set-logo-preview');
            if (data.logo_url) { lp.src = data.logo_url; lp.style.display = 'block'; }
        }
        document.getElementById('set-url').textContent = '🔗 ' + supabase.supabaseUrl;

        document.getElementById('set-logo').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const fileName = `config/logo-${Date.now()}-${file.name}`;
            const { error } = await supabase.storage.from('product-images').upload(fileName, file);
            if (error) { alert('Error al subir logo: ' + error.message); return; }
            const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
            document.getElementById('set-logo-url').value = urlData.publicUrl;
            const lp = document.getElementById('set-logo-preview');
            lp.src = urlData.publicUrl; lp.style.display = 'block';
        });

        document.getElementById('settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { error } = await supabase.from('settings').update({
                company_name: document.getElementById('set-company').value,
                tax_id: document.getElementById('set-taxid').value,
                address: document.getElementById('set-address').value,
                email: document.getElementById('set-email').value,
                phone: document.getElementById('set-phone').value,
                iban: document.getElementById('set-iban').value,
                iva_rate: parseFloat(document.getElementById('set-iva').value) || 21,
                currency: document.getElementById('set-currency').value
            }).eq('id', 1);
            const msg = document.getElementById('settings-saved');
            msg.textContent = error ? '❌ Error al guardar' : '✅ Cambios guardados';
            setTimeout(() => msg.textContent = '', 2500);
        });

        document.getElementById('invoice-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const { error } = await supabase.from('settings').update({
                logo_url: document.getElementById('set-logo-url').value || null,
                invoice_series: document.getElementById('set-series').value || 'F',
                invoice_start: parseInt(document.getElementById('set-start').value) || 1,
                invoice_footer: document.getElementById('set-footer').value
            }).eq('id', 1);
            const msg = document.getElementById('invoice-saved');
            msg.textContent = error ? '❌ Error al guardar' : '✅ Facturación guardada';
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
    fixStoreButton() {
        const candidates = document.querySelectorAll('.sidebar a, .sidebar button, .sidebar .btn');
        candidates.forEach(el => {
            if ((el.textContent || '').trim().includes('Ver Tienda Pública')) {
                el.style.display = 'block';
                el.style.width = 'auto';
                el.style.margin = '10px 14px';
                el.style.padding = '10px 12px';
                el.style.borderRadius = '8px';
                el.style.textAlign = 'center';
                el.style.boxSizing = 'border-box';
            }
        });
    }
        // ================= IDIOMAS (ES / FR / AR) =================
    i18nDict() {
        return {
            fr: {
                'Dashboard':'Tableau de bord','Tickets':'Tickets','Contactos':'Contacts','Productos':'Produits','Pedidos':'Commandes','Reportes':'Rapports','WhatsApp':'WhatsApp','Configuración':'Paramètres','Salir':'Déconnexion','Ver Tienda Pública':'Voir la boutique','Buscar...':'Rechercher...','Desarrollo':'Développement',
                'Tickets Abiertos':'Tickets ouverts','Clientes':'Clients','Pedidos Pendientes':'Commandes en attente','Ingresos Mensuels':'Revenus mensuels','Ingresos Mensuales':'Revenus mensuels','Ver todos':'Tout voir','Tickets Recientes':'Tickets récents','Pedidos Recientes':'Commandes récentes',
                'Gestión de Contactos':'Gestion des contacts','Gestión de Tickets':'Gestion des tickets','Gestión de Pedidos':'Gestion des commandes','Catálogo de Productos':'Catalogue produits','Nuevo Cliente':'Nouveau client','Nuevo Producto':'Nouveau produit','Nuevo Ticket':'Nouveau ticket','Nuevo Pedido':'Nouvelle commande',
                'Nombre':'Nom','Email':'Email','Teléfono':'Téléphone','Precio':'Prix','Stock':'Stock','Estado':'Statut','Acciones':'Actions','Categoría':'Catégorie','Total':'Total','Fecha':'Date','Cliente':'Client','Guardar':'Enregistrer','Cancelar':'Annuler','Eliminar':'Supprimer','Editar':'Modifier',
                'Nuevo mensaje':'Nouveau message','Historial de envíos':'Historique des envois','Abrir WhatsApp y registrar':'Ouvrir WhatsApp et enregistrer','Plantilla':'Modèle','Mensaje':'Message'
            },
            ar: {
                'Dashboard':'لوحة التحكم','Tickets':'التذاكر','Contactos':'جهات الاتصال','Productos':'المنتجات','Pedidos':'الطلبات','Reportes':'التقارير','WhatsApp':'واتساب','Configuración':'الإعدادات','Salir':'تسجيل الخروج','Ver Tienda Pública':'عرض المتجر','Buscar...':'بحث...','Desarrollo':'تطوير',
                'Tickets Abiertos':'تذاكر مفتوحة','Clientes':'العملاء','Pedidos Pendientes':'طلبات معلقة','Ingresos Mensuales':'الدخل الشهري','Ver todos':'عرض الكل','Tickets Recientes':'أحدث التذاكر','Pedidos Recientes':'أحدث الطلبات',
                'Gestión de Contactos':'إدارة جهات الاتصال','Gestión de Tickets':'إدارة التذاكر','Gestión de Pedidos':'إدارة الطلبات','Catálogo de Productos':'كتالوج المنتجات','Nuevo Cliente':'عميل جديد','Nuevo Producto':'منتج جديد','Nuevo Ticket':'تذكرة جديدة','Nuevo Pedido':'طلب جديد',
                'Nombre':'الاسم','Email':'البريد الإلكتروني','Teléfono':'الهاتف','Precio':'السعر','Stock':'المخزون','Estado':'الحالة','Acciones':'إجراءات','Categoría':'الفئة','Total':'الإجمالي','Fecha':'التاريخ','Cliente':'العميل','Guardar':'حفظ','Cancelar':'إلغاء','Eliminar':'حذف','Editar':'تعديل',
                'Nuevo mensaje':'رسالة جديدة','Historial de envíos':'سجل الإرسالات','Abrir WhatsApp y registrar':'فتح واتساب وتسجيل','Plantilla':'قالب','Mensaje':'الرسالة'
            }
        };
    }

    injectLanguageSelector() {
        const userMenu = document.querySelector('.user-menu');
        if (!userMenu || document.getElementById('lang-select')) return;
        const sel = document.createElement('select');
        sel.id = 'lang-select';
        sel.style.cssText = 'margin-right:8px;padding:4px 6px;border-radius:6px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:14px;';
        sel.innerHTML = '<option value="es">🇪 ES</option><option value="fr">🇫🇷 FR</option><option value="ar">🇸🇦 AR</option>';
        sel.value = this.lang || 'es';
        sel.addEventListener('change', () => this.applyLanguage(sel.value));
        userMenu.insertBefore(sel, userMenu.firstChild);
    }

    applyLanguage(lang) {
        this.lang = lang;
        localStorage.setItem('crm_lang', lang);
        document.documentElement.lang = lang;
        document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
        const sel = document.getElementById('lang-select');
        if (sel) sel.value = lang;
        this.translatePage(document.body);
    }

    translatePage(root) {
        const dict = (this.lang && this.lang !== 'es') ? (this.i18nDict()[this.lang] || {}) : null;
        if (!this._esText) this._esText = new WeakMap();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            if (!this._esText.has(node)) this._esText.set(node, node.nodeValue);
            const original = this._esText.get(node);
            const key = original.trim();
            if (!key) return;
            let target;
            if (dict && dict[key]) target = original.replace(key, dict[key]);
            else if (!dict) target = original;
            else return;
            if (node.nodeValue !== target) node.nodeValue = target;
        });
    }

    observeTranslations() {
        if (this._i18nObserver) return;
        let timer = null;
        this._i18nObserver = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => this.translatePage(document.body), 60);
        });
        this._i18nObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
    }

    formatDate(date) { return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date)); }
    formatCurrency(amount) { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount); }
}

new CRMApp();
