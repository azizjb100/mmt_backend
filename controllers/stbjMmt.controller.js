const brgJadiService = require('../services/stbjMmt.service');
const { subDays } = require('date-fns');

exports.getReport = async (req, res) => {
  try {
    const endDate = req.query.endDate || new Date();
    const startDate = req.query.startDate || subDays(endDate, 30);
    
    const data = await brgJadiService.getReport(startDate, endDate);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil laporan barang jadi', error: error.message });
  }
};