// backend/src/controllers/lhkPola.controller.js
const lhkPolaService = require('../services/lhkPola.service');

/**
 * @desc Mendapatkan daftar LHK Pola untuk Lookup (Modal) ke LHK Desain
 * @route GET /api/v1/lhk-pola/lookup
 */
const getLHKPolaLookup = async (req, res) => {
    try {
        const data = await lhkPolaService.getLHKPolaLookup();

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error in getLHKPolaLookup:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal memuat data lookup LHK Pola.', 
            error: error.message 
        });
    }
};

module.exports = {
    getLHKPolaLookup,
};