// backend/src/controllers/koreksiStokMmt.controller.js
// Catatan: File ini harus diimpor di router menggunakan require()

const service = require('../services/koreksiStokMmt.service.js'); // Menggunakan require
const { format } = require('date-fns'); // Menggunakan require

// READ MASTER (Browse)
// Di controller Anda
const getKoreksiStok = async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        // Validasi parameter tanggal
        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: "Parameter startDate dan endDate diperlukan (Format: YYYY-MM-DD)."
            });
        }

        // Memanggil service yang menggabungkan master dan detail
        const data = await service.getKoreksiStokData(startDate, endDate);

        res.status(200).json({
            status: 'success',
            results: data.length,
            data: data
        });
    } catch (error) {
        console.error("Controller Error (getKoreksiStok):", error.message);
        res.status(500).json({
            status: 'error',
            message: "Gagal mengambil data: " + error.message
        });
    }
};

// backend/src/controllers/koreksiStokMmt.controller.js

const getStokGudangForKoreksi = async (req, res) => {
    // 1. Ambil dari req.query untuk GET request
    const { gudangKode, tanggal } = req.query; 
    
    try {
        // 2. Validasi apakah parameter ada
        if (!gudangKode) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Gudang harus dipilih' 
            });
        }

        // 3. Kirim ke service
        const data = await service.getStokGudangAll(gudangKode, tanggal);
        
        res.json({ 
            status: 'success', 
            data: data 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
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

const saveKoreksiStok = async (req, res) => {
    try {
        const user = req.user?.username || 'SYSTEM';
        const result = await service.saveKoreksiStokMMT(req.body, user);
        res.status(200).json({ status: 'success', message: 'Data berhasil disimpan', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = {
    getKoreksiStok,
    getKoreksiStokDetail,
    deleteKoreksiStok,
    getStokGudangForKoreksi,
    saveKoreksiStok

};

