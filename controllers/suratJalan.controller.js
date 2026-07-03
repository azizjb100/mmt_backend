const sjService = require('../services/suratJalan.service'); // Menunjuk ke file model sebelumnya

const browseMasterSj = async (req, res) => {
    try {
        const { startDate, endDate, cab, zcus, pendingOnly } = req.query;
        
        // Konversi pendingOnly ke boolean jika dikirim lewat query string
        const isPendingOnly = pendingOnly === 'true' || pendingOnly === true;

        const data = await sjService.getMasterSj(startDate, endDate, cab, zcus, isPendingOnly);
        
        // Dibungkus objek { data } demi standardisasi stand-alone / lookup data table di Vue
        res.status(200).json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getDetailSj = async (req, res) => {
    try {
        const { startDate, endDate, cab, pendingOnly } = req.query;
        const isPendingOnly = pendingOnly === 'true' || pendingOnly === true;

        const data = await sjService.getDetailSj(startDate, endDate, cab, isPendingOnly);
        
        // Ditambahkan key 'details' sebagai jaminan mapping frontend lancar
        res.status(200).json({ data, details: data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const approveSj = async (req, res) => {
    try {
        // Mendukung pembacaan dari parameter rute biasa maupun body request
        const nomor = req.params.nomor || req.body.nomor;
        const { kodeGdg } = req.body;

        if (!nomor) {
            return res.status(400).json({ message: "Parameter nomor surat jalan wajib diisi" });
        }
        if (!kodeGdg) {
            return res.status(400).json({ message: "Parameter kodeGdg wajib diisi" });
        }

        const result = await sjService.approveSj(nomor, kodeGdg);
        res.status(200).json(result);
    } catch (error) {
        // Jika error validasi dilempar dari model, status disesuaikan (e.g., 400 Bad Request)
        res.status(400).json({ message: error.message });
    }
};

const pendingSj = async (req, res) => {
    try {
        const nomor = req.params.nomor || req.body.nomor;

        if (!nomor) {
            return res.status(400).json({ message: "Parameter nomor surat jalan wajib diisi" });
        }

        const result = await sjService.pendingSj(nomor);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const batalSj = async (req, res) => {
    try {
        const nomor = req.params.nomor || req.body.nomor;

        if (!nomor) {
            return res.status(400).json({ message: "Parameter nomor surat jalan wajib diisi" });
        }

        const result = await sjService.batalSj(nomor);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    browseMasterSj,
    getDetailSj,
    approveSj,
    pendingSj,
    batalSj
};