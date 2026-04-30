// controllers/lapMonProof.controller.js
const reportService = require('../services/lapMonProof.service');

/**
 * Controller untuk Laporan Monitoring Proof
 * Menangani pengambilan data dari Service berbasis logika Delphi
 */
async function getLapMonProof(req, res) {
  const { startDate, endDate } = req.query;

  // Validasi input (Penting karena query SQL Delphi sangat bergantung pada range tanggal)
  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Parameter startDate dan endDate (YYYY-MM-DD) wajib diisi'
    });
  }

  try {
    const data = await reportService.lapMonProof(
      startDate,
      endDate
    );

    // Mengembalikan data hasil query SQL (tmemospk join tlhk_proofmmt)
    res.json(data);

  } catch (error) {
    console.error('Error in lapMonProof Controller:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat mengambil data Monitoring Proof'
    });
  }
}

module.exports = { getLapMonProof };