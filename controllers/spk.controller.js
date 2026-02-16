// backend/src/controllers/spk.controller.js
const spkService = require('../services/spk.service');

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