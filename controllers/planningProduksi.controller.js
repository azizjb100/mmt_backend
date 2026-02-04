// backend/src/controllers/planningProduksi.controller.js

const planningService = require('../services/planningProduksi.service');

exports.getBrowsePlanning = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Parameter tanggal harus diisi" });
        }

        const data = await planningService.getPlanningProduksiData(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDetailPlanning = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await planningService.getPlanningByNomor(nomor);
        res.json(data);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};