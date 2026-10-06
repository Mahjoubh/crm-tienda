import { supabase } from './supabase-config.js';

class Tienda {
    constructor() {
        this.cart = JSON.parse(localStorage.getItem('cart') || '[]');
        this.products = [];
        this.init();
    }

    async init() {
        await this.loadProducts();
        this.renderCartCount();
        this.setupEvents();
    }

    async loadProducts() {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('active', true)
            .order('name');

        if (error) {
            document.getElementById('products-grid').innerHTML = '<p>Error al cargar productos</p>';
            return;
        }

        this.products = data || [];
        this.renderProducts();
    }

    renderProducts() {
        const grid = document.getElementById('products-grid');
        if (this.products.length === 0) {
            grid.innerHTML = '<p>No hay productos disponibles.</p>';
            return;
        }
        grid.innerHTML = this.products.map(p => `
            <div class="t-product">
                ${p.image_url ? `<img src="${p.image_url}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:15px;">` : '<div class="t-product-img"><i class="fas fa-box"></i></div>'}
                <h3>${p.name}</h3>
                <p class="t-desc">${p.description || ''}</p>
                <p class="t-price">${this.money(parseFloat(p.price))}</p>
                <button class="t-btn" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
                    ${p.stock <= 0 ? 'Agotado' : '<i class="fas fa-cart-plus"></i> Añadir'}
                </button>
            </div>
        `).join('');

        grid.querySelectorAll('.t-btn').forEach(btn => {
            btn.addEventListener('click', () => this.addToCart(btn.dataset.id));
        });
    }

    addToCart(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;
        const item = this.cart.find(i => i.id === id);
        if (item) item.qty += 1;
        else this.cart.push({ id, name: product.name, price: parseFloat(product.price), qty: 1 });
        this.saveCart();
    }

    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
        this.renderCartCount();
        this.renderCart();
    }

    renderCartCount() {
        document.getElementById('cart-count').textContent =
            this.cart.reduce((s, i) => s + i.qty, 0);
    }

    cartTotal() {
        return this.cart.reduce((s, i) => s + i.price * i.qty, 0);
    }

    renderCart() {
        const container = document.getElementById('cart-items');
        if (this.cart.length === 0) {
            container.innerHTML = '<p class="t-empty">Tu carrito está vacío</p>';
        } else {
            container.innerHTML = this.cart.map(i => `
                <div class="t-cart-item">
                    <div>
                        <strong>${i.name}</strong><br>
                        <small>${this.money(i.price)} x ${i.qty}</small>
                    </div>
                    <div class="t-cart-actions">
                        <button data-id="${i.id}" data-action="minus">−</button>
                        <button data-id="${i.id}" data-action="plus">+</button>
                        <button data-id="${i.id}" data-action="remove">🗑</button>
                    </div>
                </div>
            `).join('');
        }
        document.getElementById('cart-total').textContent = this.money(this.cartTotal());

        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const item = this.cart.find(i => i.id === id);
                if (btn.dataset.action === 'plus') item.qty += 1;
                if (btn.dataset.action === 'minus') {
                    item.qty -= 1;
                    if (item.qty <= 0) this.cart = this.cart.filter(i => i.id !== id);
                }
                if (btn.dataset.action === 'remove') this.cart = this.cart.filter(i => i.id !== id);
                this.saveCart();
            });
        });
    }

    setupEvents() {
        document.getElementById('cart-btn').addEventListener('click', () => {
            this.renderCart();
            document.getElementById('cart-overlay').style.display = 'flex';
        });
        document.getElementById('cart-close').addEventListener('click', () => {
            document.getElementById('cart-overlay').style.display = 'none';
        });
        document.getElementById('checkout-btn').addEventListener('click', () => {
            if (this.cart.length === 0) { alert('Tu carrito está vacío'); return; }
            document.getElementById('cart-overlay').style.display = 'none';
            document.getElementById('checkout-overlay').style.display = 'flex';
        });
        document.getElementById('checkout-close').addEventListener('click', () => {
            document.getElementById('checkout-overlay').style.display = 'none';
        });
        document.getElementById('checkout-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.placeOrder();
        });
    }

    async placeOrder() {
        const name = document.getElementById('co-name').value;
        const email = document.getElementById('co-email').value;

        // Buscar o crear cliente
        let { data: contacts } = await supabase.from('contacts').select('id').eq('email', email);
        let contactId;
        if (contacts && contacts.length > 0) {
            contactId = contacts[0].id;
        } else {
            const { data: newContact, error } = await supabase
                .from('contacts')
                .insert([{ name, email, status: 'active' }])
                .select().single();
            if (error) { alert('Error: ' + error.message); return; }
            contactId = newContact.id;
        }

        // Crear pedido
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert([{
                contact_id: contactId,
                order_number: 'WEB-' + Date.now().toString().slice(-6),
                status: 'pending',
                total: this.cartTotal()
            }])
            .select().single();

        if (orderError) { alert('Error: ' + orderError.message); return; }

        // Items + descontar stock
        for (const item of this.cart) {
            await supabase.from('order_items').insert([{
                order_id: order.id,
                product_id: item.id,
                quantity: item.qty,
                unit_price: item.price
            }]);
            const prod = this.products.find(p => p.id === item.id);
            if (prod) {
                await supabase.from('products')
                    .update({ stock: Math.max(0, prod.stock - item.qty) })
                    .eq('id', item.id);
            }
        }

        // Limpiar y confirmar
        this.cart = [];
        this.saveCart();
        document.getElementById('checkout-overlay').style.display = 'none';
        document.getElementById('success-overlay').style.display = 'flex';
        document.getElementById('success-order').textContent = order.order_number;
        this.loadProducts();
    }

    money(n) {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    }
}

new Tienda();
