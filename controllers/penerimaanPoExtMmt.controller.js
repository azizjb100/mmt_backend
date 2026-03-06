const service = require('../services/penerimaanPoExtMmt.service');

exports.browse = async (req, res) => {
    try {
        const { startDate, endDate, cab } = req.query;
        const data = await service.getBrowseData(startDate, endDate, cab);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        const { nomor } = req.params;
        const userCab = req.user.cab; // Diambil dari middleware auth

        await service.deleteBPB(nomor, userCab);
        res.json({ success: true, message: "Data berhasil dihapus dan status PO diperbarui." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.save = async (req, res) => {
    try {
        const result = await service.saveBPB(req.body, req.user);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const data = await service.getDetailByNomor(req.params.nomor);
        res.json({ success: true, data });
    } catch (err) {
        res.status(404).json({ success: false, message: err.message });
    }
};