const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoicePembelian.controller');

router.get('/next-nomor', controller.getNextNomor);
router.get('/', controller.getInvoiceList);
router.get('/:nomor', controller.getInvoiceByNomor);
router.post('/save', controller.saveInvoice);
router.get('/print/:nomor', controller.printInvoice);
router.delete('/:nomor', controller.deleteInvoice);

module.exports = router;
