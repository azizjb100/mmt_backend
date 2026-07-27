const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller'); // Sesuaikan path file controller Anda

/**
 * Route untuk data krisis operasional di Dashboard
 */
router.get('/top-10-deadline', dashboardController.getTopDeadlineCetak);
router.get('/top-10-deadline-total', dashboardController.getTopDeadlineCetakTotal);
router.get('/permintaan-pending', dashboardController.getPermintaanBahanPending);
router.get('/permintaan-pending-total', dashboardController.getPermintaanBahanPendingTotal);
router.get('/grafik-bulanan', dashboardController.getGrafikBsBulanan);

module.exports = router;