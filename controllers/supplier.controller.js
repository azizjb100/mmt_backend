// backend/src/controllers/supplierController.js

const supplierService = require('../services/supplier.service');

exports.searchSuppliers = async (req, res) => {
    try {
        // Ambil keyword dari query string (e.g., ?q=PT)
        const keyword = req.query.q || ''; 
        
        const suppliers = await supplierService.getSuppliers(keyword);

        return res.status(200).json({
            message: 'Pencarian supplier berhasil.',
            data: suppliers
        });

    } catch (error) {
        console.error('Error in searchSuppliers controller:', error.message);
        return res.status(500).json({
            message: "Gagal melakukan pencarian supplier.",
            error: error.message 
        });
    }
};

// Mengambil detail supplier tunggal (untuk mengisi form setelah pemilihan)
exports.getSupplierByKode = async (req, res) => {
    try {
        const { kode } = req.params;
        // Panggil service dengan keyword kode supplier spesifik
        const supplier = await supplierService.getSuppliers(kode); 

        if (supplier.length === 0) {
            return res.status(404).json({ message: "Supplier tidak ditemukan." });
        }
        // Mengembalikan objek supplier pertama
        return res.status(200).json({ data: supplier[0] }); 
        
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat detail supplier.", error: error.message });
    }
};