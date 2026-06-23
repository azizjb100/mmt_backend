// controllers/lhkPola.controller.js
const lhkPolaService = require('../services/lhkPola.service');

// 1. Ambil Semua Data Header (Baris yang bikin crash jika undefined)
const getAllHeaders = async (req, res) => {
    try {
        // Logika panggil service getAllHeaders Anda di sini nanti
        return res.status(200).json({ success: true, data: [] });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Simpan Data (POST / PUT)
const storeLhkPola = async (req, res) => {
    try {
        const headerPayload = JSON.parse(req.body.header || '{}');
        const detailsPayload = JSON.parse(req.body.details || '[]');

        if (!headerPayload.operator || detailsPayload.length === 0) {
            return res.status(400).json({ success: false, message: "Operator dan detail pola wajib diisi." });
        }

        const existingNomor = (headerPayload.nomor && headerPayload.nomor !== 'AUTO') ? headerPayload.nomor : null;
        const result = await lhkPolaService.saveLhkPola(headerPayload, detailsPayload, existingNomor, req.files);

        return res.status(200).json({ success: true, message: "Simpan LHK Pola sukses.", data: result });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Ambil Detail untuk onMounted Vue Form/Browse Expanded
const showDetailsPola = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await lhkPolaService.getDetailsByNomor(nomor);
        return res.status(200).json({ success: true, data: data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Ambil Satu Data Header Saja (Single View)
const getOneLhk = async (req, res) => {
    try {
        return res.status(200).json({ success: true, data: {} });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Fungsi Export Excel
const exportLhk = async (req, res) => {
    try {
        return res.status(200).json({ success: true, message: "Export placeholder" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 6. Fungsi Rekap LHK
const getRekapLhk = async (req, res) => {
    try {
        return res.status(200).json({ success: true, data: [] });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 7. Fungsi Hapus LHK
const deleteLhk = async (req, res) => {
    try {
        return res.status(200).json({ success: true, message: "Berhasil dihapus" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// CRITICAL: Pastikan SEMUA fungsi di atas masuk ke dalam export ini!
module.exports = {
    getAllHeaders,
    storeLhkPola,
    showDetailsPola,
    getOneLhk,
    exportLhk,
    getRekapLhk,
    deleteLhk
};