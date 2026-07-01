const express = require('express');
const router = express.Router();
const lhkDesainController = require('../controllers/lhkDesain.controller');

// 1. Endpoint tarik data terintegrasi (Header + Grid Status + Grid Komponen + Grid Bordir)
router.get('/load-all/:nomorSpk', lhkDesainController.loadAllLhkDesain);

// 2. Endpoint aksi simpan / update LHK Desain
router.post('/save', lhkDesainController.saveLhkDesain);

// 3. Endpoint validasi kode bahan / komponen cetak & bordir (F1 / onBlur di tabel)
router.get('/validate-bahan', lhkDesainController.validateBahan);

module.exports = router;