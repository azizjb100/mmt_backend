// src/controllers/reportController.js

const reportService = require('../services/lapMonCetak.service');

async function lapMonCetak(req, res) {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Missing startDate or endDate query parameters.' });
    }

    try {
        const reportData = await reportService.lapMonCetak(startDate, endDate);
        res.json(reportData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    lapMonCetak
};