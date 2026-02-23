const pelunasanService = require('../services/pelunasanPembelian.service');

// =============================
// SAVE PELUNASAN (INSERT)
// =============================
exports.savePelunasan = async (req, res) => {
    try {
        // SAMAKAN DENGAN INVOICE & PERMINTAAN: Ambil kdUser dari token
        const currentUser = req.user ? (req.user.kdUser || req.user.username) : 'SYSTEM';
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

        // Teruskan data dan currentUser ke service
        const result = await pelunasanService.savePelunasan(data, currentUser);

        res.status(200).json({
            message: "Pelunasan berhasil disimpan dan dijurnal",
            data: result,
            oleh: currentUser // Untuk audit di response
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

// Menampilkan semua list pelunasan
exports.getPelunasanList = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Periode tanggal harus diisi" });
        }

        const data = await pelunasanService.getPelunasanData(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


exports.getOutstandingGlobal = async (req, res) => {
    try {
        // Karena ini Global, kita tidak perlu memfilter berdasarkan supKode
        const data = await pelunasanService.getAllOutstandingGlobal();
        
        // Sesuaikan format response agar konsisten dengan Frontend (.data.data)
        res.json({ 
            status: 'success', 
            data: data 
        });
    } catch (error) {
        console.error("Controller Error:", error);
        res.status(500).json({ message: error.message });
    }
};


exports.getRekapHutang = async (req, res) => {
    try {
        const data = await pelunasanService.getSaldoHutangRekap();
        res.json(res.json({ status: 'success', data }));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};