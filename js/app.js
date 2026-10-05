// CRM + Tienda Online - Lógica principal
import { supabase } from './supabase-config.js';

class CRMApp {
    constructor() {
        this.init();
    }

    async init() {
        this.setupNavigation();
        this.setupMenuToggle();
        await this.checkAuth();
        console.log('🚀 CRM + Tienda Online iniciado');
    }

    // Navegación del sidebar
    setupNavigation() {
        const links = document.querySelectorAll('.nav-link');

        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                // Quitar clase active de todos
                links.forEach(l => l.classList.remove('active'));

                // Añadir clase active al clicado
                link.classList.add('active');

                // Actualizar título de la página
                const pageTitle = link.textContent.trim();
                document.getElementById('page-title').textContent = pageTitle;

                // Cargar página según sección
                const pageId = link.getAttribute('href').substring(1);
                this.loadPage(pageId);
            });
        });
    }

    // Menú móvil
    setupMenuToggle() {
        const menuToggle = document.querySelector('.menu-toggle');
        const sidebar = document.querySelector('.sidebar');

        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }
    }

    // Cargar páginas
    async loadPage(pageId) {
        switch (pageId) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'tickets':
                console.log('Cargando tickets...');
                break;
            case 'contacts':
                console.log('Cargando contactos...');
                break;
            case 'products':
                console.log('Cargando productos...');
                break;
            case 'orders':
                console.log('Cargando pedidos...');
                break;
            default:
                console.log('Página: ' + pageId);
        }
    }

    // Cargar datos del dashboard desde Supabase
    async loadDashboard() {
        try {
            const { data: tickets } = await supabase
                .from('tickets')
                .select('*')
                .eq('status', 'open');

            const { data: contacts } = await supabase
                .from('contacts')
                .select('*');

            const { data: orders } = await supabase
                .from('orders')
                .select('*')
                .eq('status', 'pending');

            console.log('📊 Datos cargados:', { tickets, contacts, orders });
        } catch (error) {
            console.error('Error cargando dashboard:', error);
        }
    }

    // Verificar autenticación
    async checkAuth() {
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            console.log('👤 Usuario:', user.email);
            const userMenu = document.querySelector('.user-menu span');
            if (userMenu) {
                userMenu.textContent = user.email.split('@')[0];
            }
        } else {
            console.log('👤 Sin usuario autenticado');
        }
    }

    // Utilidades
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(new Date(date));
    }
}

// Iniciar aplicación
new CRMApp();
