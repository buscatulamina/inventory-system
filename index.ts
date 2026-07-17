/** @jsx jsx */
/** @jsxImportSource hono/jsx */

import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("/*", cors());

// 📦 Datos de productos
const products = [
  { id: 1, name: "Airpods 4", precio: 20000, vendidos: 5, stock: 5, ventas: 200000, ganancia: 100000, porc40: 80000, porc60: 120000 },
  { id: 2, name: "Airpods pro 3", precio: 20000, vendidos: 2, stock: 4, ventas: 120000, ganancia: 35000, porc40: 14000, porc60: 21000 },
  { id: 3, name: "Airpods max", precio: 30000, vendidos: 4, stock: 2, ventas: 180000, ganancia: 45000, porc40: 18000, porc60: 27000 },
  { id: 4, name: "Airpods 3", precio: 15000, vendidos: 0, stock: 8, ventas: 120000, ganancia: 30000, porc40: 0, porc60: 0 },
  { id: 5, name: "earpods lighting", precio: 6000, vendidos: 5, stock: 5, ventas: 60000, ganancia: 10000, porc40: 4000, porc60: 6000 },
  { id: 6, name: "earpods tipo c", precio: 6000, vendidos: 5, stock: 5, ventas: 60000, ganancia: 10000, porc40: 4000, porc60: 6000 },
  { id: 7, name: "Adaptador 20w", precio: 5000, vendidos: 6, stock: 6, ventas: 60000, ganancia: 8000, porc40: 3200, porc60: 4800 },
  { id: 8, name: "Adaptador 40w + cable", precio: 7000, vendidos: 7, stock: 5, ventas: 84000, ganancia: 15000, porc40: 6000, porc60: 9000 },
  { id: 9, name: "Adaptador 50w", precio: 6000, vendidos: 6, stock: 6, ventas: 72000, ganancia: 12000, porc40: 4800, porc60: 7200 },
];

app.get("/api/products", (c) => c.json(products));

app.get("/api/stats", (c) => {
  const totalVentas = products.reduce((s, p) => s + p.ventas, 0);
  const totalGanancia = products.reduce((s, p) => s + p.ganancia, 0);
  const totalPorc40 = products.reduce((s, p) => s + p.porc40, 0);
  const totalPorc60 = products.reduce((s, p) => s + p.porc60, 0);
  return c.json({ totalVentas, totalGanancia, totalPorc40, totalPorc60 });
});

app.get("/", (c) => {
  return c.html(`<!DOCTYPE html>
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
      <h3 class="text-lg font-bold mb-4">Inventario de Productos</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-100 border-b">
              <th class="p-3 text-left font-semibold">Producto</th>
              <th class="p-3 text-right font-semibold">Precio</th>
              <th class="p-3 text-right font-semibold">Vendidos</th>
              <th class="p-3 text-right font-semibold">Stock</th>
              <th class="p-3 text-right font-semibold">Ventas</th>
              <th class="p-3 text-right font-semibold">Ganancia</th>
            </tr>
          </thead>
          <tbody id="products-table"></tbody>
        </table>
      </div>
    </div>

    <div class="bg-gradient-to-r from-purple-500 to-orange-500 rounded-lg p-8 text-white">
      <h3 class="text-2xl font-bold mb-6">💰 Repartición de Ganancias</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="bg-white bg-opacity-20 rounded-lg p-6">
          <p class="text-purple-100 text-sm mb-2">SOCIO A (40%)</p>
          <p class="text-4xl font-bold" id="widget-40">$0</p>
        </div>
        <div class="bg-white bg-opacity-20 rounded-lg p-6">
          <p class="text-orange-100 text-sm mb-2">SOCIO B (60%)</p>
          <p class="text-4xl font-bold" id="widget-60">$0</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    async function loadData() {
      const [pRes, sRes] = await Promise.all([fetch('/api/products'), fetch('/api/stats')]);
      const products = await pRes.json();
      const stats = await sRes.json();
      
      document.getElementById('stat-ventas').textContent = '$' + stats.totalVentas.toLocaleString();
      document.getElementById('stat-ganancia').textContent = '$' + stats.totalGanancia.toLocaleString();
      document.getElementById('stat-40').textContent = '$' + stats.totalPorc40.toLocaleString();
      document.getElementById('stat-60').textContent = '$' + stats.totalPorc60.toLocaleString();
      document.getElementById('widget-40').textContent = '$' + stats.totalPorc40.toLocaleString();
      document.getElementById('widget-60').textContent = '$' + stats.totalPorc60.toLocaleString();

      document.getElementById('products-table').innerHTML = products.map(p => \`
        <tr class="border-b hover:bg-gray-50">
          <td class="p-3 font-medium">\${p.name}</td>
          <td class="p-3 text-right">$\${p.precio.toLocaleString()}</td>
          <td class="p-3 text-right"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded">\${p.vendidos}</span></td>
          <td class="p-3 text-right"><span class="bg-green-100 text-green-800 px-2 py-1 rounded">\${p.stock}</span></td>
          <td class="p-3 text-right">$\${p.ventas.toLocaleString()}</td>
          <td class="p-3 text-right font-bold text-green-600">$\${p.ganancia.toLocaleString()}</td>
        </tr>
      \`).join('');

      const names = products.map(p => p.name);
      new Chart(document.getElementById('ventasChart'), {
        type: 'bar',
        data: { labels: names, datasets: [{ label: 'Ventas', data: products.map(p => p.ventas), backgroundColor: '#3b82f6' }] },
        options: { responsive: true, indexAxis: 'y' }
      });

      new Chart(document.getElementById('gananciasChart'), {
        type: 'doughnut',
        data: { labels: names, datasets: [{ data: products.map(p => p.ganancia), backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16'] }] },
        options: { responsive: true }
      });

      new Chart(document.getElementById('stockChart'), {
        type: 'line',
        data: { labels: names, datasets: [{ label: 'Stock', data: products.map(p => p.stock), borderColor: '#10b981', fill: false }] },
        options: { responsive: true }
      });
    }
    loadData();
  </script>
</body>
</html>`);
});

export default app;
