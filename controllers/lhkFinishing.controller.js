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
        const { headerData, details } = req.body; 

        // Validasi sederhana agar tidak error .map() di service
        if (!details || !Array.isArray(details)) {
            return res.status(400).json({ 
                success: false, 
                message: "Data rincian (details) tidak ditemukan atau bukan array." 
            });
        }

        // Kirim 'details' ke service
        const result = await service.finalizeBundling(headerData, details);
        res.json(result);
    } catch (error) {
        console.error("Error in processFinalize:", error);
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

const getPendingPotong = async (req, res) => {
    try {
        const { targetProses } = req.query; // Misal: SEAMING, MATA_AYAM
        if (!targetProses) {
            return res.status(400).json({ success: false, message: "Parameter targetProses diperlukan." });
        }
        const rows = await service.getPendingPotong(targetProses);
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAllHeaders,
    getDetails,
    processFinalize,
    deleteHeader,
    getPendingPotong
};