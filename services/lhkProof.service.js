const pool = require('../config/db.config');
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-P';

/**
 * Mengambil daftar master LHK Proof (Browse)
 */
const getAllHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            lpr_nomor AS nomor, 
            DATE_FORMAT(lpr_tanggal, '%d-%m-%Y') AS Tanggal, 
            lpr_gdg_kode AS Gudang, 
            gdg_nama AS Nama_Gudang, 
            IF(lpr_jenis="M","MMT",IF(lpr_jenis="S","SUBLIM",IF(lpr_jenis="T","TEKSTIL",""))) AS Jenis, 
            lpr_keterangan AS Keterangan
        FROM tlhk_proofmmt_hdr 
        LEFT JOIN tGUDANG ON gdg_kode = lpr_gdg_kode
        WHERE lpr_tanggal BETWEEN ? AND ?
        ORDER BY lpr_tanggal DESC, lpr_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail LHK Proof berdasarkan nomor (SQLDetail di Delphi)
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            lprd_lpr_nomor AS Nomor, 
            lprd_spk_nomor AS Nomor_SPK, 
            x.spk_nama AS Nama_SPK, 
            x.spk_panjang AS Panjang, 
            x.spk_lebar AS Lebar, 
            x.spk_jumlah AS J_Order,
            lprd_j_proof AS J_Proof, 
            lprd_bahan AS Jenis_Bahan,
            lprd_lokasi AS Lokasi,
            lprd_keterangan AS Keterangan, 
            lprd_no_urut AS No_Urut 
        FROM tlhk_proofmmt_dtl 
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_jumlah, 
                   IFNULL(spk_panjang,0) AS spk_panjang, 
                   IFNULL(spk_lebar,0) AS spk_lebar FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama, mspk_jumlah, 
                   IFNULL(mspk_panjang,0) AS mspk_panjang, 
                   IFNULL(mspk_lebar,0) AS mspk_lebar FROM tmemospk 
        ) x ON x.spk_nomor = lprd_spk_nomor 
        WHERE lprd_lpr_nomor = ?
        ORDER BY lprd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

/**
 * Mengambil data lengkap (Header + Detail) untuk mode Edit
 */
const getLhkByNomor = async (nomor) => {
    const sqlHeader = `
        SELECT 
            lpr_nomor, 
            DATE_FORMAT(lpr_tanggal, '%Y-%m-%d') AS lpr_tanggal, 
            lpr_gdg_kode, 
            lpr_jenis, 
            lpr_keterangan
        FROM tlhk_proofmmt_hdr
        WHERE lpr_nomor = ?
    `;

    const [headerRows] = await pool.query(sqlHeader, [nomor]);
    if (headerRows.length === 0) return null;

    const details = await getDetailsByNomor(nomor);

    return {
        header: headerRows[0],
        details: details
    };
};

/**
 * Generate Nomor LHK Proof Otomatis (getmaxkode di Delphi)
 */
const generateNewNomor = async (date, connection = null) => {
    const db = connection || pool;
    const yymm = format(new Date(date), 'yyMM');
    const prefixMatch = `${NOMERATOR}.${yymm}.%`;

    const sqlMax = `
        SELECT MAX(CAST(RIGHT(lpr_nomor, 4) AS UNSIGNED)) AS max_num
        FROM tlhk_proofmmt_hdr
        WHERE lpr_nomor LIKE ?
    `;

    const [rows] = await db.query(sqlMax, [prefixMatch]);
    const maxNum = (rows && rows[0].max_num) ? rows[0].max_num : 0;
    const nextSequence = maxNum + 1;
    const formattedSequence = String(nextSequence).padStart(4, '0');

    return `${NOMERATOR}.${yymm}.${formattedSequence}`;
};

/**
 * Simpan LHK Proof (Create / Update)
 */
const saveLhk = async (data) => {
    const { header, details } = data;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        let nomorLhk = header.nomor;

        // Logika IF FLAGEDIT di Delphi
        if (!nomorLhk || nomorLhk === 'AUTO') {
            nomorLhk = await generateNewNomor(header.tanggal, conn);
            
            const sqlInsHeader = `
                INSERT INTO tlhk_proofmmt_hdr (
                    lpr_nomor, lpr_tanggal, lpr_gdg_kode, lpr_jenis, 
                    lpr_keterangan, lpr_date_create, lpr_user_create
                ) VALUES (?, ?, ?, ?, ?, NOW(), ?)
            `;
            await conn.query(sqlInsHeader, [
                nomorLhk, header.tanggal, header.gdgKode, header.jenis, 
                header.keterangan, header.user || 'SYSTEM'
            ]);
        } else {
            const sqlUpdHeader = `
                UPDATE tlhk_proofmmt_hdr SET 
                    lpr_tanggal = ?, lpr_gdg_kode = ?, lpr_jenis = ?, 
                    lpr_keterangan = ?, lpr_date_modified = NOW(), lpr_user_modified = ?
                WHERE lpr_nomor = ?
            `;
            await conn.query(sqlUpdHeader, [
                header.tanggal, header.gdgKode, header.jenis, 
                header.keterangan, header.user || 'SYSTEM', nomorLhk
            ]);

            // Hapus detail lama (Logika tt.Append('delete from...') di Delphi)
            await conn.query('DELETE FROM tlhk_proofmmt_dtl WHERE lprd_lpr_nomor = ?', [nomorLhk]);
        }

        // Simpan Detail baru
        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_proofmmt_dtl (
                    lprd_lpr_nomor, lprd_spk_nomor, lprd_panjang, lprd_lebar, 
                    lprd_j_proof, lprd_lokasi, lprd_bahan, lprd_keterangan, lprd_no_urut
                ) VALUES ?
            `;
            const values = details.map((d, i) => [
                nomorLhk, d.nomor_spk, d.panjang || 0, d.lebar || 0, 
                d.aktual_proof || 0, d.lokasi, d.jenis_bahan, d.keterangan, i + 1
            ]);
            await conn.query(sqlDetail, [values]);
        }

        await conn.commit();
        return { success: true, nomor: nomorLhk };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Menghapus LHK Proof
 */
const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM tlhk_proofmmt_dtl WHERE lprd_lpr_nomor = ?', [nomor]);
        await conn.query('DELETE FROM tlhk_proofmmt_hdr WHERE lpr_nomor = ?', [nomor]);
        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    getLhkByNomor,
    saveLhk,
    deleteLhk
};