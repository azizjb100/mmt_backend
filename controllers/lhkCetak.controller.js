const lhkCetakService = require('../services/lhkCetak.service');
const { subDays } = require('date-fns'); // Untuk tanggal default

exports.getAllHeaders = async (req, res) => {
  try {
    // Beri tanggal default (30 hari terakhir) jika tidak ada
    const endDate = req.query.endDate || new Date();
    const startDate = req.query.startDate || subDays(endDate, 30);
    
    const data = await lhkCetakService.getAllHeaders(startDate, endDate);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data LHK', error: error.message });
  }
};

exports.getDetails = async (req, res) => {
  try {
    const { nomor } = req.query; // Ambil 'nomor' dari query parameter
    if (!nomor) {
      return res.status(400).json({ message: 'Nomor LHK diperlukan' });
    }
    const data = await lhkCetakService.getDetailsByNomor(nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail', error: error.message });
  }
};

exports.getLookup = async (req, res) => { 
    const { nomor } = req.params;
    
    try {
        const combinedData = await lhkCetakService.getLookupByNomor(nomor); 

        if (!combinedData) {
            return res.status(404).json({ message: `LHK Mesin ${nomor} tidak ditemukan.` });
        }
        
        res.json(combinedData);
    } catch (error) {
        console.error('API Error in getLookup:', error);
        res.status(500).json({ message: 'Gagal mengambil data LHK Mesin Lookup.', error: error.message });
    }
};

exports.deleteHeader = async (req, res) => {
  try {
    const { nomor } = req.params; // Ambil 'nomor' dari URL
    const result = await lhkCetakService.deleteLhk(nomor);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.saveLhk = async (req, res) => {
    // Asumsi data dikirim dalam body request:
    // {
    //   existingNomor: 'MMT-LHK-M.2512.0001' atau null
    //   header: { ltanggal, lgdg_prod, lspk_nomor, lmesin, lshift, loperator, lbahan, lpanjang, ljumlah_kolom, lfixed, luser_Create/luser_modified, ... },
    //   details: [ { ambilbahan, cetak1, cetak2, ..., kodebahan, ... }, ... ]
    // }
    const { existingNomor, header, details } = req.body;

    // Lakukan validasi dasar (sesuaikan dengan kebutuhan riil)
    if (!header || !details || details.length === 0) {
        return res.status(400).json({ success: false, message: 'Data header atau detail tidak lengkap.' });
    }
    
    // Pastikan user ID terisi (sesuai logika Delphi: frmmenu.KDUSER)
    if (!header.luser_Create && !header.luser_modified) {
        return res.status(400).json({ success: false, message: 'User ID tidak ditemukan.' });
    }

    try {
        const result = await lhkCetakService.saveLhk(header, details, existingNomor);
        
        res.status(200).json({ 
            success: true, 
            message: result.message,
            nomor: result.nomor,
            isEdit: result.isEdit
        });
        
    } catch (error) {
        console.error('Error di saveLhk controller:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Terjadi kesalahan saat menyimpan data LHK.' 
        });
    }
};