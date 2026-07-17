/** @jsx jsx */
/** @jsxImportSource hono/jsx */

import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("/*", cors());

interface Product {
  id?: number;
  name: string;
  cost: number;
  price: number;
  quantity_sold: number;
  stock: number;
  date_created?: string;
  date_updated?: string;
}

interface Stats {
  totalSales: number;
  totalCost: number;
  totalProfit: number;
  profit40: number;
  profit60: number;
  productCount: number;
  totalQuantitySold: number;
  totalStock: number;
}

async function initDB() {
  try {
    await Bun.sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        cost DECIMAL(10, 2) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        quantity_sold INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    console.log("✅ Base de datos inicializada");
  } catch (error) {
    console.error("❌ Error inicializando BD:", error);
  }
}

function calculateFields(product: Product) {
  const iva = product.price * 0.19;
  const profit = (product.price - product.cost) * product.quantity_sold;
  const profit40 = profit * 0.4;
  const profit60 = profit * 0.6;
  const sales = product.price * product.quantity_sold;

  return {
    ...product,
    iva: Math.round(iva * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    profit40: Math.round(profit40 * 100) / 100,
    profit60: Math.round(profit60 * 100) / 100,
    sales: Math.round(sales * 100) / 100,
  };
}

app.delete("/api/truncate", async (c) => {
  try {
    await Bun.sql`DELETE FROM products`;
    return c.json({ success: true, message: "Todos los productos han sido eliminados" });
  } catch (error) {
    console.error("Error truncating products:", error);
    return c.json({ error: "Error truncating products" }, 500);
  }
});

app.get("/api/load-demo-products", async (c) => {
  try {
    const demoProducts: Product[] = [
      { name: "Airpods 4", cost: 20000, price: 40000, quantity_sold: 5, stock: 5 },
      { name: "Airpods pro 3", cost: 20000, price: 60000, quantity_sold: 2, stock: 4 },
      { name: "Airpods max", cost: 30000, price: 45000, quantity_sold: 4, stock: 2 },
      { name: "Airpods 3", cost: 15000, price: 15000, quantity_sold: 0, stock: 8 },
      { name: "earpods lighting", cost: 6000, price: 10000, quantity_sold: 5, stock: 5 },
      { name: "earpods tipo c", cost: 6000, price: 10000, quantity_sold: 5, stock: 5 },
      { name: "Adaptador 20w", cost: 5000, price: 8000, quantity_sold: 6, stock: 6 },
      { name: "Adaptador 40w + cable", cost: 7000, price: 15000, quantity_sold: 7, stock: 5 },
      { name: "Adaptador 50w", cost: 6000, price: 12000, quantity_sold: 6, stock: 6 },
    ];

    // Elimina todos los productos existentes antes de insertar los nuevos,
    // evitando duplicados si el endpoint se llama más de una vez.
    await Bun.sql`DELETE FROM products`;

    const inserted: any[] = [];

    for (const product of demoProducts) {
      const result: any = await Bun.sql`
        INSERT INTO products (name, cost, price, stock, quantity_sold)
        VALUES (${product.name}, ${product.cost}, ${product.price}, ${product.stock}, ${product.quantity_sold})
        RETURNING *
      `;
      inserted.push(calculateFields(result[0]));
    }

    const stats: Stats = inserted.reduce(
      (acc, p) => {
        acc.totalSales += p.sales;
        acc.totalCost += p.cost * p.quantity_sold;
        acc.totalProfit += p.profit;
        acc.profit40 += p.profit40;
        acc.profit60 += p.profit60;
        acc.totalQuantitySold += p.quantity_sold;
        acc.totalStock += p.stock;
        return acc;
      },
      {
        totalSales: 0,
        totalCost: 0,
        totalProfit: 0,
        profit40: 0,
        profit60: 0,
        productCount: inserted.length,
        totalQuantitySold: 0,
        totalStock: 0,
      } as Stats
    );

    return c.json({
      success: true,
      message: `${inserted.length} productos de demostración cargados exitosamente`,
      stats,
      products: inserted,
    });
  } catch (error) {
    console.error("Error loading demo products:", error);
    return c.json({ error: "Error loading demo products" }, 500);
  }
});

app.get("/api/products", async (c) => {
  try {
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    let products: any[] = [];

    if (startDate && endDate) {
      products = await Bun.sql`
        SELECT * FROM products 
        WHERE date_created >= ${startDate} AND date_created <= ${endDate}
        ORDER BY date_created DESC
      `;
    } else {
      products = await Bun.sql`SELECT * FROM products ORDER BY date_created DESC`;
    }

    const withCalcs = products.map(calculateFields);
    return c.json(withCalcs);
  } catch (error) {
    console.error("Error fetching products:", error);
    return c.json({ error: "Error fetching products" }, 500);
  }
});

app.post("/api/products", async (c) => {
  try {
    const body = await c.req.json();
    const { name, cost, price, stock, quantity_sold } = body;

    if (!name || cost === undefined || price === undefined) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const result: any = await Bun.sql`
      INSERT INTO products (name, cost, price, stock, quantity_sold)
      VALUES (${name}, ${cost}, ${price}, ${stock || 0}, ${quantity_sold || 0})
      RETURNING *
    `;

    const product = calculateFields(result[0]);
    return c.json(product, 201);
  } catch (error) {
    console.error("Error creating product:", error);
    return c.json({ error: "Error creating product" }, 500);
  }
});

app.put("/api/products/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const product: any = await Bun.sql`SELECT * FROM products WHERE id = ${id}`;
    if (product.length === 0) {
      return c.json({ error: "Product not found" }, 404);
    }

    const current = product[0];
    const updated = {
      name: body.name ?? current.name,
      cost: body.cost ?? current.cost,
      price: body.price ?? current.price,
      stock: body.stock ?? current.stock,
      quantity_sold: body.quantity_sold ?? current.quantity_sold,
    };

    const result: any = await Bun.sql`
      UPDATE products 
      SET name = ${updated.name}, 
          cost = ${updated.cost}, 
          price = ${updated.price}, 
          stock = ${updated.stock}, 
          quantity_sold = ${updated.quantity_sold},
          date_updated = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    const withCalcs = calculateFields(result[0]);
    return c.json(withCalcs);
  } catch (error) {
    console.error("Error updating product:", error);
    return c.json({ error: "Error updating product" }, 500);
  }
});

app.delete("/api/products/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await Bun.sql`DELETE FROM products WHERE id = ${id}`;
    return c.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return c.json({ error: "Error deleting product" }, 500);
  }
});

app.get("/api/stats", async (c) => {
  try {
    const startDate = c.req.query("startDate");
    const endDate = c.req.query("endDate");

    let result: any;

    if (startDate && endDate) {
      result = await Bun.sql`
        SELECT 
          COUNT(*) as productCount,
          COALESCE(SUM(stock), 0) as totalStock,
          COALESCE(SUM(quantity_sold), 0) as totalQuantitySold,
          COALESCE(SUM(price * quantity_sold), 0) as totalSales,
          COALESCE(SUM(cost * quantity_sold), 0) as totalCost,
          COALESCE(SUM((price - cost) * quantity_sold), 0) as totalProfit
        FROM products
        WHERE date_created >= ${startDate} AND date_created <= ${endDate}
      `;
    } else {
      result = await Bun.sql`
        SELECT 
          COUNT(*) as productCount,
          COALESCE(SUM(stock), 0) as totalStock,
          COALESCE(SUM(quantity_sold), 0) as totalQuantitySold,
          COALESCE(SUM(price * quantity_sold), 0) as totalSales,
          COALESCE(SUM(cost * quantity_sold), 0) as totalCost,
          COALESCE(SUM((price - cost) * quantity_sold), 0) as totalProfit
        FROM products
      `;
    }

    const stats = result[0];
    const totalProfit = parseFloat(stats.totalProfit || 0);
    const totalSales = parseFloat(stats.totalSales || 0);

    const response: Stats = {
      totalSales: Math.round(totalSales * 100) / 100,
      totalCost: Math.round((parseFloat(stats.totalCost || 0)) * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      profit40: Math.round((totalProfit * 0.4) * 100) / 100,
      profit60: Math.round((totalProfit * 0.6) * 100) / 100,
      productCount: parseInt(stats.productCount || 0),
      totalQuantitySold: parseInt(stats.totalQuantitySold || 0),
      totalStock: parseInt(stats.totalStock || 0),
    };

    return c.json(response);
  } catch (error) {
    console.error("Error fetching stats:", error);
    return c.json({ error: "Error fetching stats" }, 500);
  }
});

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sistema de Inventario</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
</head>
<body class="bg-gray-50">
  <div class="max-w-7xl mx-auto p-6">
    <div class="bg-blue-600 text-white rounded-lg p-8 mb-8">
      <h1 class="text-4xl font-bold mb-2">📦 Sistema de Inventario</h1>
      <p class="text-blue-100">Gestión de productos, ventas y ganancias</p>
    </div>

    <div class="bg-white rounded-lg p-6 shadow mb-8">
      <h3 class="text-lg font-bold mb-4">📅 Filtro por Fechas</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-semibold mb-2">Fecha Inicio</label>
          <input type="date" id="startDate" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-semibold mb-2">Fecha Fin</label>
          <input type="date" id="endDate" class="w-full border rounded px-3 py-2">
        </div>
        <div class="flex items-end gap-2">
          <button onclick="filterByDate()" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 w-full font-semibold">
            🔍 Filtrar
          </button>
          <button onclick="clearFilter()" class="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">
            ❌
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-lg p-6 shadow">
        <p class="text-gray-600 text-sm font-semibold mb-2">VENTAS TOTALES</p>
        <p class="text-3xl font-bold text-blue-600" id="stat-ventas">$0</p>
      </div>
      <div class="bg-white rounded-lg p-6 shadow">
        <p class="text-gray-600 text-sm font-semibold mb-2">GANANCIA TOTAL</p>
        <p class="text-3xl font-bold text-green-600" id="stat-ganancia">$0</p>
      </div>
      <div class="bg-white rounded-lg p-6 shadow">
        <p class="text-gray-600 text-sm font-semibold mb-2">40% (Socio A)</p>
        <p class="text-3xl font-bold text-purple-600" id="stat-40">$0</p>
      </div>
      <div class="bg-white rounded-lg p-6 shadow">
        <p class="text-gray-600 text-sm font-semibold mb-2">60% (Socio B)</p>
        <p class="text-3xl font-bold text-orange-600" id="stat-60">$0</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div class="bg-white rounded-lg p-6 shadow">
        <h3 class="text-lg font-bold mb-4">📊 Ventas por Producto</h3>
        <canvas id="ventasChart"><\/canvas>
      </div>
      <div class="bg-white rounded-lg p-6 shadow">
        <h3 class="text-lg font-bold mb-4">💰 Ganancias por Producto</h3>
        <canvas id="gananciasChart"><\/canvas>
      </div>
    </div>

    <div class="bg-white rounded-lg p-6 shadow mb-8">
      <h3 class="text-lg font-bold mb-4">📦 Stock Disponible</h3>
      <canvas id="stockChart"><\/canvas>
    </div>

    <div class="bg-white rounded-lg p-6 shadow mb-8">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold">Inventario de Productos</h3>
        <button onclick="openModal()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold">
          ➕ Nuevo Producto
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-100 border-b">
              <th class="p-3 text-left font-semibold">Producto</th>
              <th class="p-3 text-right font-semibold">Costo</th>
              <th class="p-3 text-right font-semibold">Precio</th>
              <th class="p-3 text-right font-semibold">IVA</th>
              <th class="p-3 text-right font-semibold">Vendidos</th>
              <th class="p-3 text-right font-semibold">Stock</th>
              <th class="p-3 text-right font-semibold">Ganancia</th>
              <th class="p-3 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody id="products-table"><\/tbody>
        </table>
      </div>
    </div>

    <div class="bg-gradient-to-r from-purple-500 to-orange-500 rounded-lg p-8 text-white">
      <h3 class="text-2xl font-bold mb-6">💰 Repartición de Ganancias</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="bg-white bg-opacity-20 rounded-lg p-6">
          <p class="text-purple-100 text-sm mb-2">SOCIO A (40%)</p>
          <p class="text-4xl font-bold" id="widget-40">$0</p>
          <p class="text-purple-100 text-xs mt-2" id="widget-40-percent">de $0</p>
        </div>
        <div class="bg-white bg-opacity-20 rounded-lg p-6">
          <p class="text-orange-100 text-sm mb-2">SOCIO B (60%)</p>
          <p class="text-4xl font-bold" id="widget-60">$0</p>
          <p class="text-orange-100 text-xs mt-2" id="widget-60-percent">de $0</p>
        </div>
      </div>
    </div>
  </div>

  <div id="modal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
      <h3 class="text-2xl font-bold mb-6" id="modal-title">Nuevo Producto</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-semibold mb-2">Nombre</label>
          <input type="text" id="form-name" class="w-full border rounded px-3 py-2">
        </div>
        
        <div>
          <label class="block text-sm font-semibold mb-2">Precio Costo</label>
          <input type="number" id="form-cost" class="w-full border rounded px-3 py-2" step="0.01" oninput="updatePreview()">
        </div>
        
        <div>
          <label class="block text-sm font-semibold mb-2">Precio Venta</label>
          <input type="number" id="form-price" class="w-full border rounded px-3 py-2" step="0.01" oninput="updatePreview()">
        </div>

        <div>
          <label class="block text-sm font-semibold mb-2">IVA (19%)</label>
          <input type="number" id="form-iva" class="w-full border rounded px-3 py-2 bg-gray-100" disabled>
        </div>
        
        <div>
          <label class="block text-sm font-semibold mb-2">Stock</label>
          <input type="number" id="form-stock" class="w-full border rounded px-3 py-2" step="1" value="0">
        </div>
        
        <div>
          <label class="block text-sm font-semibold mb-2">Cantidad Vendida</label>
          <input type="number" id="form-sold" class="w-full border rounded px-3 py-2" step="1" value="0" oninput="updatePreview()">
        </div>

        <div class="bg-blue-50 p-4 rounded border-l-4 border-blue-400">
          <p class="text-sm text-blue-800">
            <strong>Ganancia:</strong> <span id="preview-profit">$0</span><br>
            <strong>40% (Socio A):</strong> <span id="preview-40">$0</span><br>
            <strong>60% (Socio B):</strong> <span id="preview-60">$0</span>
          </p>
        </div>
      </div>

      <div class="flex gap-2 mt-6">
        <button onclick="closeModal()" class="flex-1 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 font-semibold">
          Cancelar
        </button>
        <button onclick="saveProduct()" class="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-semibold">
          Guardar
        </button>
      </div>
    </div>
  </div>

  <script>
    let charts = {};
    let editingId = null;
    let currentStartDate = null;
    let currentEndDate = null;
    let allProducts = [];

    function setDefaultDates() {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      document.getElementById('startDate').valueAsDate = startDate;
      document.getElementById('endDate').valueAsDate = endDate;
    }

    function formatCurrency(value) {
      return '$' + Math.round(value).toLocaleString();
    }

    function updatePreview() {
      const price = parseFloat(document.getElementById('form-price').value) || 0;
      const cost = parseFloat(document.getElementById('form-cost').value) || 0;
      const sold = parseInt(document.getElementById('form-sold').value) || 0;

      const iva = Math.round(price * 0.19 * 100) / 100;
      const profit = Math.round((price - cost) * sold * 100) / 100;
      const profit40 = Math.round(profit * 0.4 * 100) / 100;
      const profit60 = Math.round(profit * 0.6 * 100) / 100;

      document.getElementById('form-iva').value = iva.toFixed(2);
      document.getElementById('preview-profit').textContent = formatCurrency(profit);
      document.getElementById('preview-40').textContent = formatCurrency(profit40);
      document.getElementById('preview-60').textContent = formatCurrency(profit60);
    }

    function openModal(productId = null) {
      editingId = productId;
      document.getElementById('modal').classList.remove('hidden');

      if (productId) {
        document.getElementById('modal-title').textContent = 'Editar Producto';
        const p = allProducts.find(item => item.id === productId);
        if (p) {
          document.getElementById('form-name').value = p.name;
          document.getElementById('form-cost').value = p.cost;
          document.getElementById('form-price').value = p.price;
          document.getElementById('form-stock').value = p.stock;
          document.getElementById('form-sold').value = p.quantity_sold;
        }
      } else {
        document.getElementById('modal-title').textContent = 'Nuevo Producto';
        document.getElementById('form-name').value = '';
        document.getElementById('form-cost').value = '';
        document.getElementById('form-price').value = '';
        document.getElementById('form-stock').value = '';
        document.getElementById('form-sold').value = '';
      }
      updatePreview();
    }

    function closeModal() {
      document.getElementById('modal').classList.add('hidden');
      editingId = null;
    }

    async function saveProduct() {
      const name = document.getElementById('form-name').value;
      const cost = parseFloat(document.getElementById('form-cost').value);
      const price = parseFloat(document.getElementById('form-price').value);
      const stock = parseInt(document.getElementById('form-stock').value);
      const quantity_sold = parseInt(document.getElementById('form-sold').value);

      if (!name || !cost || !price) {
        alert('Por favor llena todos los campos requeridos');
        return;
      }

      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? '/api/products/' + editingId : '/api/products';

      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, cost, price, stock, quantity_sold })
        });

        if (res.ok) {
          closeModal();
          loadData();
        } else {
          alert('Error al guardar producto');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    async function deleteProduct(id) {
      if (confirm('¿Eliminar este producto?')) {
        try {
          const res = await fetch('/api/products/' + id, { method: 'DELETE' });
          if (res.ok) {
            loadData();
          }
        } catch (error) {
          alert('Error al eliminar');
        }
      }
    }

    function filterByDate() {
      const start = document.getElementById('startDate').value;
      const end = document.getElementById('endDate').value;

      if (!start || !end) {
        alert('Por favor selecciona ambas fechas');
        return;
      }

      currentStartDate = start;
      currentEndDate = end;
      loadData();
    }

    function clearFilter() {
      currentStartDate = null;
      currentEndDate = null;
      setDefaultDates();
      loadData();
    }

    async function loadData() {
      try {
        const params = new URLSearchParams();
        if (currentStartDate) params.append('startDate', currentStartDate);
        if (currentEndDate) params.append('endDate', currentEndDate);

        const [pRes, sRes] = await Promise.all([
          fetch('/api/products?' + params),
          fetch('/api/stats?' + params)
        ]);

        const products = await pRes.json();
        const stats = await sRes.json();

        allProducts = products;

        document.getElementById('stat-ventas').textContent = formatCurrency(stats.totalSales);
        document.getElementById('stat-ganancia').textContent = formatCurrency(stats.totalProfit);
        document.getElementById('stat-40').textContent = formatCurrency(stats.profit40);
        document.getElementById('stat-60').textContent = formatCurrency(stats.profit60);
        document.getElementById('widget-40').textContent = formatCurrency(stats.profit40);
        document.getElementById('widget-60').textContent = formatCurrency(stats.profit60);
        document.getElementById('widget-40-percent').textContent = 'de ' + formatCurrency(stats.totalProfit);
        document.getElementById('widget-60-percent').textContent = 'de ' + formatCurrency(stats.totalProfit);

        document.getElementById('products-table').innerHTML = products.map(p => 
          '<tr class="border-b hover:bg-gray-50">' +
          '<td class="p-3 font-medium">' + p.name + '<\/td>' +
          '<td class="p-3 text-right">' + formatCurrency(p.cost) + '<\/td>' +
          '<td class="p-3 text-right">' + formatCurrency(p.price) + '<\/td>' +
          '<td class="p-3 text-right">' + formatCurrency(p.iva) + '<\/td>' +
          '<td class="p-3 text-right"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">' + p.quantity_sold + '<\/span><\/td>' +
          '<td class="p-3 text-right"><span class="bg-green-100 text-green-800 px-2 py-1 rounded">' + p.stock + '<\/span><\/td>' +
          '<td class="p-3 text-right font-bold text-green-600">' + formatCurrency(p.profit) + '<\/td>' +
          '<td class="p-3 text-center">' +
          '<button onclick="openModal(' + p.id + ')" class="text-blue-600 hover:text-blue-800 mr-2">🖊️<\/button>' +
          '<button onclick="deleteProduct(' + p.id + ')" class="text-red-600 hover:text-red-800">❌<\/button>' +
          '<\/td>' +
          '<\/tr>'
        ).join('');

        updateCharts(products);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }

    function updateCharts(products) {
      const names = products.map(p => p.name);
      const sales = products.map(p => p.sales);
      const profits = products.map(p => p.profit);
      const stocks = products.map(p => p.stock);

      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1'];

      Object.values(charts).forEach((chart) => {
        if (chart && chart.destroy) chart.destroy();
      });

      charts.ventas = new Chart(document.getElementById('ventasChart'), {
        type: 'bar',
        data: { 
          labels: names, 
          datasets: [{ label: 'Ventas', data: sales, backgroundColor: '#3b82f6' }] 
        },
        options: { responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }
      });

      charts.ganancias = new Chart(document.getElementById('gananciasChart'), {
        type: 'doughnut',
        data: { 
          labels: names, 
          datasets: [{ data: profits, backgroundColor: colors }] 
        },
        options: { responsive: true }
      });

      charts.stock = new Chart(document.getElementById('stockChart'), {
        type: 'line',
        data: { 
          labels: names, 
          datasets: [{ label: 'Stock', data: stocks, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }] 
        },
        options: { responsive: true, plugins: { legend: { display: true } } }
      });
    }

    setDefaultDates();
    loadData();
  </script>
</body>
</html>`;

app.get("/", (c) => {
  return c.html(htmlContent);
});

await initDB();

export default app;
