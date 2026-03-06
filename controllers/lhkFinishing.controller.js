const service = require('../services/lhkFinishing.service');

const getAllHeaders = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const rows = await service.getAllHeaders(startDate, endDate);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getDetails = async (req, res) => {
    try {
        const { nomor } = req.query;
        const rows = await service.getDetailsByNomor(nomor);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const processFinalize = async (req, res) => {
    try {
        const { headerData, detailIds } = req.body;
        // headerData berisi lfh_nomor, lfh_tanggal, lfh_shift, lfh_gdg_prod, dll
        const result = await service.finalizeBundling(headerData, detailIds);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteHeader = async (req, res) => {
    try {
        const { nomor } = req.params;
        const result = await service.deleteLhk(nomor);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllHeaders,
    getDetails,
    processFinalize,
    deleteHeader
};