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


exports.saveJadwal = async (req, res) => {
  try {
    const data = req.body;

    // Validasi minimal (Sesuaikan dengan kebutuhan bisnis)
    if (!data.Gudang || !data.Tanggal || !data.No_SPK) {
      return res.status(400).json({ 
        message: "Gudang, Tanggal, dan Nomor SPK wajib diisi." 
      });
    }

    // Ambil user dari token (asumsi middleware auth menyimpan user di req.user)
    const payload = {
      ...data,
      usr_create: req.user?.username || data.usr_create || 'SYSTEM'
    };

    const result = await jadwalService.saveJadwalKirim(payload);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller Save Error:", error);
    return res.status(500).json({ message: error.message });
  }
};