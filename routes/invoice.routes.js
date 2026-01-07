// backend/src/routes/invoice.routes.js

const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
// const auth = require('../middleware/auth'); // Aktifkan jika ada middleware keamanan

// Mendapatkan Nomor Invoice Berikutnya (Auto-number)
// GET /api/invoice/next-number?kodePerush=KP&tanggal=2026-01-06
router.get('/next-number', invoiceController.getNextNomor);

// Mendapatkan Detail Invoice berdasarkan Nomor
// GET /api/invoice/detail/ING/KP/00001/2026
router.get('/detail/:nomor', invoiceController.getInvoiceByNomor);

// Mendapatkan Data Format Cetak
// GET /api/invoice/print/ING/KP/00001/2026
router.get('/print/:nomor', invoiceController.printInvoice);

// Menyimpan atau Update Invoice
// POST /api/invoice/save
router.post('/save', invoiceController.saveInvoice);

module.exports = router;