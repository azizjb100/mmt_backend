// backend/src/controllers/poExternal.controller.js
const poService = require('../services/poExtMmt.service');

const browse = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // currentUser.cab didapat dari middleware auth (misal JWT)
        const data = await poService.getPoExternalBrowse(startDate, endDate, req.user?.cab);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const remove = async (req, res) => {
    try {
        const { nomor } = req.params;
        await poService.deletePoExternal(nomor, req.user?.cab);
        res.json({ success: true, message: "Berhasil dihapus" });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const submitPin = async (req, res) => {
    try {
        const { nomor, alasan } = req.body;
        if (!alasan) return res.status(400).json({ message: "Alasan harus diisi" });
        
        const result = await poService.ajukanPerubahan(nomor, alasan, req.user?.username);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getLookupBpb = async (req, res) => {
    try {
        const { q } = req.query;
        const data = await poService.getLookupPoForBpb(q);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getDetailForBpb = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await poService.getPoDetailForBpb(nomor);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { browse, remove, submitPin, getLookupBpb, getDetailForBpb};