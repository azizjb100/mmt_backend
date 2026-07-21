const poService = require("../../services/spanduk/penerimaanBahanPenolong.service");

exports.getBrowsePO = async (req, res) => {
    try {
        const keyword = req.query.q || "";
        const data = await poService.getBrowsePO({ keyword });
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ 
            message: "Gagal memuat daftar PO Penolong.", 
            error: error.message 
        });
    }
};

exports.getPODetail = async (req, res) => {
    try {
        const { nomor } = req.params;
        if (!nomor) return res.status(400).json({ message: "Nomor PO wajib diisi." });

        const data = await poService.getPOByNomor(nomor);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(504).json({ 
            message: "Data PO tidak ditemukan.", 
            error: error.message 
        });
    }
};

exports.savePO = async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: "Unauthorized" });

        const userLogin = String(
            req.user?.kdUser || req.user?.KDUSER || req.user?.username || "SYSTEM"
        );

        const result = await poService.savePO(req.body, userLogin);
        return res.status(200).json({ 
            message: "Transaksi PO Penolong berhasil disimpan", 
            nomor: result.nomor 
        });
    } catch (error) {
        return res.status(500).json({ 
            message: "Gagal memproses simpan PO.", 
            error: error.message 
        });
    }
};

exports.lookupSKU = async (req, res) => {
    try {
        const q = String(req.query.q || "");
        const data = await poService.getLookupSKU(q);
        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ 
            message: "Gagal memuat list barang penolong.", 
            error: error.message 
        });
    }
};