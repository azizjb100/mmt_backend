// backend/src/controllers/koreksiStokMmt.controller.js
// Catatan: File ini harus diimpor di router menggunakan require()

const service = require('../services/koreksiStokMmt.service.js'); // Menggunakan require
const { format } = require('date-fns'); // Menggunakan require

// READ MASTER (Browse)
const getKoreksiStok = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const data = await service.getKoreksiStokMaster(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// READ DETAIL (Expanded Row)
const getKoreksiStokDetail = async (req, res) => {
    const { nomor } = req.query;
    try {
        const data = await service.getKoreksiStokDetail(nomor);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE
const deleteKoreksiStok = async (req, res) => {
    const { nomor } = req.params;
    const user = req.user?.id || 'SYSTEM'; 
    try {
        await service.deleteKoreksiStok(nomor, user);
        res.status(200).json({ message: "Koreksi Stok berhasil dihapus." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mengekspor fungsi menggunakan module.exports (CommonJS)
module.exports = {
    getKoreksiStok,
    getKoreksiStokDetail,
    deleteKoreksiStok
};