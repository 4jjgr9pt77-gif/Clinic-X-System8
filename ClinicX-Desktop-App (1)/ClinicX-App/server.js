/**
 * Clinic X - Complete Clinic Management System
 * Based on CliniSYS GP Manual + Brochure
 * Run: node server.js  →  http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const { getDB, persist, generateId, verifyPassword, hashPassword } = require('./db');

const PORT = process.env.PORT || 3000;
const sessions = new Map();

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
  });
}
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}
function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}
function getSession(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  return sessions.get(token) || null;
}
function requireAuth(req, res, roles = null) {
  const session = getSession(req);
  if (!session) { sendJSON(res, 401, { error: 'Unauthorized' }); return null; }
  if (roles && !roles.includes(session.role)) { sendJSON(res, 403, { error: 'Forbidden' }); return null; }
  return session;
}
function createToken() { return crypto.randomBytes(32).toString('hex'); }

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // Static
  if (pathname === '/' || pathname === '/index.html') {
    return sendFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html');
  }
  if (pathname.startsWith('/js/') || pathname.startsWith('/img/') || pathname.startsWith('/css/') || pathname === '/manifest.json') {
    const filePath = path.join(__dirname, 'public', pathname === '/manifest.json' ? 'manifest.json' : pathname);
    const ext = path.extname(filePath);
    const types = { '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
    return sendFile(res, filePath, types[ext] || 'application/octet-stream');
  }

  // ========== AUTH ==========
  if (pathname === '/api/login' && method === 'POST') {
    const body = await parseBody(req);
    const user = getDB().users.find(u => u.username === body.username && u.active);
    if (!user || !verifyPassword(body.password, user.password)) return sendJSON(res, 401, { error: 'Invalid username or password' });
    const token = createToken();
    sessions.set(token, { id: user.id, username: user.username, name: user.name, role: user.role });
    return sendJSON(res, 200, { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  }
  if (pathname === '/api/logout' && method === 'POST') {
    sessions.delete((req.headers.authorization || '').replace('Bearer ', ''));
    return sendJSON(res, 200, { ok: true });
  }
  if (pathname === '/api/me' && method === 'GET') {
    const s = requireAuth(req, res); if (!s) return;
    return sendJSON(res, 200, { user: s });
  }

  // ========== PATIENTS ==========
  if (pathname === '/api/patients' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const q = (parsed.query.q || '').toLowerCase();
    let list = getDB().patients;
    if (q) list = list.filter(p => (p.name||'').toLowerCase().includes(q) || (p.icNo||'').toLowerCase().includes(q) || (p.phone||'').includes(q));
    return sendJSON(res, 200, { patients: list });
  }
  if (pathname === '/api/patients' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse','cashier','doctor'])) return;
    const body = await parseBody(req);
    if (!body.name) return sendJSON(res, 400, { error: 'Name is required' });
    const patient = {
      id: generateId('patient'), name: body.name, icNo: body.icNo||'', gender: body.gender||'',
      dob: body.dob||'', phone: body.phone||'', address: body.address||'',
      patientType: body.patientType||'cash', panelCompany: body.panelCompany||'',
      corporateId: body.corporateId || null,
      allergies: body.allergies||'', createdAt: new Date().toISOString()
    };
    getDB().patients.push(patient); persist();
    return sendJSON(res, 201, { patient });
  }

  // ========== VISITS / QUEUE ==========
  if (pathname === '/api/visits' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const today = new Date().toISOString().slice(0,10);
    let visits = getDB().visits.filter(v => v.date === today);
    if (parsed.query.status) visits = visits.filter(v => v.status === parsed.query.status);
    const patients = getDB().patients;
    visits = visits.map(v => {
      const p = patients.find(x => x.id === v.patientId);
      return { ...v, patientName: p?.name||'Unknown', patientType: p?.patientType||'', panelCompany: p?.panelCompany||'', corporateId: p?.corporateId };
    });
    return sendJSON(res, 200, { visits });
  }
  if (pathname === '/api/visits' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse','cashier','doctor'])) return;
    const body = await parseBody(req);
    const today = new Date().toISOString().slice(0,10);
    const todayCount = getDB().visits.filter(v => v.date === today).length;
    const visit = {
      id: generateId('visit'), patientId: body.patientId, doctor: body.doctor||'',
      reason: body.reason||'', status: 'waiting',
      queueNo: todayCount + 1,
      date: today, createdAt: new Date().toISOString()
    };
    getDB().visits.push(visit); persist();
    return sendJSON(res, 201, { visit });
  }
  if (pathname.startsWith('/api/visits/') && method === 'PUT') {
    if (!requireAuth(req, res)) return;
    const id = parseInt(pathname.split('/')[3]);
    const body = await parseBody(req);
    const visit = getDB().visits.find(v => v.id === id);
    if (!visit) return sendJSON(res, 404, { error: 'Not found' });
    if (body.status) visit.status = body.status;
    if (body.doctor) visit.doctor = body.doctor;
    persist();
    return sendJSON(res, 200, { visit });
  }

  // ========== CONSULTATION ==========
  if (pathname === '/api/consultations' && method === 'POST') {
    const session = requireAuth(req, res, ['admin','doctor']);
    if (!session) return;
    const body = await parseBody(req);
    const id = generateId('consultation');
    getDB().consultations.push({
      id, visitId: body.visitId, notes: body.notes||'', diagnosis: body.diagnosis||'',
      createdAt: new Date().toISOString(), doctor: session.name
    });
    if (Array.isArray(body.prescriptions)) {
      body.prescriptions.forEach(rx => {
        getDB().prescriptions.push({
          id: generateId('prescription'), visitId: body.visitId, consultationId: id,
          drugName: rx.drugName, dosage: rx.dosage||'', quantity: rx.quantity||1,
          instruction: rx.instruction||'', status: 'pending', createdAt: new Date().toISOString()
        });
      });
    }
    const visit = getDB().visits.find(v => v.id === body.visitId);
    if (visit) visit.status = 'dispensary';
    persist();
    return sendJSON(res, 201, { ok: true });
  }

  // ========== PRESCRIPTIONS / DISPENSARY ==========
  if (pathname === '/api/prescriptions' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const status = parsed.query.status || 'pending';
    const today = new Date().toISOString().slice(0,10);
    const visitIds = getDB().visits.filter(v => v.date === today).map(v => v.id);
    let list = getDB().prescriptions.filter(p => visitIds.includes(p.visitId) && p.status === status);
    const patients = getDB().patients, visits = getDB().visits;
    list = list.map(rx => {
      const visit = visits.find(v => v.id === rx.visitId);
      const patient = visit ? patients.find(p => p.id === visit.patientId) : null;
      return { ...rx, patientName: patient?.name || 'Unknown' };
    });
    return sendJSON(res, 200, { prescriptions: list });
  }
  if (pathname.startsWith('/api/prescriptions/') && method === 'PUT') {
    if (!requireAuth(req, res, ['admin','nurse','cashier'])) return;
    const id = parseInt(pathname.split('/')[3]);
    const body = await parseBody(req);
    const rx = getDB().prescriptions.find(p => p.id === id);
    if (!rx) return sendJSON(res, 404, { error: 'Not found' });
    if (body.status) rx.status = body.status;
    // reduce stock if drug matches
    if (body.status === 'dispensed') {
      const stock = getDB().stocks.find(s => s.name.toLowerCase() === (rx.drugName||'').toLowerCase());
      if (stock) {
        stock.qty = Math.max(0, (stock.qty || 0) - (rx.quantity || 1));
      }
    }
    const allRx = getDB().prescriptions.filter(p => p.visitId === rx.visitId);
    if (allRx.every(p => p.status === 'dispensed')) {
      const visit = getDB().visits.find(v => v.id === rx.visitId);
      if (visit) visit.status = 'payment';
    }
    persist();
    return sendJSON(res, 200, { prescription: rx });
  }

  // ========== PAYMENTS ==========
  if (pathname === '/api/payments' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','cashier'])) return;
    const body = await parseBody(req);
    getDB().payments.push({
      id: generateId('payment'), visitId: body.visitId, patientId: body.patientId,
      amount: Number(body.amount)||0, method: body.method||'cash',
      panelCompany: body.panelCompany||'', createdAt: new Date().toISOString()
    });
    const visit = getDB().visits.find(v => v.id === body.visitId);
    if (visit) visit.status = 'completed';
    persist();
    return sendJSON(res, 201, { ok: true });
  }

  // ========== STATS ==========
  if (pathname === '/api/stats' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const today = new Date().toISOString().slice(0,10);
    const visits = getDB().visits.filter(v => v.date === today);
    return sendJSON(res, 200, {
      totalPatients: getDB().patients.length,
      todayVisits: visits.length,
      waiting: visits.filter(v => v.status==='waiting').length,
      dispensary: visits.filter(v => v.status==='dispensary').length,
      payment: visits.filter(v => v.status==='payment').length,
      completed: visits.filter(v => v.status==='completed').length,
      lowStock: getDB().stocks.filter(s => (s.qty||0) <= (s.reorderLevel||5)).length,
      todayAppointments: getDB().appointments.filter(a => a.date === today).length
    });
  }

  // ========== USERS ==========
  if (pathname === '/api/users' && method === 'GET') {
    if (!requireAuth(req, res, ['admin'])) return;
    return sendJSON(res, 200, {
      users: getDB().users.map(u => ({ id:u.id, username:u.username, name:u.name, role:u.role, active:u.active }))
    });
  }

  // ========== INVENTORY: STOCKS ==========
  if (pathname === '/api/stocks' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { stocks: getDB().stocks });
  }
  if (pathname === '/api/stocks' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse'])) return;
    const body = await parseBody(req);
    if (!body.name) return sendJSON(res, 400, { error: 'Name required' });
    const stock = {
      id: generateId('stock'),
      code: body.code || ('DRG' + generateId('stock')),
      name: body.name,
      category: body.category || 'Drug',
      unit: body.unit || 'Unit',
      qty: Number(body.qty) || 0,
      cost: Number(body.cost) || 0,
      price: Number(body.price) || 0,
      reorderLevel: Number(body.reorderLevel) || 5,
      maxLevel: Number(body.maxLevel) || 100,
      batchNo: body.batchNo || '',
      expiryDate: body.expiryDate || '',
      supplierId: body.supplierId || null,
      isPsychotropic: !!body.isPsychotropic,
      createdAt: new Date().toISOString()
    };
    getDB().stocks.push(stock); persist();
    return sendJSON(res, 201, { stock });
  }
  if (pathname.startsWith('/api/stocks/') && method === 'PUT') {
    if (!requireAuth(req, res, ['admin','nurse'])) return;
    const id = parseInt(pathname.split('/')[3]);
    const body = await parseBody(req);
    const stock = getDB().stocks.find(s => s.id === id);
    if (!stock) return sendJSON(res, 404, { error: 'Not found' });
    Object.assign(stock, {
      name: body.name ?? stock.name,
      qty: body.qty !== undefined ? Number(body.qty) : stock.qty,
      cost: body.cost !== undefined ? Number(body.cost) : stock.cost,
      price: body.price !== undefined ? Number(body.price) : stock.price,
      reorderLevel: body.reorderLevel !== undefined ? Number(body.reorderLevel) : stock.reorderLevel,
      batchNo: body.batchNo ?? stock.batchNo,
      expiryDate: body.expiryDate ?? stock.expiryDate
    });
    persist();
    return sendJSON(res, 200, { stock });
  }

  // ========== SUPPLIERS ==========
  if (pathname === '/api/suppliers' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { suppliers: getDB().suppliers });
  }
  if (pathname === '/api/suppliers' && method === 'POST') {
    if (!requireAuth(req, res, ['admin'])) return;
    const body = await parseBody(req);
    const supplier = {
      id: generateId('supplier'),
      name: body.name,
      contact: body.contact || '',
      phone: body.phone || '',
      email: body.email || '',
      address: body.address || '',
      createdAt: new Date().toISOString()
    };
    getDB().suppliers.push(supplier); persist();
    return sendJSON(res, 201, { supplier });
  }

  // ========== PURCHASE ORDER ==========
  if (pathname === '/api/purchase-orders' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { purchaseOrders: getDB().purchaseOrders });
  }
  if (pathname === '/api/purchase-orders' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse'])) return;
    const body = await parseBody(req);
    const po = {
      id: generateId('po'),
      supplierId: body.supplierId,
      supplierName: body.supplierName || '',
      items: body.items || [], // [{stockId, name, qty, cost}]
      status: 'pending', // pending | received | cancelled
      total: (body.items || []).reduce((s, i) => s + (i.qty * i.cost), 0),
      createdAt: new Date().toISOString(),
      createdBy: requireAuth(req, res).username
    };
    getDB().purchaseOrders.push(po); persist();
    return sendJSON(res, 201, { purchaseOrder: po });
  }
  if (pathname.startsWith('/api/purchase-orders/') && pathname.endsWith('/receive') && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse'])) return;
    const id = parseInt(pathname.split('/')[3]);
    const po = getDB().purchaseOrders.find(p => p.id === id);
    if (!po) return sendJSON(res, 404, { error: 'PO not found' });
    if (po.status === 'received') return sendJSON(res, 400, { error: 'Already received' });

    // create goods receive + increase stock
    const gr = {
      id: generateId('gr'),
      poId: po.id,
      items: po.items,
      receivedAt: new Date().toISOString()
    };
    getDB().goodsReceives.push(gr);

    po.items.forEach(item => {
      let stock = getDB().stocks.find(s => s.id === item.stockId || s.name === item.name);
      if (stock) {
        stock.qty = (stock.qty || 0) + Number(item.qty);
      } else {
        getDB().stocks.push({
          id: generateId('stock'),
          code: 'DRG' + generateId('stock'),
          name: item.name,
          category: 'Drug',
          unit: 'Unit',
          qty: Number(item.qty),
          cost: Number(item.cost) || 0,
          price: Number(item.cost) * 1.3 || 0,
          reorderLevel: 5,
          createdAt: new Date().toISOString()
        });
      }
    });
    po.status = 'received';
    persist();
    return sendJSON(res, 200, { ok: true, goodsReceive: gr });
  }

  // ========== STOCK ADJUSTMENT ==========
  if (pathname === '/api/stock-adjustments' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse'])) return;
    const body = await parseBody(req);
    const stock = getDB().stocks.find(s => s.id === body.stockId);
    if (!stock) return sendJSON(res, 404, { error: 'Stock not found' });
    const adj = {
      id: generateId('adjustment'),
      stockId: stock.id,
      stockName: stock.name,
      oldQty: stock.qty,
      newQty: Number(body.newQty),
      reason: body.reason || '',
      createdAt: new Date().toISOString()
    };
    stock.qty = Number(body.newQty);
    getDB().stockAdjustments.push(adj);
    persist();
    return sendJSON(res, 201, { adjustment: adj });
  }

  // ========== CORPORATE ==========
  if (pathname === '/api/corporates' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { corporates: getDB().corporates });
  }
  if (pathname === '/api/corporates' && method === 'POST') {
    if (!requireAuth(req, res, ['admin'])) return;
    const body = await parseBody(req);
    const corp = {
      id: generateId('corporate'),
      name: body.name,
      code: body.code || '',
      contact: body.contact || '',
      phone: body.phone || '',
      email: body.email || '',
      address: body.address || '',
      ceilingPerVisit: Number(body.ceilingPerVisit) || 0,
      active: true,
      createdAt: new Date().toISOString()
    };
    getDB().corporates.push(corp); persist();
    return sendJSON(res, 201, { corporate: corp });
  }

  // ========== INVOICES (Corporate) ==========
  if (pathname === '/api/invoices' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { invoices: getDB().invoices });
  }
  if (pathname === '/api/invoices' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','cashier'])) return;
    const body = await parseBody(req);
    const invoice = {
      id: generateId('invoice'),
      corporateId: body.corporateId,
      corporateName: body.corporateName || '',
      visitIds: body.visitIds || [],
      items: body.items || [],
      amount: Number(body.amount) || 0,
      status: 'posted', // posted | cancelled | paid
      invoiceDate: new Date().toISOString().slice(0,10),
      createdAt: new Date().toISOString()
    };
    getDB().invoices.push(invoice); persist();
    return sendJSON(res, 201, { invoice });
  }
  if (pathname.startsWith('/api/invoices/') && method === 'PUT') {
    if (!requireAuth(req, res, ['admin','cashier'])) return;
    const id = parseInt(pathname.split('/')[3]);
    const body = await parseBody(req);
    const inv = getDB().invoices.find(i => i.id === id);
    if (!inv) return sendJSON(res, 404, { error: 'Not found' });
    if (body.status) inv.status = body.status;
    persist();
    return sendJSON(res, 200, { invoice: inv });
  }

  // ========== APPOINTMENTS ==========
  if (pathname === '/api/appointments' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    let list = getDB().appointments;
    if (parsed.query.date) list = list.filter(a => a.date === parsed.query.date);
    if (parsed.query.doctor) list = list.filter(a => a.doctor === parsed.query.doctor);
    return sendJSON(res, 200, { appointments: list });
  }
  if (pathname === '/api/appointments' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse','doctor','cashier'])) return;
    const body = await parseBody(req);
    const appt = {
      id: generateId('appointment'),
      patientId: body.patientId || null,
      patientName: body.patientName || '',
      doctor: body.doctor || '',
      date: body.date,
      time: body.time || '09:00',
      reason: body.reason || '',
      status: 'scheduled', // scheduled | completed | cancelled | no-show
      notes: body.notes || '',
      createdAt: new Date().toISOString()
    };
    getDB().appointments.push(appt); persist();
    return sendJSON(res, 201, { appointment: appt });
  }
  if (pathname.startsWith('/api/appointments/') && method === 'PUT') {
    if (!requireAuth(req, res)) return;
    const id = parseInt(pathname.split('/')[3]);
    const body = await parseBody(req);
    const appt = getDB().appointments.find(a => a.id === id);
    if (!appt) return sendJSON(res, 404, { error: 'Not found' });
    if (body.status) appt.status = body.status;
    if (body.notes) appt.notes = body.notes;
    persist();
    return sendJSON(res, 200, { appointment: appt });
  }

  // ========== REPORTS ==========
  if (pathname === '/api/reports/sales' && method === 'GET') {
    if (!requireAuth(req, res, ['admin','cashier'])) return;
    const from = parsed.query.from || new Date().toISOString().slice(0,10);
    const to = parsed.query.to || from;
    const payments = getDB().payments.filter(p => {
      const d = p.createdAt.slice(0,10);
      return d >= from && d <= to;
    });
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    return sendJSON(res, 200, { from, to, count: payments.length, total, payments });
  }
  if (pathname === '/api/reports/inventory' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const stocks = getDB().stocks;
    const lowStock = stocks.filter(s => (s.qty||0) <= (s.reorderLevel||5));
    const expiring = stocks.filter(s => s.expiryDate && s.expiryDate <= new Date(Date.now() + 90*86400000).toISOString().slice(0,10));
    return sendJSON(res, 200, { totalItems: stocks.length, lowStock, expiring, stocks });
  }
  if (pathname === '/api/reports/prescriptions' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const from = parsed.query.from || new Date().toISOString().slice(0,10);
    const to = parsed.query.to || from;
    const list = getDB().prescriptions.filter(p => {
      const d = p.createdAt.slice(0,10);
      return d >= from && d <= to;
    });
    return sendJSON(res, 200, { from, to, prescriptions: list });
  }


  // ========== GOODS RETURN ==========
  if (pathname === '/api/goods-returns' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { goodsReturns: getDB().goodsReturns || [] });
  }
  if (pathname === '/api/goods-returns' && method === 'POST') {
    if (!requireAuth(req, res, ['admin','nurse'])) return;
    const body = await parseBody(req);
    const stock = getDB().stocks.find(s => s.id === body.stockId);
    if (!stock) return sendJSON(res, 404, { error: 'Stock not found' });
    const qty = Number(body.qty) || 0;
    if (qty <= 0 || qty > (stock.qty || 0)) return sendJSON(res, 400, { error: 'Invalid quantity' });

    const gr = {
      id: generateId('goodsReturn'),
      stockId: stock.id,
      stockName: stock.name,
      qty,
      reason: body.reason || '',
      supplierName: body.supplierName || '',
      createdAt: new Date().toISOString(),
      createdBy: requireAuth(req, res).username
    };
    if (!getDB().goodsReturns) getDB().goodsReturns = [];
    getDB().goodsReturns.push(gr);
    stock.qty = (stock.qty || 0) - qty;
    persist();
    return sendJSON(res, 201, { goodsReturn: gr });
  }

  // ========== STOCK ADJUSTMENT (list) ==========
  if (pathname === '/api/stock-adjustments' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { adjustments: getDB().stockAdjustments || [] });
  }

  // ========== MOH PSYCHOTROPIC REPORT ==========
  if (pathname === '/api/reports/psychotropic' && method === 'GET') {
    if (!requireAuth(req, res, ['admin','doctor','nurse'])) return;
    const from = parsed.query.from || new Date().toISOString().slice(0,10);
    const to = parsed.query.to || from;
    // Stocks marked as psychotropic
    const psychoStocks = getDB().stocks.filter(s => s.isPsychotropic || (s.category || '').toLowerCase().includes('psycho'));
    const psychoNames = psychoStocks.map(s => (s.name || '').toLowerCase());
    // Prescriptions of psychotropic drugs in date range
    const list = getDB().prescriptions.filter(p => {
      const d = (p.createdAt || '').slice(0,10);
      if (d < from || d > to) return false;
      const name = (p.drugName || '').toLowerCase();
      return psychoNames.some(n => name.includes(n)) || name.includes('diazepam') || name.includes('lorazepam') || name.includes('midazolam') || name.includes('clonazepam') || name.includes('alprazolam') || name.includes('zopiclone') || name.includes('zolpidem');
    });
    const patients = getDB().patients;
    const visits = getDB().visits;
    const enriched = list.map(rx => {
      const visit = visits.find(v => v.id === rx.visitId);
      const patient = visit ? patients.find(p => p.id === visit.patientId) : null;
      return {
        ...rx,
        patientName: patient?.name || 'Unknown',
        patientIC: patient?.icNo || '',
        date: (rx.createdAt || '').slice(0,10)
      };
    });
    return sendJSON(res, 200, { from, to, count: enriched.length, prescriptions: enriched });
  }



  // ========== PATIENT HISTORY ==========
  if (pathname.startsWith('/api/patients/') && pathname.endsWith('/history') && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const patientId = parseInt(pathname.split('/')[3]);
    const patient = getDB().patients.find(p => p.id === patientId);
    if (!patient) return sendJSON(res, 404, { error: 'Patient not found' });
    const visits = getDB().visits.filter(v => v.patientId === patientId).sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
    const visitIds = visits.map(v => v.id);
    const consultations = getDB().consultations.filter(c => visitIds.includes(c.visitId));
    const prescriptions = getDB().prescriptions.filter(p => visitIds.includes(p.visitId));
    const payments = getDB().payments.filter(p => p.patientId === patientId);
    const mcs = (getDB().mcs || []).filter(m => m.patientId === patientId);
    return sendJSON(res, 200, { patient, visits, consultations, prescriptions, payments, mcs });
  }

  // ========== CORPORATE AGING / OUTSTANDING ==========
  if (pathname === '/api/reports/aging' && method === 'GET') {
    if (!requireAuth(req, res, ['admin','cashier'])) return;
    const invoices = getDB().invoices.filter(i => i.status === 'posted' || i.status === 'partial');
    const today = new Date();
    const aging = invoices.map(inv => {
      const invDate = new Date(inv.invoiceDate || inv.createdAt);
      const days = Math.floor((today - invDate) / 86400000);
      let bucket = 'Current';
      if (days > 90) bucket = '90+';
      else if (days > 60) bucket = '61-90';
      else if (days > 30) bucket = '31-60';
      else if (days > 0) bucket = '1-30';
      return {
        ...inv,
        daysOutstanding: days,
        bucket,
        outstanding: inv.amount - (inv.paidAmount || 0)
      };
    }).filter(i => i.outstanding > 0);
    const summary = {
      current: aging.filter(a => a.bucket === 'Current').reduce((s,a) => s + a.outstanding, 0),
      d1_30: aging.filter(a => a.bucket === '1-30').reduce((s,a) => s + a.outstanding, 0),
      d31_60: aging.filter(a => a.bucket === '31-60').reduce((s,a) => s + a.outstanding, 0),
      d61_90: aging.filter(a => a.bucket === '61-90').reduce((s,a) => s + a.outstanding, 0),
      d90plus: aging.filter(a => a.bucket === '90+').reduce((s,a) => s + a.outstanding, 0),
      total: aging.reduce((s,a) => s + a.outstanding, 0)
    };
    return sendJSON(res, 200, { aging, summary });
  }


  // ========== CREATE MC ==========
  if (pathname === '/api/mcs' && method === 'POST') {
    const session = requireAuth(req, res, ['admin','doctor','nurse']);
    if (!session) return;
    const body = await parseBody(req);
    if (!getDB().mcs) getDB().mcs = [];
    const mc = {
      id: generateId('mc'),
      patientId: body.patientId,
      visitId: body.visitId || null,
      patientName: body.patientName || '',
      days: Number(body.days) || 1,
      reason: body.reason || '',
      fromDate: body.fromDate || new Date().toISOString().slice(0,10),
      toDate: body.toDate || '',
      diagnosis: body.diagnosis || '',
      createdAt: new Date().toISOString(),
      doctor: session.name
    };
    // calculate toDate if not given
    if (!mc.toDate && mc.fromDate) {
      const d = new Date(mc.fromDate);
      d.setDate(d.getDate() + mc.days - 1);
      mc.toDate = d.toISOString().slice(0,10);
    }
    getDB().mcs.push(mc);
    persist();
    return sendJSON(res, 201, { mc });
  }

  // ========== MC list / get ==========
  if (pathname === '/api/mcs' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return sendJSON(res, 200, { mcs: getDB().mcs || [] });
  }


  sendJSON(res, 404, { error: 'API endpoint not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  Clinic X - COMPLETE System');
  console.log('  Based on CliniSYS GP');
  console.log('  Running on port ' + PORT);
  console.log('========================================');
  console.log('Logins: admin/admin123  doctor/doctor123');
  console.log('        nurse/nurse123  cashier/cashier123\n');
});
