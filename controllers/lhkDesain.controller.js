const lhkDesainService = require('../services/lhkDesain.service');

/**
 * Mendapatkan seluruh data gabungan LHK Desain (Header + 3 Grid Detail)
 * URL: GET /api/mmt/lhk-desain/load-all/:nomorSpk
 */
exports.loadAllLhkDesain = async (req, res) => {
    try {
        const { nomorSpk } = req.params;

        if (!nomorSpk) {
            return res.status(400).json({
                success: false,
                message: 'Nomor SPK/MAP tidak boleh kosong.'
            });
        }

        const result = await lhkDesainService.getFullLhkDesain(nomorSpk);

        // Jika SPK tidak ditemukan di database master
        if (!result) {
            return res.status(200).json({
                success: true,
                message: 'Data SPK/MAP tidak ditemukan.',
                data: { header: null, status: [], komponen: [], bordir: [] }
            });
        }

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error di loadAllLhkDesain:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal memuat rincian data LHK Desain.'
        });
    }
};

/**
 * Menyimpan data LHK Desain (Bisa mode INSERT baru atau UPDATE/EDIT)
 * URL: POST /api/mmt/lhk-desain/save
 */
exports.saveLhkDesain = async (req, res) => {
    try {
        const data = req.body;
        
        // Ambil data user dari session / middleware auth jika ada, fallback ke 'OPERATOR'
        const userLogin = req.user?.user_kode || localStorage?.getItem?.('user_kode') || 'OPERATOR';

        if (!data.header || !data.header.ld_spk) {
            return res.status(400).json({
                success: false,
                message: 'Struktur payload tidak valid. Nomor SPK utama wajib diisi.'
            });
        }

        const result = await lhkDesainService.saveLhkDesain(data, userLogin);

        return res.status(200).json({
            success: true,
            message: 'Data LHK Desain berhasil disimpan.',
            nomorSpk: result.nomorSpk
        });

    } catch (error) {
        console.error('Error di saveLhkDesain:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal menyimpan transaksi LHK Desain.'
        });
    }
};

/**
 * Validasi komponen bahan secara instan (Saat ketik kode langsung / F1 di Grid)
 * URL: GET /api/mmt/lhk-desain/validate-bahan
 */
exports.validateBahan = async (req, res) => {
    try {
        const { kode, output } = req.query;

        if (!kode || !output) {
            return res.status(400).json({
                success: false,
                message: 'Parameter kode dan tipe output wajib dikirim.'
            });
        }

        const result = await lhkDesainService.validateBahanLhk(kode, output);

        return res.status(200).json(result);

    } catch (error) {
        console.error('Error di validateBahan:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Gagal memproses validasi bahan.'
        });
    }
};