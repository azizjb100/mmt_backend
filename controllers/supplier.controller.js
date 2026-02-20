const supplierService = require("../services/supplier.service");

const getUserLogin = (req) =>
    String(
        req.user?.kdUser ||
            req.user?.KDUSER ||
            req.user?.username ||
            req.user?.user_nama ||
            req.user?.user ||
            "SYSTEM",
    );

exports.getSuppliers = async (req, res) => {
    try {
        const keyword = req.query.q || req.query.keyword || "";
        const data = await supplierService.getSuppliers(keyword);
        return res.status(200).json({ message: "Pengambilan data supplier berhasil.", data });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengambil data supplier.",
            error: error.message,
        });
    }
};

exports.getNextSupplierKode = async (_req, res) => {
    try {
        const result = await supplierService.getNextSupplierKode();
        return res.status(200).json({ data: result });
    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengambil kode supplier berikutnya.",
            error: error.message,
        });
    }
};

exports.getSupplierByKode = async (req, res) => {
    try {
        const { kode } = req.params;
        if (!kode) {
            return res.status(400).json({ message: "Kode supplier wajib diisi." });
        }

        const data = await supplierService.getSupplierByKode(kode);
        if (!data) {
            return res.status(404).json({ message: "Data supplier tidak ditemukan." });
        }

        return res.status(200).json({ data });
    } catch (error) {
        return res.status(500).json({ message: "Gagal mengambil detail supplier.", error: error.message });
    }
};

exports.saveSupplier = async (req, res) => {
    try {
        const body = req.body || {};
        const payload = body.header && typeof body.header === "object" ? body.header : body;
        const isEditMode =
            typeof body.isEditMode === "boolean"
                ? body.isEditMode
                : req.method === "PUT";

        if (!String(payload?.Nama || "").trim()) {
            return res.status(400).json({ message: "Nama supplier wajib diisi." });
        }

        const result = await supplierService.saveSupplier(payload, isEditMode, getUserLogin(req));
        return res.status(200).json({ message: "Data supplier berhasil disimpan.", kode: result.kode });
    } catch (error) {
        return res.status(500).json({ message: "Gagal simpan data supplier.", error: error.message });
    }
};

exports.deleteSupplier = async (req, res) => {
    try {
        const { kode } = req.params;
        if (!kode) {
            return res.status(400).json({ message: "Kode supplier wajib diisi." });
        }

        const isDeleted = await supplierService.deleteSupplier(kode);
        if (!isDeleted) {
            return res.status(404).json({ message: `Kode supplier ${kode} tidak ditemukan.` });
        }

        return res.status(200).json({ message: `Supplier ${kode} berhasil dihapus.` });
    } catch (error) {
        return res.status(500).json({ message: "Gagal menghapus supplier.", error: error.message });
    }
};
