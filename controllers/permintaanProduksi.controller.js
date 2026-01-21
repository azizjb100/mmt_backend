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

exports.getStokByBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        if (!barcode) {
            return res.status(400).json({ message: "Barcode tidak boleh kosong." });
        }

        const data = await permintaanProduksiService.getStokByBarcode(barcode);

        if (!data) {
            return res.status(404).json({ message: "Data barcode tidak ditemukan di Master Stok." });
        }

        return res.status(200).json({
            message: 'Data barcode ditemukan.',
            data: data
        });

    } catch (error) {
        return res.status(500).json({
            message: "Gagal mengambil data barcode.",
            error: error.message
        });
    }
};

// --- 2. SAVE (POST/PUT) ---
exports.savePermintaanProduksi = async (req, res) => {
    try {
        const { header, details, isEditMode } = req.body;
        const isUpdate = isEditMode || (req.method === 'PUT');

        if (!header) return res.status(400).json({ message: "Header tidak ditemukan." });

        let Nomor = header.nomor && header.nomor !== 'AUTO' ? header.nomor : null;

        // Mapping Detail: Pastikan index digunakan sebagai no urut
        const normalizedDetails = (details || []).map((d, index) => ({
            sku: d.sku,
            barcode: d.barcode,
            qty: parseFloat(d.qty || 0),
            satuan: d.satuan || null,
            spk: d.spk || "0",
            keterangan: d.keterangan || null,
            nourut: index + 1 // Menghasilkan 1, 2, 3...
        }));

        const serviceData = {
            Nomor,
            Gudang: header.mnt_gdg_kode,
            LokasiProduksi: header.mnt_lokasiproduksi,
            Tanggal: header.tanggal,
            Keterangan: header.mnt_keterangan || null,
            User: header.user_create || 'ADMIN',
            Details: normalizedDetails
        };

        const result = await permintaanProduksiService.savePermintaanProduksi(serviceData, isUpdate);
        return res.status(200).json({ message: "Berhasil disimpan", nomor: result.nomor });

    } catch (error) {
        return res.status(500).json({ message: "Gagal simpan.", error: error.message });
    }
};

