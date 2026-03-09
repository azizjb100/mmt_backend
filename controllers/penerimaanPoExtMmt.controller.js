const service = require('../services/penerimaanPoExtMmt.service');

exports.browse = async (req, res) => {
    try {
        const { startDate, endDate, cab } = req.query;
        const data = await service.getBrowseData(startDate, endDate, cab);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        const { nomor } = req.params;
        const userCab = req.user.cab; // Diambil dari middleware auth

        await service.deleteBPB(nomor, userCab);
        res.json({ success: true, message: "Data berhasil dihapus dan status PO diperbarui." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.save = async (req, res) => {
    try {
        // 1. Ambil status apakah ini update atau baru (isEditMode dari frontend)
        // Jika frontend mengirim 'Nomor' yang bukan 'AUTO', berarti update
        const isUpdate = req.body.Nomor && req.body.Nomor !== 'AUTO';

        // 2. Ambil kode user secara spesifik (misal: 'ADMIN' atau 'LIA')
        // Sesuaikan 'req.user.kdUser' dengan nama field di token JWT Anda
        const userLogin = req.user?.kdUser || req.user?.username || 'SYSTEM';

        // 3. Panggil service dengan 3 parameter sesuai urutan: (data, isUpdate, userLogin)
        const result = await service.saveBPB(req.body, isUpdate, userLogin);

        res.json({ 
            success: true, 
            message: "Data berhasil disimpan",
            data: result 
        });
    } catch (err) {
        // Berikan status 400 jika error validasi (seperti PO sudah dibayar)
        // atau 500 jika error database
        res.status(500).json({ 
            success: false, 
            message: err.message 
        });
    }
};

exports.getById = async (req, res) => {
    try {
        const data = await service.getDetailByNomor(req.params.nomor);
        res.json({ success: true, data });
    } catch (err) {
        res.status(404).json({ success: false, message: err.message });
    }
};