// Path disesuaikan keluar dari /controllers/spanduk menuju folder services
const garmenService = require('../../services/spanduk/permintaanBahan.service');

exports.getPermintaanGarmen = async (req, res) => {
    try {
        const { startDate, endDate, jenis, cab } = req.query;

        // Validasi Input Wajib
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'Parameter startDate dan endDate wajib diisi.' 
            });
        }

        // Jalankan service dengan parameter dinamis (dengan nilai default jika kosong)
        const data = await garmenService.fetchPermintaanGarmen(
            startDate, 
            endDate, 
            jenis || 'ACCESORIES', 
            cab || 'ALL'
        );
        
        return res.status(200).json({ 
            success: true, 
            count: data.length, 
            data 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};