// backend/src/controllers/poMmt.controller.js

// Menggunakan require untuk mengimpor module.exports dari poMmt.service.js
const poMmtService = require('../services/poBahanMmt.service.js'); 

// 1. READ ALL (GET /)
exports.browsePO = async (req, res) => {
    try {
        const { startDate, endDate, supplier } = req.query;

        if (!startDate || !endDate) return res.status(400).json({ message: "Tanggal mulai dan akhir wajib diisi." });

        // Memanggil fungsi dari service
        const data = await poMmtService.getPoMmtData(startDate, endDate, supplier);

        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ message: "Gagal mengambil data PO.", error: error.message });
    }
};

// 2. READ ONE (GET /:nomor)
exports.getPOById = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await poMmtService.getPOById(nomor);

        if (!data) return res.status(404).json({ message: "Nomor PO tidak ditemukan." });

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat data PO.", error: error.message });
    }
};

exports.getDetailsPO = async (req, res) => {
    try {
        const { nomor } = req.query; // Diterima dari query parameter URL (misal: ?nomor=PO123)

        if (!nomor) {
            return res.status(400).json({ message: "Nomor PO wajib diisi untuk melihat detail." });
        }

        const data = await poMmtService.getPoDetailByNomor(nomor);

        // Mengembalikan array detail item
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ message: "Gagal memuat detail PO.", error: error.message });
    }
};

// 3. SAVE (POST/PUT)
exports.savePO = async (req, res) => {
    try {
        const data = req.body;
        const nomorToEdit = data.nomor;
        const currentUser = req.user ? req.user.KDUSER : data.user || 'SYSTEM';
        
        if (!data.supKode || !data.detail || !data.detail.some(d => d.kode && d.jumlah > 0 && d.harga > 0)) {
            return res.status(400).json({ message: 'Validasi Gagal.', error: 'Supplier, Kode Item, QTY, dan Harga wajib diisi.' });
        }
        
        const result = await poMmtService.savePoMmt(data, nomorToEdit, currentUser);

        res.status(200).json({ message: 'Data berhasil disimpan.', nomor: result.Nomor });

    } catch (error) {
        res.status(400).json({ message: 'Gagal Simpan.', error: error.message });
    }
};

// 4. DELETE (DELETE /:nomor)
exports.deletePO = async (req, res) => {
    try {
        const { nomor } = req.params;

        if (!nomor) { return res.status(400).json({ message: "Nomor transaksi wajib diisi." }); }

        const isDeleted = await poMmtService.deletePoMmt(nomor);

        if (isDeleted) {
            return res.status(200).json({ message: `PO dengan nomor ${nomor} berhasil dihapus.` });
        } else {
            return res.status(404).json({ message: `Gagal menghapus PO. Nomor ${nomor} tidak ditemukan.` });
        }

    } catch (error) {
        return res.status(500).json({ message: "Gagal menghapus PO.", error: error.message });
    }
};

// 5. TOGGLE CLOSE (PUT /:nomor/toggle-close)
exports.toggleClose = async (req, res) => {
    try {
        const { nomor } = req.params;
        const { action, user } = req.body;
        
        await poMmtService.toggleCloseStatus(nomor, action, user);

        res.status(200).json({ message: `PO berhasil di-${action}` });
    } catch (error) {
        res.status(500).json({ message: `Gagal mengubah status PO.`, error: error.message });
    }
};

// 6. LOAD MKB DETAIL (GET /load-mkb/:nomor)
exports.loadMkbDetail = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await poMmtService.loadMkbDetail(nomor);
        
        return res.status(200).json(data); 

    } catch (error) {
        return res.status(404).json({ message: "Gagal memuat detail MKB.", error: error.message });
    }
};

exports.getPoDataForPrint = async (req, res) => {
    const { nomor } = req.params; // Mengambil nomor PO dari URL
    
    try {
        // Panggil fungsi service yang baru kita buat
        const data = await poMmtService.getPoDataForPrint(nomor);
        
        if (!data) {
            return res.status(404).json({ message: "Data Purchase Order tidak ditemukan untuk dicetak." });
        }
        
        // Mengirimkan data yang sudah diformat ke frontend (PoPrintView.vue)
        return res.status(200).json(data); 

    } catch (error) {
        console.error("Error di getPoDataForPrint:", error.message);
        // Mengirimkan error 500 jika terjadi kegagalan di service/SQL
        return res.status(500).json({ message: "Gagal memuat data cetak PO karena error server internal.", error: error.message });
    }
};

exports.getUnfulfilledMbDetail = async (req, res) => {
    // Parameter mbNomor dikirim dari route
    const { mbNomor } = req.params;

    if (!mbNomor) {
        return res.status(400).json({ message: "Nomor Permintaan Bahan (MB) harus disediakan." });
    }
    
    // Decode jika ada karakter khusus (seperti '/')
    const decodedMbNomor = decodeURIComponent(mbNomor);

    try {
        // Panggil fungsi service yang baru dibuat
        const data = await poMmtService.getUnfulfilledMbDetail(decodedMbNomor);

        // Cek jika tidak ada item yang belum terpenuhi
        if (!data.Detail || data.Detail.length === 0) {
            return res.status(404).json({ 
                message: `Permintaan Bahan ${decodedMbNomor} sudah ter-PO seluruhnya atau tidak memiliki detail item yang valid.`,
                Detail: [] 
            });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Error fetching unfulfilled MB detail:", error);
        res.status(500).json({ message: `Gagal memuat detail permintaan bahan: ${error.message}` });
    }
};