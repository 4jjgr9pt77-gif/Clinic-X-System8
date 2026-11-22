const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'data', 'clinicx.json');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'clinicx-salt').digest('hex');
}

const defaultData = {
  users: [
    { id: 'u1', username: 'admin',   password: hashPassword('admin123'),   name: 'System Admin', role: 'admin',   active: true },
    { id: 'u2', username: 'doctor',  password: hashPassword('doctor123'),  name: 'Dr. Henry Tan', role: 'doctor',  active: true },
    { id: 'u3', username: 'nurse',   password: hashPassword('nurse123'),   name: 'Nurse Amy',     role: 'nurse',   active: true },
    { id: 'u4', username: 'cashier', password: hashPassword('cashier123'), name: 'Cashier Lim',   role: 'cashier', active: true }
  ],
  patients: [],
  visits: [],
  consultations: [],
  prescriptions: [],
  payments: [],
  mcs: [],
  // Inventory
  stocks: [],
  suppliers: [],
  purchaseOrders: [],
  goodsReceives: [],
  stockAdjustments: [],
  goodsReturns: [],
  // Corporate
  corporates: [],
  invoices: [],
  corporatePayments: [],
  // Appointments
  appointments: [],
  nextIds: {
    patient: 1, visit: 1, consultation: 1, prescription: 1, payment: 1, mc: 1,
    stock: 1, supplier: 1, po: 1, gr: 1, adjustment: 1, goodsReturn: 1,
    corporate: 1, invoice: 1, corpPayment: 1, appointment: 1
  }
};

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {}
  saveDB(defaultData);
  return JSON.parse(JSON.stringify(defaultData));
}
function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

let db = loadDB();

function getDB() { return db; }
function persist() { saveDB(db); }
function generateId(type) {
  const id = db.nextIds[type] || 1;
  db.nextIds[type] = id + 1;
  persist();
  return id;
}
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

module.exports = { getDB, persist, generateId, hashPassword, verifyPassword };
