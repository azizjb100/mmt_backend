// backend/src/controllers/customer.controller.js

const customerService = require('../services/customer.service');

// Mendapatkan data untuk Grid/Table Browse
exports.getBrowseCustomer = async (req, res) => {
    try {
        const { status } = req.query; // KORPORASI, PERSEORANGAN, atau ALL
        const data = await customerService.getBrowseCustomer(status);
        res.status(200).json({
            success: true,
            message: "Data customer berhasil dimuat",
            data: data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mendapatkan data untuk Lookup (Pencarian Cepat)
exports.getCustomerLookup = async (req, res) => {
    try {
        const { search } = req.query;
        const data = await customerService.getCustomerLookup(search);
        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mendapatkan satu data detail (untuk Edit)
exports.getCustomerByKode = async (req, res) => {
    try {
        const { kode } = req.params;
        const data = await customerService.getCustomerByKode(kode);
        res.status(200).json({
            success: true,
            data: data
        });
    } catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};

// Simpan data (Handle Create & Update)
exports.saveCustomer = async (req, res) => {
    try {
        const { kodeToEdit } = req.query; // Jika ada, berarti Update
        const userLogin = req.user?.username || 'SYSTEM'; // Asumsi ada middleware auth

        const result = await customerService.saveCustomer(req.body, kodeToEdit, userLogin);

        res.status(200).json({
            success: true,
            message: kodeToEdit ? "Data berhasil diperbarui" : "Data berhasil disimpan",
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Hapus data
exports.deleteCustomer = async (req, res) => {
    try {
        const { kode } = req.params;
        const deleted = await customerService.deleteCustomer(kode);

        if (deleted) {
            res.status(200).json({ success: true, message: "Customer berhasil dihapus" });
        } else {
            res.status(404).json({ success: false, message: "Data tidak ditemukan" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};