const dashboardService = require('../services/dashboard.service'); // Sesuaikan path file service Anda

/**
 * Mengambil data top 10 antrean cetak yang mepet deadline
 */
const getTopDeadlineCetak = async (req, res) => {
    try {
        const data = await dashboardService.getTopDeadlineCetak();
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Mengambil daftar permintaan bahan yang belum terealisasi (pending)
 */
const getPermintaanBahanPending = async (req, res) => {
    try {
        const data = await dashboardService.getPermintaanBahanPending();
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getPermintaanBahanPendingTotal = async (req, res) => {
    try {
        // Memanggil fungsi service baru yang sudah kita buat sebelumnya (tanpa LIMIT 15)
        const data = await dashboardService.getPermintaanBahanTotalFull();
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getTopDeadlineCetak,
    getPermintaanBahanPending,
    getPermintaanBahanPendingTotal
};