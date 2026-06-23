const pool = require('../config/db.config');
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-P';

/**
 * Menghasilkan Nomor LHK Pola Baru secara otomatis (Format: MMT-LHK-P.YYMM.XXXX)
 */
const generateNewNomor = async (date) => {
    const dateToUse = date instanceof Date ? date : new Date(date);
    const yymm = format(dateToUse, 'yyMM');
    const prefixLike = `${NOMERATOR}.${yymm}.%`;

    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING(lhp_nomor, -4) AS UNSIGNED)) AS max_num
        FROM tlhk_pola_hdr
        WHERE lhp_nomor LIKE ?
    `;

    const [rows] = await pool.query(sqlMax, [prefixLike]);
    const maxNum = rows && rows.length > 0 ? (rows[0].max_num || 0) : 0;

    let newSequence = maxNum + 1;
    const formattedSequence = String(newSequence).padStart(4, '0');

    return `${NOMERATOR}.${yymm}.${formattedSequence}`;
};

/**
 * Logika Transaksi Penyimpanan Data LHK Pola (Header & Detail)
 */
const saveLhkPola = async (headerData, detailsData, existingNomor, files = {}) => {
    const conn = await pool.getConnection();
    let isEditMode = !!existingNomor;
    let finalNomor = existingNomor;

    try {
        await conn.beginTransaction();

        const now = new Date();
        const dateToUse = headerData.tanggal ? new Date(headerData.tanggal) : now;
        const formattedDate = format(dateToUse, 'yyyy-MM-dd');
        const formattedNow = format(now, 'yyyy-MM-dd HH:mm:ss');
        
        if (!isEditMode) {
            finalNomor = await generateNewNomor(dateToUse);
        }

        if (isEditMode) {
            // 1. Update Header Lama
            await conn.query(`
                UPDATE tlhk_pola_hdr SET
                    lhp_tanggal = ?, lhp_shift = ?, lhp_operator = ?, 
                    lhp_keterangan = ?, lhp_date_modified = ?
                WHERE lhp_nomor = ?
            `, [formattedDate, headerData.shift, headerData.operator, headerData.keterangan || '', formattedNow, finalNomor]);

            // 2. Ambil snapshot data detail lama untuk menjaga persistensi path gambar jika tidak di-upload ulang
            const [oldDetails] = await conn.query(
                `SELECT lpd_urut, lpd_path_gambar FROM tlhk_pola_dtl WHERE lpd_lnomor = ?`, 
                [finalNomor]
            );
            const oldImagesMap = new Map(oldDetails.map(d => [d.lpd_urut, d.lpd_path_gambar]));

            // 3. Hapus Detail Lama
            await conn.query(`DELETE FROM tlhk_pola_dtl WHERE lpd_lnomor = ?`, [finalNomor]);
            
            // Map kembali path gambar lama ke payload jika baris tersebut tidak mengunggah berkas baru
            detailsData.forEach((d, idx) => {
                const urutBaris = idx + 1;
                if (!files[`images_${idx}`] && oldImagesMap.has(urutBaris)) {
                    d.path_gambar_lama = oldImagesMap.get(urutBaris);
                }
            });
        } else {
            // Insert Header Baru
            await conn.query(`
                INSERT INTO tlhk_pola_hdr (
                    lhp_nomor, lhp_tanggal, lhp_shift, lhp_operator, lhp_keterangan, lhp_date_create
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [finalNomor, formattedDate, headerData.shift, headerData.operator, headerData.keterangan || '', formattedNow]);
        }

        // 4. Insert Baris Detail Pola Baru
        for (let i = 0; i < detailsData.length; i++) {
            const d = detailsData[i];
            const urut = i + 1;
            
            let pathGambar = null;
            if (files[`images_${i}`]) {
                pathGambar = `/uploads/pola/${files[`images_${i}`][0].filename}`;
            } else if (d.path_gambar_lama) {
                pathGambar = d.path_gambar_lama;
            }

            await conn.query(`
                INSERT INTO tlhk_pola_dtl (
                    lpd_lnomor, lpd_urut, lpd_spk_nomor, lpd_spk_nama, 
                    lpd_jenis_pola, lpd_panjang, lpd_lebar, lpd_jml_pola, lpd_path_gambar
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [finalNomor, urut, d.nomor_spk, d.nama_spk, d.jenis_pola || 'POLA JAHIT STANDAR', Number(d.panjang) || 0, Number(d.lebar) || 0, Number(d.jml_pola) || 1, pathGambar]);
        }

        await conn.commit();
        return { nomor: finalNomor };
    } catch (err) {
        if (conn) await conn.rollback();
        throw err;
    } finally {
        if (conn) conn.release();
    }
};

/**
 * Sinkronisasi Data LHK Pola Berdasarkan Nomor (Get Detail Form)
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            h.lhp_nomor AS Nomor,
            DATE_FORMAT(h.lhp_tanggal, '%Y-%m-%d') AS Tanggal,
            h.lhp_shift AS Shift,
            h.lhp_operator AS Operator,
            h.lhp_keterangan AS Keterangan,
            d.lpd_spk_nomor AS Nomor_SPK,
            d.lpd_spk_nama AS Nama_SPK,
            d.lpd_jenis_pola AS Jenis_Pola,
            d.lpd_panjang AS Panjang,
            d.lpd_lebar AS Lebar,
            d.lpd_jml_pola AS Jumlah,
            d.lpd_path_gambar AS Path_Gambar_Url
        FROM tlhk_pola_dtl d
        INNER JOIN tlhk_pola_hdr h ON h.lhp_nomor = d.lpd_lnomor
        WHERE d.lpd_lnomor = ?
        ORDER BY d.lpd_urut ASC
    `;
    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

module.exports = {
    saveLhkPola,
    getDetailsByNomor
};