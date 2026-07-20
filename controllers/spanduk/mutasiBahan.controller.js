// Perbaikan path: menggunakan ../../ untuk keluar dari /controllers/spanduk
const mutasiService = require('../../services/spanduk/mutasiBahan.service');

exports.getMutasiBahan = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validasi Input
        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'Parameter startDate dan endDate wajib diisi.' 
            });
        }

        const data = await mutasiService.fetchMutasiBahan(startDate, endDate);
        
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

exports.getReportPenawaran = async (req, res) => {
    try {
        const { startDate, endDate, filterText } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: 'Parameter startDate dan endDate wajib diisi.' 
            });
        }

        const reportData = await mutasiService.fetchReportPenawaran(startDate, endDate, filterText);
        
        return res.status(200).json({ 
            success: true, 
            data: reportData 
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};