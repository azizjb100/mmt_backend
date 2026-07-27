const returService = require('../services/returBeli.service');

// Mendapatkan nomor otomatis baru untuk Retur Beli
exports.getNewNomor = async (req, res) => {
    try {
        const nomor = await returService.getNewNomorReturBeli();
        res.status(200).json({ success: true, nomor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mendapatkan daftar seluruh Retur Beli (dengan pencarian & pagination)
exports.getAllRetur = async (req, res) => {
    try {
        const { search, limit, offset } = req.query;
        const data = await returService.getAllReturBeli({ search, limit, offset });
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mendapatkan detail Retur Beli berdasarkan Nomor (Header + Details)
exports.getReturByNomor = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await returService.getReturBeliByNomor(nomor);

        if (!data) {
            return res.status(404).json({ 
                success: false, 
                message: `Data retur beli dengan nomor ${nomor} tidak ditemukan` 
            });
        }

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Menyimpan transaksi Retur Beli baru
exports.createRetur = async (req, res) => {
    try {
        const userLogin = req.user ? req.user.kdUser : 'SYSTEM';
        const result = await returService.saveReturBeli(req.body, false, userLogin);
        
        res.status(201).json({
            success: true,
            message: 'Retur beli berhasil disimpan',
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mengubah data Retur Beli
exports.updateRetur = async (req, res) => {
    try {
        const { nomor } = req.params;
        const userLogin = req.user ? req.user.username : 'SYSTEM';
        
        const data = { ...req.body, Nomor: nomor };
        const result = await returService.saveReturBeli(data, true, userLogin);
        
        res.status(200).json({
            success: true,
            message: 'Retur beli berhasil diperbarui',
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Menghapus transaksi Retur Beli
exports.deleteRetur = async (req, res) => {
    try {
        const { nomor } = req.params;
        const result = await returService.deleteReturBeli(nomor);
        
        if (result) {
            res.status(200).json({ success: true, message: 'Data retur beli berhasil dihapus' });
        } else {
            res.status(404).json({ success: false, message: 'Data retur beli tidak ditemukan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};