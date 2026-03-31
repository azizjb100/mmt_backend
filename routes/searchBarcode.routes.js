const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchBarcode.controller');

/**
 * @route   GET /api/mmt/search/quick-check
 * @desc    Mencari detail barang berdasarkan barcode secara real-time dari master stok
 * @access  Public/Authenticated
 */
router.get('/quick-check', searchController.quickCheck);

router.get('/list', searchController.getInventoryList);

// Kamu bisa menambahkan route pencarian lainnya di sini nanti, 
// misalnya pencarian berdasarkan nama barang atau kategori.
// router.get('/by-name', searchController.findByName);

module.exports = router;