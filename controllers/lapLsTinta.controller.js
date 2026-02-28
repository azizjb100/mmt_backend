const laporanService = require("../services/lapLsTinta.service");

exports.getLaporan = async (req, res) => {
    try {
        const { startDate, endDate, gudang } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Tanggal mulai dan akhir harus diisi"
            });
        }

        const data = await laporanService.getLaporanStokObat(startDate, endDate, gudang);

        res.json({
            success: true,
            message: "Laporan stok tinta berhasil dimuat",
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};