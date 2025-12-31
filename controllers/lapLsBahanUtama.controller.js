// backend/controllers/lapLsBahanBaku.controller.js
const service = require('../services/lapLsBahanUtama.service');
const { format, startOfMonth } = require('date-fns');

exports.getReport = async (req, res) => {
  try {
    const endDate = req.query.endDate || format(new Date(), 'yyyy-MM-dd');
    const startDate = req.query.startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd');

    const data = await service.getReport(startDate, endDate);
    res.json(data);
  } catch (error) {
    console.error('Gagal mengambil laporan:', error);
    res.status(500).json({ message: 'Gagal mengambil laporan', error: error.message });
  }
};

// Fungsi Baru untuk Total Roll Saat Ini
exports.getTotalRoll = async (req, res) => {
  try {
    const summary = await service.getTotalRollSekarang();
    res.json({
      success: true,
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      data: summary
    });
  } catch (error) {
    console.error('Gagal mengambil total roll:', error);
    res.status(500).json({ message: 'Gagal mengambil ringkasan stok', error: error.message });
  }
};