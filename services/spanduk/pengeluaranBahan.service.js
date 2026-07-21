const pool = require("../../config/db.config");

const throwDbError = (message, error) => {
    throw new Error(message + ": " + error.message);
};


exports.getMintaPenolongHeader = async ({ startDate, endDate } = {}) => {
    try {
        const sql = `
            SELECT 
                a.mnt2p_nomor AS Nomor,
                a.mnt2p_lokasiproduksi AS Lokasi,
                DATE_FORMAT(a.mnt2p_Tanggal, '%d-%M-%Y') AS Tanggal,
                a.mnt2p_Tanggal AS RawTanggal,
                a.mnt2p_gdg_kode AS Gudang,
                c.gdg_nama AS \`Nama Gudang\`,
                a.mnt2p_keterangan AS Keterangan,
                a.mnt2p_divisiproduksi AS \`Divisi Produksi\`
            FROM tminta2p_hdr a
            INNER JOIN tgudang c ON c.gdg_kode = a.mnt2p_gdg_kode
            WHERE a.mnt2p_tanggal BETWEEN ? AND ?
              AND IFNULL(a.mnt2p_type, 0) = 1
            GROUP BY a.mnt2p_nomor, a.mnt2p_tanggal
            ORDER BY a.mnt2p_tanggal DESC, a.mnt2p_nomor DESC
        `;

        const [rows] = await pool.query(sql, [startDate, endDate]);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil data header Permintaan Bahan Penolong", error);
    }
};

/**
 * Mengambil data Detail Permintaan Bahan Penolong berdasarkan filter tanggal
 */
exports.getMintaPenolongDetail = async ({ startDate, endDate } = {}) => {
    try {
        const sql = `
            SELECT 
                mnt2pd_mnt2p_nomor AS Nomor,
                mnt2pd_brg_kode AS \`Kode Bahan\`,
                a.brg_nama AS \`Nama Bahan\`,
                a.brg_gramasi AS Spesifikasi,
                mnt2pd_qty AS Jumlah,
                mnt2pd_keterangan AS Keterangan
            FROM tminta2p_dtl
            INNER JOIN tminta2p_hdr ON mnt2p_nomor = mnt2pd_mnt2p_nomor
            LEFT JOIN tbarang_penolong a ON a.brg_kode = mnt2pd_brg_kode
            WHERE mnt2p_tanggal BETWEEN ? AND ?
              AND IFNULL(mnt2p_type, 0) = 1
            ORDER BY mnt2p_nomor ASC, mnt2pd_nourut ASC
        `;

        const [rows] = await pool.query(sql, [startDate, endDate]);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil data detail Permintaan Bahan Penolong", error);
    }
};

/**
 * Mengambil Detail spesifik berdasarkan Nomor Dokumen
 */
exports.getMintaPenolongByNomor = async (nomor) => {
    try {
        const sqlHeader = `
            SELECT 
                a.mnt2p_nomor AS Nomor,
                a.mnt2p_lokasiproduksi AS Lokasi,
                a.mnt2p_Tanggal AS Tanggal,
                a.mnt2p_gdg_kode AS Gudang,
                c.gdg_nama AS NamaGudang,
                a.mnt2p_keterangan AS Keterangan,
                a.mnt2p_divisiproduksi AS DivisiProduksi
            FROM tminta2p_hdr a
            INNER JOIN tgudang c ON c.gdg_kode = a.mnt2p_gdg_kode
            WHERE a.mnt2p_nomor = ?
            LIMIT 1
        `;

        const sqlDetail = `
            SELECT 
                d.mnt2pd_nourut AS NoUrut,
                d.mnt2pd_brg_kode AS KodeBahan,
                b.brg_nama AS NamaBahan,
                b.brg_gramasi AS Spesifikasi,
                d.mnt2pd_qty AS Jumlah,
                d.mnt2pd_keterangan AS Keterangan
            FROM tminta2p_dtl d
            LEFT JOIN tbarang_penolong b ON b.brg_kode = d.mnt2pd_brg_kode
            WHERE d.mnt2pd_mnt2p_nomor = ?
            ORDER BY d.mnt2pd_nourut ASC
        `;

        const [headers] = await pool.query(sqlHeader, [nomor]);
        if (!headers.length) throw new Error("Dokumen Permintaan tidak ditemukan.");

        const [details] = await pool.query(sqlDetail, [nomor]);

        return {
            header: headers[0],
            details
        };
    } catch (error) {
        throwDbError(`Gagal mengambil dokumen nomor ${nomor}`, error);
    }
};

/**
 * Fungsi Cek Realisasi (Ekuivalen fungsi cekdatarealisasi Delphi)
 */
const cekDataRealisasi = async (nomor, conn = pool) => {
    const sql = `SELECT rl_nomor FROM trealisasi_hdr WHERE rl_mnt2_nomor = ? LIMIT 1`;
    const [rows] = await conn.query(sql, [nomor]);
    return rows.length > 0;
};
exports.cekDataRealisasi = cekDataRealisasi;

/**
 * Hapus Dokumen Permintaan Bahan Penolong (Header & Detail)
 */
exports.deleteMintaPenolong = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Validasi apakah sudah ada realisasi
        const isRealisasi = await cekDataRealisasi(nomor, conn);
        if (isRealisasi) {
            throw new Error("Data tidak dapat dihapus karena sudah direalisasi.");
        }

        // 2. Hapus detail dokumen
        const sqlDeleteDtl = `DELETE FROM tminta2p_dtl WHERE mnt2pd_mnt2p_nomor = ?`;
        await conn.query(sqlDeleteDtl, [nomor]);

        // 3. Hapus header dokumen
        const sqlDeleteHdr = `DELETE FROM tminta2p_hdr WHERE mnt2p_nomor = ?`;
        const [resHdr] = await conn.query(sqlDeleteHdr, [nomor]);

        if (resHdr.affectedRows === 0) {
            throw new Error("Dokumen tidak ditemukan atau sudah dihapus.");
        }

        await conn.commit();
        return { message: `Dokumen ${nomor} berhasil dihapus.` };
    } catch (error) {
        await conn.rollback();
        throwDbError("Gagal menghapus Permintaan Bahan Penolong", error);
    } finally {
        conn.release();
    }
};