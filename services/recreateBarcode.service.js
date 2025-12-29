const pool = require('../config/db.config');
const { format } = require('date-fns');

exports.createManualBarcode = async (data, user) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const now = new Date();
        const formattedDate = format(new Date(data.tanggal), 'yyyy-MM-dd');
        const ym = format(new Date(data.tanggal), 'yyMM');

        // 1. Generate Nomor Referensi Manual (Contoh: MMT.GEN.2405.0001)
        const [maxRef] = await conn.query(
            "SELECT MAX(CAST(RIGHT(mst_noreferensi, 4) AS UNSIGNED)) as max_num FROM tmasterstok_mmt WHERE mst_noreferensi LIKE ?",
            [`MMT.GEN.${ym}.%`]
        );
        const nextNum = (maxRef[0].max_num || 0) + 1;
        const noRef = `MMT.GEN.${ym}.${String(nextNum).padStart(4, '0')}`;

        // 2. Ambil urutan barcode terakhir untuk bahan tersebut
        const [maxBarcode] = await conn.query(
            "SELECT MAX(CAST(RIGHT(mst_barcode, 3) AS UNSIGNED)) as max_seq FROM tmasterstok_mmt WHERE mst_barcode LIKE ?",
            [`${data.kodeBahan}-${ym}-%`]
        );
        let currentSeq = (maxBarcode[0].max_seq || 0);

        const results = [];
        const qty = parseInt(data.qty);

        // 3. Loop sesuai jumlah Roll yang ingin dibuat
        for (let i = 1; i <= qty; i++) {
            currentSeq++;
            const barcode = `${data.kodeBahan}-${ym}-${String(currentSeq).padStart(3, '0')}`;
            
            const sqlStok = `
                INSERT INTO tmasterstok_mmt (
                    mst_brg_kode, mst_barcode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                    mst_panjang, mst_lebar, mst_noreferensi, mst_tanggal, mst_hargabeli
                ) VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, 0)
            `;
            
            await conn.query(sqlStok, [
                data.kodeBahan, barcode, data.gudangKode, 
                data.panjang, data.lebar, noRef, formattedDate
            ]);

            results.push({ barcode, namaBahan: data.namaBahan });
        }

        await conn.commit();
        return { nomor: noRef, barcodes: results };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};