// backend/src/controllers/permintaanBahan.controller.js

const permintaanBahanService = require('../services/permintaanBahan.service');
const format = require('date-fns/format');

// 1. READ ALL (GET /)
exports.getPermintaanBahan = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // 1. Validasi Input Tanggal
        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Tanggal wajib diisi." });
        }

        // 2. AMBIL DIVISI DARI USER LOGIN
        // Pastikan middleware auth Anda menyimpan data user di req.user
        // Sesuaikan nama propertinya (misal: kd_divisi, divisi_id, atau divisi)
        const divisi = req.user.kd_divisi || req.user.divisi;

        if (!divisi) {
            return res.status(403).json({ 
                message: "Akses ditolak. Divisi user tidak ditemukan dalam sesi login." 
            });
        }

        // 3. KIRIM 3 PARAMETER KE SERVICE
        const data = await permintaanBahanService.getPermintaanBahanData(startDate, endDate, divisi);

        return res.status(200).json({ 
            message: 'Pengambilan data transaksi berhasil.', 
            divisi_aktif: divisi, // Opsional: untuk debug di frontend
            data: data 
        });

    } catch (error) {
        console.error("Error Controller getPermintaanBahan:", error);
        return res.status(500).json({ 
            message: "Gagal mengambil data transaksi.", 
            error: error.message 
        });
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
// backend/src/controllers/permintaanBahan.controller.js

exports.savePermintaanBahan = async (req, res) => {
    try {
        const data = req.body;
        const nomorToEdit = data.NomorToEdit || null;

        // Pastikan mengambil key yang benar dari payload JWT (kdUser atau nmUser)
        // Jika di login payload pakai 'kdUser', maka ambil 'kdUser'
        const currentUser = req.user ? req.user.kdUser : 'SYSTEM';

        // Panggil service
        const result = await permintaanBahanService.savePermintaanBahan(
            data,
            nomorToEdit,
            currentUser
        );

        res.status(200).json({
            message: 'Data berhasil disimpan.',
            Nomor: result.Nomor,
            oleh: currentUser
        });
    } catch (error) {
        res.status(400).json({ message: 'Gagal Simpan.', error: error.message });
    }
};

exports.approvePermintaan = async (req, res) => {
    try {
        const { nomor, role } = req.body;

        // AMBIL USER DARI TOKEN (Sama seperti saat Save Data)
        // Jika payload JWT Anda namanya 'user_nama', maka: req.user.user_nama
        const userPengklik = req.user.user_nama || req.user.kdUser;

        let success = false;
        if (role === 'SPV') {
            success = await permintaanBahanService.approveBySPV(nomor, userPengklik);
        } else {
            success = await permintaanBahanService.approveByManager(nomor, userPengklik);
        }

        if (success) res.json({ message: "Berhasil Approval" });
        else res.status(400).json({ message: "Gagal Approval" });
    } catch (error) {
        res.status(500).json({ message: error.message });
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