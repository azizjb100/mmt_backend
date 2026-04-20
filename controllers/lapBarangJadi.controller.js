const mmtService = require("../services/lapBarangJadi.service");

const getReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: false,
                message: "Parameter startDate dan endDate harus diisi (YYYY-MM-DD)"
            });
        }

        const data = await mmtService.getLaporanBarangJadi(startDate, endDate);
        
        res.json({
            status: true,
            message: "Success",
            data: data
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = {
    getReport
};