// backend/src/controllers/permintaanProduksi.controller.js

const permintaanProduksiService = require('../services/permintaanProduksi.service');

// 1. READ ALL (Browse)
exports.getPermintaanProduksi = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ message: "Tanggal wajib diisi." });

        const data = await permintaanProduksiService.getPermintaanProduksiData(startDate, endDate);
        return res.status(200).json({ message: 'Pengambilan data transaksi berhasil.', data: data });

    } catch (error) {
        return res.status(500).json({ message: "Gagal mengambil data transaksi.", error: error.message });
    }
};

// 2. DELETE
exports.deletePermintaanProduksi = async (req, res) => {
    try {
        const { nomor } = req.params;
        // Asumsi cek hak akses dilakukan di sini
        const isDeleted = await permintaanProduksiService.deletePermintaanProduksi(nomor);

        if (isDeleted) return res.status(200).json({ message: `Transaksi ${nomor} berhasil dihapus.` });
        return res.status(404).json({ message: `Nomor ${nomor} tidak ditemukan.` });

    } catch (error) {
        return res.status(500).json({ message: "Gagal menghapus transaksi.", error: error.message });
    }
};

exports.savePermintaanProduksi = async (req, res) => {
    let Nomor = null; 

    try {
        const { header, details, isEditMode } = req.body;
        const isUpdate = isEditMode || (req.method === 'PUT');
        
        // Cek Keberadaan Header
        if (!header) {
            return res.status(400).json({ 
                message: "Validasi Gagal.", 
                error: "Header transaksi tidak ditemukan." 
            });
        }

        // --- 1. Penentuan Nomor Transaksi ---
        Nomor = header.nomor && header.nomor !== 'AUTO' ? header.nomor : null;

        if (!Nomor && !isUpdate) { // HANYA buat nomor baru jika bukan update
            const prefix = 'MMT';
            const newNomor = await permintaanProduksiService.getNewNomor(prefix); 
            
            if (!newNomor) {
                throw new Error("Gagal mendapatkan nomor transaksi otomatis dari service.");
            }
            Nomor = newNomor;

        } else if (!Nomor && isUpdate) {
            return res.status(400).json({ 
                message: "Validasi Gagal.", 
                error: "Nomor transaksi wajib diisi untuk mode edit." 
            });
        }
        
        if (!Nomor) {
            throw new Error("Nomor transaksi tidak berhasil ditentukan.");
        }

        const normalizedDetails = (details || []).map(d => ({
            Kode: d.sku || d.Kode,
            Jumlah: parseFloat(d.qty ?? d.Jumlah ?? 0), 
            // Hargabeli dikembalikan jika diperlukan oleh trigger/proses lain
            Hargabeli: parseFloat(d.hargabeli ?? d.Hargabeli ?? 0), 
            Satuan: d.satuan || d.Satuan || null,
            Operator: d.operator || d.Operator || null,
            Nomor_SPK: d.spk || d.nomor_spk || d.Nomor_SPK || null,
            Keterangan: d.keterangan || d.Keterangan || null,
        }));
        const uniqueDetailsMap = new Map();
        normalizedDetails.forEach(d => {
            uniqueDetailsMap.set(d.Kode, d); 
        });

        // --- Perubahan Kunci di serviceData ---
        const serviceData = {
            Nomor, 
            Gudang: header.mnt_gdg_kode,             // Gudang Sumber (OUT) -> masuk ke mnt_gdg_kode
            LokasiProduksi: header.mnt_lokasiproduksi, // Gudang Tujuan (IN) -> masuk ke mnt_lokasiproduksi
            Tanggal: header.tanggal,
            Keterangan: header.mnt_keterangan || null,
            User: header.user_modified || header.user_create || 'SYSTEM',
            Details: Array.from(uniqueDetailsMap.values()) 
        };

        // --- 3. VALIDASI WAJIB (Pre-Service) ---
        if (!serviceData.Gudang) {
            return res.status(400).json({
                message: "Validasi Gagal.", 
                error: "Kode Gudang Sumber (mnt_gdg_kode) wajib diisi."
            });
        }

        // --- Validasi Tambahan untuk Gudang Tujuan (Lokasi Produksi) ---
        if (!serviceData.LokasiProduksi) {
            return res.status(400).json({
                message: "Validasi Gagal.", 
                error: "Lokasi Produksi (mnt_lokasiproduksi) wajib diisi untuk stok IN."
            });
        }

        // --- 4. PROSES SIMPAN ---
        const result = await permintaanProduksiService.savePermintaanProduksi(serviceData, isUpdate);

        // --- 5. RESPONSE SUKSES ---
        return res.status(200).json({
            message: isUpdate 
                ? `Transaksi ${result.nomor} berhasil diubah.` 
                : `Transaksi ${result.nomor} berhasil disimpan.`,
            nomor: result.nomor
        });

    } catch (error) {
        console.error("Error saving Permintaan Produksi:", error);

        // RESPONSE ERROR
        return res.status(500).json({
            message: "Gagal menyimpan/mengubah transaksi.",
            error: error.message || "Error tidak diketahui saat memproses data." 
        });
    }
};