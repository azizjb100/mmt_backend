const service = require('../services/permintaanProduksiBahan.service');

exports.getBrowse = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await service.getPermintaanProduksiData(startDate, endDate);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.save = async (req, res) => {
    try {
        const isUpdate = req.body.isUpdate || false;
        const result = await service.savePermintaanProduksi(req.body, isUpdate);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.remove = async (req, res) => {
    try {
        const { nomor } = req.params;
        await service.deletePermintaanProduksi(nomor);
        res.json({ success: true, message: 'Data terhapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};