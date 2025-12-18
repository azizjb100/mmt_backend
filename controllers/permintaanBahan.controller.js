// backend/src/controllers/permintaanBahan.controller.js

const permintaanBahanService = require('../services/permintaanBahan.service');
const format = require('date-fns/format'); 

// 1. READ ALL (GET /)
exports.getPermintaanBahan = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) return res.status(400).json({ message: "Tanggal wajib diisi." });

        const data = await permintaanBahanService.getPermintaanBahanData(startDate, endDate);

        return res.status(200).json({ message: 'Pengambilan data transaksi berhasil.', data: data });

    } catch (error) {
        return res.status(500).json({ message: "Gagal mengambil data transaksi.", error: error.message });
    }
};

exports.lookupPermintaanBahan = async (req, res) => {
    try {
        const { startDate, endDate, status } = req.query;

        // 30 hari yang lalu
        const defaultStartDate =
            startDate ||
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10);

        const defaultEndDate =
            endDate ||
            new Date().toISOString().slice(0, 10);

        const data = await permintaanBahanService.getPermintaanBahanForLookup(
            defaultStartDate,
            defaultEndDate,
            status
        );

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({
            message: "Gagal memuat data lookup Permintaan Bahan.",
            error: error.message
        });
    }
};

exports.getPermintaanBahanByNomor = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await permintaanBahanService.getPermintaanBahanByNomor(nomor);
    
        if (!data || Object.keys(data).length === 0) {
             return res.status(404).json({ message: 'Data Permintaan Bahan tidak ditemukan.' });
        }

        res.status(200).json(data);
    } catch (error) {
        // Tangkap error 404 dari service
        if (error.message.includes('tidak ditemukan')) {
            return res.status(404).json({ message: error.message });
        }
        console.error('Error fetching Permintaan Bahan by ID:', error);
        res.status(500).json({ message: 'Gagal mengambil data transaksi.', error: error.message });
    }
};


// 3. SAVE (POST/PUT)
exports.savePermintaanBahan = async (req, res) => {
  try {
    const data = req.body;
        // Ambil nomor yang akan diedit dari body (dikirim oleh frontend)
    const nomorToEdit = data.NomorToEdit || null; 
    const currentUser = req.user ? req.user.KDUSER : 'SYSTEM'; 
    
    // Validasi Cepat 
    if ( !data.Detail || !data.Detail.every(d => d.SKU && d.QTY > 0)) {
      return res.status(400).json({ message: 'Validasi Gagal.', error: 'Gudang, Kode Material, dan QTY wajib diisi.' });
    }
    
    // Panggil service yang berisi logika INSERT/UPDATE/TRANSACTION
    // Kirim nomorToEdit dari body ke service
    const result = await permintaanBahanService.savePermintaanBahan(data, nomorToEdit, currentUser);

    res.status(200).json({ message: 'Data berhasil disimpan.', Nomor: result.Nomor }); // Kirim Nomor Baru ke Frontend

  } catch (error) {
    res.status(400).json({ message: 'Gagal Simpan.', error: error.message });
  }
};

// ===================================
// 3. DELETE (DELETE /:nomor) - Replikasi cxButton4Click
// ===================================
exports.deletePermintaanBahan = async (req, res) => {
    try {
        const { nomor } = req.params;

        if (!nomor) { return res.status(400).json({ message: "Nomor transaksi wajib diisi." }); }

        // Panggil service untuk menghapus Master dan Detail
        const isDeleted = await permintaanBahanService.deletePermintaanBahan(nomor);

        if (isDeleted) {
            return res.status(200).json({ message: `Transaksi dengan nomor ${nomor} berhasil dihapus.` });
        } else {
            return res.status(404).json({ message: `Gagal menghapus transaksi. Nomor ${nomor} tidak ditemukan.` });
        }

    } catch (error) {
        return res.status(500).json({ message: "Gagal menghapus transaksi.", error: error.message });
    }
};


exports.getPermintaanBahanForPrint = async (req, res) => {
    try {
        const { nomor } = req.params;

        if (!nomor) {
            return res.status(400).json({ message: "Nomor Permintaan wajib diisi untuk dicetak." });
        }

        // Panggil service yang spesifik untuk mengambil data dalam format cetak
        const data = await permintaanBahanService.getPermintaanBahanForPrint(nomor);

        // Mengirimkan data dalam format yang siap digunakan oleh komponen Vue.js (frontend)
        return res.status(200).json(data); 

    } catch (error) {
        // Handle error seperti data tidak ditemukan atau kesalahan database
        const status = error.message.includes("tidak ditemukan") ? 404 : 500;
        return res.status(status).json({ 
            message: "Gagal memuat data cetak Permintaan Bahan.", 
            error: error.message 
        });
    }
};