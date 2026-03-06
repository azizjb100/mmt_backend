const service = require('../services/permintaanProduksiBahan.service');

// 1. GET BROWSE (Data untuk Table List/History)
// backend/src/controllers/permintaan.controller.js

exports.getBrowse = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        // Ambil divisi dari user yang sedang login
        const userDivisi = req.user ? req.user.user_divisi : null;

        // Kirim userDivisi ke fungsi service
        const data = await service.getPermintaanProduksiData(startDate, endDate, userDivisi);
        
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. LOOKUP HISTORY (Untuk Modal Lookup)
exports.getLookupPermintaan = async (req, res) => {
    try {
        const search = req.query.q || '';
        
        // Ambil data divisi dari req.user (hasil decode middleware verifyToken)
        // Ingat: Di Auth Service Anda, nama propertinya adalah 'divisi'
        const userDivisi = req.user ? req.user.divisi : null;

        // Panggil service dengan parameter tambahan userDivisi
        const data = await service.lookupPermintaanProduksi(search, userDivisi);
        
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. GET DETAIL BY NOMOR
exports.getDetailByNomor = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await service.getPermintaanProduksiDataByNomor(nomor);
        
        if (!data) {
            return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        }
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. SAVE (Insert / Update)
exports.save = async (req, res) => {
    try {
        // Konsistensi pengambilan user: Cek token, lalu cek body
        const userData = req.user?.username || req.body.User || req.body.header?.user_create || 'SYSTEM';
        
        // Membungkus payload agar sesuai ekspektasi Service
        const payload = {
            ...req.body,
            User: userData
        };
        
        // Gunakan isEditMode atau isUpdate sesuai kesepakatan frontend
        const isUpdate = req.body.isEditMode || req.body.isUpdate || false;
        
        const result = await service.savePermintaanProduksi(payload, isUpdate);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. REMOVE
exports.remove = async (req, res) => {
    try {
        const { nomor } = req.params;
        const result = await service.deletePermintaanProduksi(nomor);
        res.json({ success: true, message: 'Data terhapus', affectedRows: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};