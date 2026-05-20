// backend/src/controllers/mppb.controller.js
const mppbService = require('../services/mppb.service');

/**
 * @desc Mendapatkan daftar MPPB untuk Lookup (Modal)
 * @route GET /api/v1/mmt/mppb/lookup
 */
const getMPPBLookup = async (req, res) => {
    try {
        // Ambil filter tanggal dari query params, beri default jika kosong
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const startDate = req.query.start_date || thirtyDaysAgo;
        const endDate = req.query.end_date || today;

        const data = await mppbService.getMPPBLookup(startDate, endDate);

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error in getMPPBLookup:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memuat data lookup MPPB.', 
            error: error.message 
        });
    }
};

const getMPPBByNomor = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await mppbService.getMPPBByNomor(nomor);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: `Data MPPB dengan nomor ${nomor} tidak ditemukan.`
            });
        }

        // Langsung return objek data agar sesuai dengan penanganan data di frontend: const data = response.data;
        res.status(200).json(data);
    } catch (error) {
        console.error('Error in getMPPBByNomor:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memuat detail data MPPB.', 
            error: error.message 
        });
    }
};

module.exports = {
    getMPPBLookup,
    getMPPBByNomor
};