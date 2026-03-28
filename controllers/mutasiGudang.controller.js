const mutasiService = require('../services/mutasiGudang.service'); // Sesuaikan path file service Anda

exports.createMutasi = async (req, res) => {
    try {
        const result = await mutasiService.saveMutasiGudang(req.body, false, req.user?.username);
        res.status(201).json({
            success: true,
            message: "Data mutasi berhasil disimpan",
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateMutasi = async (req, res) => {
    try {
        const { nomor } = req.params;
        // Memastikan Nomor di body sama dengan nomor di URL params
        const data = { ...req.body, Nomor: nomor };
        
        const result = await mutasiService.saveMutasiGudang(data, true, req.user?.username);
        res.status(200).json({
            success: true,
            message: `Data mutasi ${nomor} berhasil diperbarui`,
            data: result
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllMutasi = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Filter tanggal (startDate & endDate) diperlukan" });
        }
        const data = await mutasiService.getMutasiData(startDate, endDate);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.generateNomor = async (req, res) => {
    try {
        const nomor = await mutasiService.getNewNomorMutasi();
        res.status(200).json({ success: true, nomor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};