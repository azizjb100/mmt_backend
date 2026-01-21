const pengajuanService = require('../services/pengajuanPermintaan.service');
const { format } = require('date-fns');

exports.getAll = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await pengajuanService.getPengajuanData(startDate, endDate);
        res.json({ data });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getByNomor = async (req, res) => {
    try {
        const data = await pengajuanService.getPengajuanByNomor(req.params.nomor);
        res.json(data);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.save = async (req, res) => {
    try {
        const user = req.user.kdUser;
        const result = await pengajuanService.savePengajuan(req.body, req.body.NomorToEdit, user);
        res.json({ message: 'Berhasil menyimpan pengajuan', nomor: result.Nomor });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.lookupPengajuan = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Logika untuk menangani jika tanggal kosong
        const dateNow = new Date();
        // Default startDate adalah 30 hari yang lalu
        const dateStart = startDate || format(new Date(new Date().setDate(dateNow.getDate() - 30)), 'yyyy-MM-dd');
        const dateEnd = endDate || format(new Date(), 'yyyy-MM-dd');

        const data = await pengajuanService.getPengajuanForLookup(dateStart, dateEnd);

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            message: "Gagal memuat data lookup Pengajuan Permintaan.",
            error: error.message
        });
    }
};

exports.getPengajuanForPrint = async (req, res) => {
    try {
        const { nomor } = req.params;
        if (!nomor) return res.status(400).json({ message: "Nomor pengajuan wajib diisi." });

        const data = await pengajuanService.getPengajuanPermintaanForPrint(nomor);
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ 
            message: "Gagal memuat data cetak.", 
            error: error.message 
        });
    }
};

exports.approvePengajuan = async (req, res) => {
    try {
        const { nomor } = req.body;
        
        // Ambil kode user dari token (Middleware verifyToken)
        const userKD = req.user.kdUser || req.user.user_nama;

        if (!nomor) {
            return res.status(400).json({ message: "Nomor pengajuan wajib dikirim." });
        }

        const success = await pengajuanService.approveBySPV(nomor, userKD);

        if (success) {
            res.json({ message: "Pengajuan berhasil di-ACC oleh SPV." });
        } else {
            res.status(404).json({ message: "Gagal ACC. Nomor pengajuan tidak ditemukan." });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};