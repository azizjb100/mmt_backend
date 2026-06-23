// backend/src/controllers/lapPlanVsLhk.controller.js

const laporanService = require('../services/lapPlanVsLhk.service');

exports.getPlanVsLhk = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ 
                success: false, 
                message: "Parameter tanggal awal (startDate) dan akhir (endDate) wajib diisi." 
            });
        }

        const reportData = await laporanService.getPlanVsLhkReport(startDate, endDate);

        return res.status(200).json({
            success: true,
            message: "Berhasil mengambil laporan komparasi produksi.",
            data: reportData
        });
        
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

