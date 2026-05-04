const rtrService = require('../services/lhkRtr.service');

const browseRtr = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await rtrService.getAllHeaders(startDate, endDate);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getDetailRtr = async (req, res) => {
    try {
        const data = await rtrService.getDetailsByNomor(req.params.nomor);
        res.status(200).json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const saveRtr = async (req, res) => {
    try {
        const result = await rtrService.saveLhk(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteRtr = async (req, res) => {
    try {
        const result = await rtrService.deleteLhk(req.params.nomor);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    browseRtr,
    getDetailRtr,
    saveRtr,
    deleteRtr
};