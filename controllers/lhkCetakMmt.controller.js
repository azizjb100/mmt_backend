// backend/controllers/lhkCetak.controller.js
const lhkCetakService = require('../services/lhkCetakMmt.service');

const getAllHeaders = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Jika filter tanggal tidak dikirim, service akan menangani default-nya
        const data = await lhkCetakService.getAllHeaders(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil data master LHK", error: error.message });
    }
};

const getDetails = async (req, res) => {
    try {
        const { nomor } = req.query;
        if (!nomor) return res.status(400).json({ message: "Nomor LHK diperlukan" });
        
        const data = await lhkCetakService.getDetailsByNomor(nomor);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "Gagal mengambil detail LHK", error: error.message });
    }
};

const saveLhk = async (req, res) => {
    try {
        const { header, details } = req.body;
        const { nomor } = req.params; // Ada jika mode EDIT

        if (!header || !details) {
            return res.status(400).json({ message: "Data Header dan Detail harus diisi" });
        }

        const result = await lhkCetakService.saveLhk(header, details, nomor);
        res.status(200).json({
            message: nomor ? "Data berhasil diperbarui" : "Data berhasil disimpan",
            data: result
        });
    } catch (error) {
        res.status(500).json({ message: "Gagal menyimpan data", error: error.message });
    }
};

const deleteLhk = async (req, res) => {
    try {
        const { nomor } = req.params;
        const result = await lhkCetakService.deleteLhk(nomor);
        res.json({ message: "Data berhasil dihapus", result });
    } catch (error) {
        res.status(500).json({ message: "Gagal menghapus data", error: error.message });
    }
};

module.exports = {
    getAllHeaders,
    getDetails,
    saveLhk,
    deleteLhk
};