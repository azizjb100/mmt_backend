// backend/src/controllers/jadwalKirim.controller.js
const jadwalService = require('../services/jadwalKirim.service');

exports.browseJadwal = async (req, res) => {
  try {
    const { startDate, endDate, cab } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Periode tanggal harus diisi." });
    }

    const data = await jadwalService.getJadwalKirimData(startDate, endDate, cab);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteJadwal = async (req, res) => {
  try {
    // Parameter diambil dari body karena di Delphi menggunakan komposit key
    const success = await jadwalService.deleteJadwalKirim(req.body);
    
    if (success) {
      return res.status(200).json({ message: "Berhasil dihapus" });
    } else {
      return res.status(404).json({ message: "Data tidak ditemukan atau gagal dihapus" });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};