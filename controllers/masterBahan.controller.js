// backend/src/controllers/masterBahan.controller.js

const bahanService = require('../services/masterBahan.service');

// 1. READ ALL (Browse)
exports.getMasterBahan = async (req, res) => {
    // ... logic memanggil service ...
    try {
        const data = await bahanService.getBahanData();
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat daftar bahan.", error: error.message });
    }
};

// 2. GET BY KODE (Load for Edit)
exports.getBahanDetail = async (req, res) => {
    try {
        const { kode } = req.params;
        const data = await bahanService.getBahanByKode(kode);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat detail bahan.", error: error.message });
    }
};


exports.lookupBahan = async (req, res) => {
    try {
        const keyword = req.query.q || ''; 
        const data = await bahanService.getBahanLookupDataMmt(keyword);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat data lookup.", error: error.message });
    }
};

// 2. GET untuk Detail (Dipanggil oleh handleMaterialSelect)
exports.getBahanDetail = async (req, res) => {
    try {
        const { kode } = req.params;
        const data = await bahanService.getBahanDetailByKodeMmt(kode);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(404).json({ message: "Kode Bahan tidak ditemukan.", error: error.message });
    }
};


exports.lookupBahanProduksiMMt = async (req, res) => {
    try {
        const keyword = req.query.q || ''; 
        const data = await bahanService.getLookupGdgProduksiMMT(keyword);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat data lookup.", error: error.message });
    }
};