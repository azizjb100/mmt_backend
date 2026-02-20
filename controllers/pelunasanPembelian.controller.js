const pelunasanService = require('../services/pelunasanPembelian.service');

// =============================
// SAVE PELUNASAN (INSERT)
// =============================
exports.savePelunasan = async (req, res) => {
    try {
        const currentUser = req.user?.username || 'SYSTEM';
        const data = req.body;

        // Validasi dasar
        if (!data.pelh_tanggal || !data.pelh_sup_kode || !data.pelh_akun_kas) {
            return res.status(400).json({ 
                message: "Data tidak lengkap (Tanggal, Supplier, dan Akun Kas wajib diisi)" 
            });
        }

        if (!data.detail || data.detail.length === 0) {
            return res.status(400).json({ 
                message: "Pilih minimal satu invoice untuk dilunasi" 
            });
        }

        const result = await pelunasanService.savePelunasan(data, currentUser);

        res.status(200).json({
            message: "Pelunasan berhasil disimpan dan dijurnal",
            data: result
        });
    } catch (error) {
        console.error("SAVE PELUNASAN ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};

// =============================
// GET OUTSTANDING INVOICES
// =============================
// Digunakan saat user pilih supplier, maka muncul list invoice yang belum lunas
exports.getOutstanding = async (req, res) => {
    try {
        const { supKode } = req.params;
        if (!supKode) {
            return res.status(400).json({ message: "Kode Supplier wajib diisi" });
        }

        const data = await pelunasanService.getOutstandingInvoices(supKode);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// =============================
// GENERATE NEXT NOMOR
// =============================
exports.getNextNomor = async (req, res) => {
    try {
        const { kodePerush, tanggal } = req.query;
        if (!kodePerush || !tanggal) {
            return res.status(400).json({ message: 'kodePerush dan tanggal wajib diisi' });
        }

        const nomor = await pelunasanService.generateNomorPelunasan(kodePerush, tanggal);
        res.json({ nextNomor: nomor });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};