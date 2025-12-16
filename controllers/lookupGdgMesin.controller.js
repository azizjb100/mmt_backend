// src/controllers/lookupGdgMesin.controller.js
// IMPOR DARI SERVICE DENGAN NAMA BARU
const lookupService = require('../services/lookupGdgMesin.service'); 

/**
 * @desc Mendapatkan daftar Gudang untuk Lookup
 * @route GET /api/v1/lookup/gudang
 */
const getGudangLookup = async (req, res) => {
    try {
        const data = await lookupService.getGudangLookup();

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error in getGudangLookup:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat data gudang.', error: error.message });
    }
};

/**
 * @desc Mendapatkan detail Gudang tunggal
 * @route GET /api/v1/lookup/gudang/:kode
 */
const getGudangDetail = async (req, res) => {
    const { kode } = req.params;
    try {
        const data = await lookupService.getGudangDetail(kode);

        if (!data) {
            return res.status(404).json({ success: false, message: 'Kode gudang tidak ditemukan.' });
        }

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error in getGudangDetail:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat detail gudang.', error: error.message });
    }
};

/**
 * @desc Mendapatkan daftar Mesin Cetak untuk Lookup
 * @route GET /api/v1/lookup/mesin
 */
const getMesinCetakLookup = async (req, res) => {
    try {
        const data = await lookupService.getMesinCetakLookup();

        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error in getMesinCetakLookup:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat data mesin.', error: error.message });
    }
};

module.exports = {
    getGudangLookup,
    getGudangDetail,
    getMesinCetakLookup
};