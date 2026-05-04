// backend/src/controllers/spk.controller.js
const spkService = require('../services/spk.service');

// ==========================================
// SPK HANDLERS
// ==========================================

exports.getSpkBrowse = async (req, res) => {
    try {
        const data = await spkService.getAllSpkData(req.query);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSpkDetailSize = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await spkService.getSpkDetailSize(nomor);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSpkLookup = async (req, res) => {
    const keyword = req.query.keyword || ''; 
    try {
        const data = await spkService.getSpkLookupData(keyword);
        res.status(200).json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSpkDetail = async (req, res) => {
    const { nomor } = req.params; 
    try {
        const data = await spkService.getSpkDetailByNomor(nomor);
        res.status(200).json({ success: true, data: data });
    } catch (error) {
        const statusCode = error.message.includes('tidak ditemukan') ? 404 : 500;
        res.status(statusCode).json({ success: false, message: error.message });
    }
};

exports.printSpk = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await spkService.getSpkForPrint(nomor);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==========================================
// STBJ HANDLERS (Baru)
// ==========================================

exports.getStbjLookup = async (req, res) => {
    const keyword = req.query.keyword || '';
    try {
        const data = await spkService.getStbjLookupData(keyword);
        res.status(200).json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memuat lookup STBJ' });
    }
};

exports.getStbjDetail = async (req, res) => {
    const { nomor } = req.params;
    try {
        const data = await spkService.getStbjFullDetail(nomor);
        res.status(200).json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};