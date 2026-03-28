
const reportService = require('../services/lapPemakaianBahan.service');

exports.getProductionWaste = async (req, res) => {
    try {
        const { startDate, endDate, mesin } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Tanggal mulai dan selesai harus diisi" });
        }

        const data = await reportService.getFullProductionReport(startDate, endDate, mesin);

        if (data.length > 0) {
            const summary = data.reduce((acc, row) => {
                acc.hasilLuas += Number(row.hasilLuas || 0);
                acc.ambilLuas += Number(row.ambilLuas || 0);
                acc.wasteTotal += Number(row.wasteBsP || 0); // Contoh logic waste
                return acc;
            }, { isTotal: true, namaOrder: 'GRAND TOTAL', hasilLuas: 0, ambilLuas: 0, wasteTotal: 0 });
            summary.totalWastePersen = summary.ambilLuas > 0 
                ? ((summary.wasteTotal / summary.ambilLuas) * 100).toFixed(2) 
                : 0;

            // Masukkan ke array data
            data.push(summary);
        }

        res.json(data);
    } catch (error) {
        console.error("Controller Error:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};