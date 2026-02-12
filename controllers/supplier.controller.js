// backend/src/controllers/supplier.controller.js

const supplierService = require('../services/supplier.service');

// 1. READ ALL (Browse / Search)
exports.getSuppliers = async (req, res) => {
    try {
        const keyword = req.query.q || req.query.keyword || '';
        const data = await supplierService.getSuppliers(keyword);
        return res.status(200).json({ 
            message: 'Pengambilan data supplier berhasil.', 
            data: data 
        });
    } catch (error) {
        return res.status(500).json({ 
            message: "Gagal mengambil data supplier.", 
            error: error.message 
        });
    }
};

// 2. READ ONE (Detail by Kode)
exports.getSupplierByKode = async (req, res) => {
    try {
        const { kode } = req.params;
        const data = await supplierService.getSupplierByKode(kode);
        if (!data) return res.status(404).json({ message: "Data tidak ditemukan." });
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal ambil detail.", error: error.message });
    }
};

exports.saveSupplier = async (req, res) => {
    try {
        const { header, isEditMode } = req.body;
        if (!header.Nama) return res.status(400).json({ message: "Nama wajib diisi." });

        const serviceData = {
            ...header,
            User: req.user?.id || 'ADMIN' // Contoh ambil user dari middleware auth
        };

        const result = await supplierService.saveSupplier(serviceData, isEditMode);
        return res.status(200).json({ 
            message: "Berhasil disimpan", 
            kode: result.kode 
        });
    } catch (error) {
        return res.status(500).json({ message: "Gagal simpan.", error: error.message });
    }
};


exports.deleteSupplier = async (req, res) => {
    try {
        const { kode } = req.params;
        
        const isDeleted = await supplierService.deleteSupplier(kode);

        if (isDeleted) {
            return res.status(200).json({ message: `Supplier ${kode} berhasil dihapus.` });
        }
        
        return res.status(404).json({ message: `Kode supplier ${kode} tidak ditemukan.` });

    } catch (error) {
        return res.status(500).json({ 
            message: "Gagal menghapus supplier.", 
            error: error.message 
        });
    }
};