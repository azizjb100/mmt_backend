const rtrService = require('../services/lhkRtr.service');

const browseRtr = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await rtrService.getAllHeaders(startDate, endDate);
        
        // PERBAIKAN: Dibungkus objek { data } demi standardisasi stand-alone / lookup data table di Vue
        res.status(200).json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getDetailRtr = async (req, res) => {
    try {
        // PERBAIKAN: Mendukung pembacaan dari parameter rute biasa maupun query string lookup (?nomor=)
        const nomor = req.params.nomor || req.query.nomor;
        
        if (!nomor) {
            return res.status(400).json({ message: "Parameter nomor tidak ditemukan" });
        }

        const data = await rtrService.getDetailsByNomor(nomor);
        
        // Ditambahkan key 'details' sebagai jaminan mapping frontend lancar tanpa merusak endpoint entri data lama
        res.status(200).json({ data, details: data });
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