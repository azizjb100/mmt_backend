// backend/src/controllers/poPaperprint.controller.js

const service = require('../services/poPaperprint.service.js');
const { format, startOfMonth } = require('date-fns');

// READ MASTER (Browse)
const getPoPaperprint = async (req, res) => {
    const endDate = req.query.endDate || format(new Date(), 'yyyy-MM-dd');
    const startDate = req.query.startDate || format(startOfMonth(new Date()), 'yyyy-MM-dd');

    try {
        const data = await service.getPoPaperprintMaster(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// READ DETAIL (Expanded Row)
const getPoPaperprintDetail = async (req, res) => {
    const { nomor } = req.query;
    try {
        const data = await service.getPoPaperprintDetail(nomor);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE
const deletePoPaperprint = async (req, res) => {
    const { nomor } = req.params;
    try {
        await service.deletePoPaperprint(nomor);
        res.status(200).json({ message: "Penerimaan PO Paperprint berhasil dihapus." });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mengekspor fungsi menggunakan module.exports
module.exports = {
    getPoPaperprint,
    getPoPaperprintDetail,
    deletePoPaperprint
};