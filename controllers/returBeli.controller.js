const returService = require('../services/returBeli.service');

exports.getNewNomor = async (req, res) => {
    try {
        const nomor = await returService.getNewNomorRetur();
        res.status(200).json({ success: true, nomor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createRetur = async (req, res) => {
    try {
        // userLogin diambil dari middleware auth (jika ada)
        const userLogin = req.user ? req.user.username : 'SYSTEM';
        const result = await returService.saveReturProduksi(req.body, false, userLogin);
        
        res.status(201).json({
            success: true,
            message: 'Retur produksi berhasil disimpan',
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateRetur = async (req, res) => {
    try {
        const { nomor } = req.params;
        const userLogin = req.user ? req.user.username : 'SYSTEM';
        
        // Memastikan nomor di body sama dengan nomor di parameter URL
        const data = { ...req.body, Nomor: nomor };
        
        const result = await returService.saveReturProduksi(data, true, userLogin);
        res.status(200).json({
            success: true,
            message: 'Retur produksi berhasil diperbarui',
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteRetur = async (req, res) => {
    try {
        const { nomor } = req.params;
        const result = await returService.deleteReturProduksi(nomor);
        
        if (result) {
            res.status(200).json({ success: true, message: 'Data retur berhasil dihapus' });
        } else {
            res.status(404).json({ success: false, message: 'Data retur tidak ditemukan' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};