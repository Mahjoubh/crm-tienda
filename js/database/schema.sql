-- CRM + Tienda Online - Esquema de Base de Datos
-- Ejecuta este archivo en el SQL Editor de Supabase

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== CONTACTOS =====
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    company VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== TICKETS =====
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'open',
    priority VARCHAR(50) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== PRODUCTOS =====
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    category VARCHAR(100),
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== PEDIDOS =====
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    order_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== ITEMS DE PEDIDO =====
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

-- ===== DATOS DE EJEMPLO =====
INSERT INTO contacts (name, email, phone, company, city, country) VALUES
    ('Juan Pérez', 'juan@example.com', '+34600123456', 'Tech Solutions', 'Madrid', 'España'),
    ('María López', 'maria@example.com', '+34600654321', 'Digital Agency', 'Barcelona', 'España');

INSERT INTO products (name, description, price, stock, category) VALUES
    ('Producto Premium', 'Producto de alta calidad', 99.99, 50, 'Electrónica'),
    ('Producto Básico', 'Producto para uso diario', 49.99, 100, 'General');

INSERT INTO tickets (contact_id, subject, description, status, priority) VALUES
    ((SELECT id FROM contacts LIMIT 1), 'Problema con pago', 'No puedo completar el pago', 'open', 'high');
