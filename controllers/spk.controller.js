// backend/src/controllers/spk.controller.js
const spkService = require('../services/spk.service');

// Mendapatkan data untuk Grid Utama (Browse)
exports.getSpkBrowse = async (req, res) => {
    try {
        // req.query berisi startDate, endDate, cabang, keyword
        const data = await spkService.getAllSpkData(req.query);
        res.status(200).json(data); // Kirim langsung array agar sesuai dengan frontend
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mendapatkan detail per size (untuk Expanded Row)
exports.getSpkDetailSize = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await spkService.getSpkDetailSize(nomor);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Detail tunggal untuk Print/Edit

exports.getSpkLookup = async (req, res) => {
    const keyword = req.query.keyword || ''; 
    try {
        const data = await spkService.getSpkLookupData(keyword);
        
        // Standarisasi: Pastikan data yang dikirim adalah array
        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error("Error in getSpkLookup:", error.message);
        res.status(500).json({ 
            success: false,
            message: 'Gagal memuat data lookup SPK', 
            detail: error.message 
        });
    }
};

exports.getSpkDetail = async (req, res) => {
    const nomor = req.params.nomor; 
    try {
        if (!nomor) {
            return res.status(400).json({ message: 'Nomor SPK harus diisi' });
        }

        const data = await spkService.getSpkDetailByNomor(nomor);
        
        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error(`Error in getSpkDetail for ${nomor}:`, error.message);
        // Gunakan 404 jika error message mengandung kata "tidak ditemukan"
        const statusCode = error.message.includes('tidak ditemukan') ? 404 : 500;
        res.status(statusCode).json({ 
            success: false,
            message: error.message || 'Gagal mengambil detail SPK',
        });
    }
};


// backend/src/controllers/spk.controller.js

exports.printSpk = async (req, res) => {
    try {
        const { nomor } = req.params;
        
        // 1. Ambil data Header
        const header = await spkService.getSpkDetailByNomor(nomor);
        
        // 2. Ambil data Detail Size (Penting untuk tabel di print)
        const details = await spkService.getSpkDetailSize(nomor);
        
        // 3. Gabungkan dan kirim ke Frontend
        res.json({
            ...header,
            details: details
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};