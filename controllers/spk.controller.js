// backend/src/controllers/spk.controller.js

const spkService = require('../services/spk.service');

/**
 * @description Mengambil data SPK untuk lookup (modal bantuan).
 * Sesuai dengan ufrmmintabahan_mmt.clSPKPropertiesButtonClick.
 * Endpoint: GET /api/spk/lookup?keyword=...
 */
exports.getSpkLookup = async (req, res) => {
    // Mengambil keyword pencarian dari query parameter (misal: /lookup?keyword=ABC)
    const keyword = req.query.keyword || ''; 
    try {
        const data = await spkService.getSpkLookupData(keyword);
        
        // Mengembalikan status 200 OK dengan data SPK
        res.status(200).json(data);
    } catch (error) {
        // Menangani error dari service dan mengirimkan status 500 (Internal Server Error)
        console.error("Error in getSpkLookup:", error.message);
        res.status(500).json({ 
            message: 'Gagal memuat data lookup SPK', 
            detail: error.message 
        });
    }
};

/**
 * @description Mengambil detail SPK berdasarkan nomornya.
 * Endpoint: GET /api/spk/:nomor
 */
exports.getSpkDetail = async (req, res) => {
    // Mengambil nomor SPK dari URL parameter (misal: /api/spk/SPK-2025-001)
    const nomor = req.params.nomor; 
    try {
        const data = await spkService.getSpkDetailByNomor(nomor);
        
        // Mengembalikan status 200 OK dengan detail SPK
        res.status(200).json(data);
    } catch (error) {
        // Jika SPK tidak ditemukan atau error lainnya
        console.error(`Error in getSpkDetail for ${nomor}:`, error.message);
        res.status(404).json({ 
            message: `Detail SPK ${nomor} tidak ditemukan.`,
            detail: error.message 
        });
    }
};