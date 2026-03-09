// backend/src/controllers/stbj.controller.js

const stbjService = require('../services/stbj.service');

exports.browseSTBJ = async (req, res) => {
    try {
        const { startDate, endDate, gdgKode } = req.query;
        // Default pencarian jika gdgKode kosong adalah '%' (semua)
        const data = await stbjService.getBrowseSTBJ(startDate, endDate, gdgKode || "");
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getDetail = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await stbjService.getDetailSTBJ(nomor);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createSTBJ = async (req, res) => {
    try {
        const userLogin = req.user?.username || 'ADMIN'; // Asumsi ada middleware auth
        const result = await stbjService.saveSTBJ(req.body, false, userLogin);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateSTBJ = async (req, res) => {
    try {
        const userLogin = req.user?.username || 'ADMIN';
        const result = await stbjService.saveSTBJ(req.body, true, userLogin);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteSTBJ = async (req, res) => {
    try {
        const { nomor } = req.params;
        const { gdgKode } = req.query; // Kirimkan gdgKode untuk logika WH003
        const success = await stbjService.deleteSTBJ(nomor, gdgKode);
        
        if (success) {
            res.json({ message: `STBJ ${nomor} berhasil dihapus` });
        } else {
            res.status(404).json({ message: "Data tidak ditemukan" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};