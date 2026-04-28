const pool = require('../config/db.config');
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-T';

/**
 * Mengambil daftar master LHK (Header List)
 */
const getAllHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            lth_nomor AS Nomor, 
            DATE_FORMAT(lth_tanggal, '%d-%m-%Y') AS Tanggal, 
            lth_gdg_prod AS Gudang, 
            gdg_nama AS Nama_Gudang, 
            lth_shift AS Shift,
            lth_status AS Status,
            (SELECT IF(COUNT(*) > COUNT(IF(LENGTH(ltd_brg_kode) > 0, 1, NULL)), 'N', 'Y') 
             FROM tlhk_mesintekstil_dtl 
             WHERE ltd_lth_nomor = lth_nomor) AS Lengkap,
            (SELECT SUM(ltd_panjang_pakai) 
             FROM tlhk_mesintekstil_dtl 
             WHERE ltd_lth_nomor = lth_nomor) AS total_meter
        FROM tlhk_mesintekstil_hdr 
        LEFT JOIN tGUDANG ON gdg_kode = lth_gdg_prod
        WHERE lth_tanggal BETWEEN ? AND ?
        ORDER BY lth_tanggal DESC, lth_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail LHK berdasarkan nomor
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            ltd_lth_nomor AS Nomor,
            ltd_jns_mesin AS Mesin, 
            ltd_spk_nomor AS Nomor_SPK, 
            x.spk_nama AS Nama_SPK, 
            x.spk_panjang AS Panjang, 
            x.spk_lebar AS Lebar, 
            ltd_qty_Cetak AS Jml_Cetak, 
            ltd_brg_kode AS Kode_Bahan, 
            ltd_panjang_pakai AS Panjang_Pakai,
            ltd_lebar_pakai AS Lebar_Pakai
        FROM tlhk_mesintekstil_dtl 
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, IFNULL(spk_panjang,0) AS spk_panjang, IFNULL(spk_lebar,0) AS spk_lebar FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama, IFNULL(mspk_panjang,0) AS mspk_panjang, IFNULL(mspk_lebar,0) AS mspk_lebar FROM tmemospk 
        ) x ON x.spk_nomor = ltd_spk_nomor 
        WHERE ltd_lth_nomor = ?
        ORDER BY ltd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

/**
 * Mengambil Header + Detail untuk Mode Edit
 */
const getLhkByNomor = async (nomor) => {
    const sqlHeader = `
        SELECT 
            lth_nomor AS Nomor, 
            DATE_FORMAT(lth_tanggal, '%Y-%m-%d') AS Tanggal, 
            lth_gdg_prod AS Gudang, 
            lth_shift AS Shift,
            lth_brg_kode AS Kode_Bahan,
            lth_barcode AS Barcode_Roll,
            lth_status AS Status,
            brg_nama AS Nama_Bahan
        FROM tlhk_mesintekstil_hdr
        LEFT JOIN tbarang_mmt ON brg_kode = lth_brg_kode
        WHERE lth_nomor = ?
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
 * Menghapus LHK
 */
const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = ?', [nomor]);
        await conn.query('DELETE FROM tlhk_mesintekstil_hdr WHERE lth_nomor = ?', [nomor]);
        await conn.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [nomor]);
        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Generate Nomor LHK Otomatis
 */
const generateNewNomor = async (date, connection = null) => {
    const db = connection || pool;
    const dateToUse = date instanceof Date ? date : new Date(date);
    const yymm = format(dateToUse, 'yyMM');
    const prefixMatch = `${NOMERATOR}.${yymm}.%`;

    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING_INDEX(lth_nomor, '.', -1) AS UNSIGNED)) AS max_num
        FROM tlhk_mesintekstil_hdr
        WHERE lth_nomor LIKE ?
    `;

    const [rows] = await db.query(sqlMax, [prefixMatch]);
    const maxNum = (rows && rows[0].max_num) ? rows[0].max_num : 0;
    const nextSequence = maxNum + 1;
    const formattedSequence = String(nextSequence).padStart(4, '0');

    return `${NOMERATOR}.${yymm}.${formattedSequence}`;
};

/**
 * Simpan LHK (Create / Update + Stok)
 */
const saveLhk = async (data) => {
    const { header, details } = data;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        let nomorLhk = header.nomor;
        let isActuallyNew = false;
        const currentStatus = header.lstatus || 'DRAFT';

        if (!nomorLhk || nomorLhk === 'AUTO') {
            nomorLhk = await generateNewNomor(header.tanggal, conn);
            isActuallyNew = true;
        } else {
            const [rows] = await conn.query('SELECT lth_nomor FROM tlhk_mesintekstil_hdr WHERE lth_nomor = ?', [nomorLhk]);
            isActuallyNew = (rows.length === 0);
        }

        if (isActuallyNew) {
            const sqlInsHeader = `
                INSERT INTO tlhk_mesintekstil_hdr (
                    lth_nomor, lth_tanggal, lth_shift, lth_gdg_prod, 
                    lth_user_create, lth_date_create, lth_brg_kode, lth_barcode, lth_status
                ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)
            `;
            await conn.query(sqlInsHeader, [
                nomorLhk, header.tanggal, header.shift || 1, header.gdgKode, 
                header.user || 'SYSTEM', header.brg_kode, header.barcode_input, currentStatus
            ]);
        } else {
            const sqlUpdHeader = `
                UPDATE tlhk_mesintekstil_hdr SET 
                    lth_tanggal = ?, lth_shift = ?, lth_gdg_prod = ?, 
                    lth_status = ?, lth_brg_kode = ?, lth_barcode = ?
                WHERE lth_nomor = ?
            `;
            await conn.query(sqlUpdHeader, [
                header.tanggal, header.shift || 1, header.gdgKode, 
                currentStatus, header.brg_kode, header.barcode_input, nomorLhk
            ]);

            await conn.query('DELETE FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = ?', [nomorLhk]);
            await conn.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [nomorLhk]);
        }

        let totalPanjangPakaiMeter = 0;
        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_mesintekstil_dtl (
                    ltd_lth_nomor, ltd_no_urut, ltd_jns_mesin, ltd_spk_nomor, 
                    ltd_qty_Cetak, ltd_brg_kode, ltd_panjang_pakai, ltd_lebar_pakai
                ) VALUES ?
            `;
            const values = details.map((d, i) => {
                const subtotalMeter = (Number(d.panjang_per_pcs) || 0) * (Number(d.jumlah_cetak) || 0);
                totalPanjangPakaiMeter += subtotalMeter;
                return [nomorLhk, i + 1, d.mesin, d.nomor_spk, d.jumlah_cetak, header.brg_kode, subtotalMeter, d.lebar_spk || 0];
            });
            await conn.query(sqlDetail, [values]);
        }

        // LOGIKA STOK
        if (currentStatus === 'POSTED' && header.barcode_input) {
            const [oldStock] = await conn.query(`
                SELECT mst_hargabeli, mst_satuan_harga, mst_lebar, brg.brg_type 
                FROM tmasterstok_mmt s
                JOIN tbarang_mmt brg ON s.mst_brg_kode = brg.brg_kode
                WHERE mst_barcode = ? ORDER BY id DESC LIMIT 1
            `, [header.barcode_input]);

            if (oldStock.length > 0) {
                const info = oldStock[0];
                let qtyPakaiYard = totalPanjangPakaiMeter;
                if (info.brg_type === 'K') qtyPakaiYard = Number((totalPanjangPakaiMeter / 0.9).toFixed(4));

                const saldoAwalRoll = Number(header.panjang_awal) || 0;

                // OUT: Buang saldo lama
                await conn.query(`
                    INSERT INTO tmasterstok_mmt (mst_brg_kode, mst_barcode, mst_gdg_kode, mst_stok_in, mst_stok_out, mst_tanggal, mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi, mst_satuan_harga, mst_hargabeli, date_create)
                    VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, NOW())
                `, [header.brg_kode, header.barcode_input, header.gdgKode, header.tanggal, saldoAwalRoll, info.mst_lebar, 'ADJUSTMENT OUT (LHK)', nomorLhk, info.mst_satuan_harga, info.mst_hargabeli]);

                // IN: Sisa baru
                const sisaBaru = Number((saldoAwalRoll - qtyPakaiYard).toFixed(4));
                if (sisaBaru > 0) {
                    await conn.query(`
                        INSERT INTO tmasterstok_mmt (mst_brg_kode, mst_barcode, mst_gdg_kode, mst_stok_in, mst_stok_out, mst_tanggal, mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi, mst_satuan_harga, mst_hargabeli, date_create)
                        VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, NOW())
                    `, [header.brg_kode, header.barcode_input, header.gdgKode, header.tanggal, sisaBaru, info.mst_lebar, 'SISA PRODUKSI', nomorLhk, info.mst_satuan_harga, info.mst_hargabeli]);
                }
            }
        }

        await conn.commit();
        return { success: true, nomor: nomorLhk, message: 'Data berhasil disimpan' };
    } catch (error) {
        await conn.rollback();
        console.error("Error pada saveLhk Mesin Tekstil:", error);
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Lookup untuk modal pencarian LHK Tekstil di Approval
 */
/**
 * Lookup LHK Tekstil dengan Filter Tanggal dan Shift
 */
const getLookupLhkTekstil = async (tanggal, shift) => {
    let params = [];
    let sql = `
        SELECT 
            h.lth_nomor AS Nomor, 
            DATE_FORMAT(h.lth_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lth_shift AS Shift,
            h.lth_barcode AS Barcode,
            h.lth_brg_kode AS Kode_Bahan, -- TAMBAHKAN INI
            b.brg_nama AS Nama_Bahan,
            -- Tambahkan kolom lain jika ada di table header atau join ke detail jika perlu
            -- Misal asumsi satu LHK header mewakili satu mesin/spk:
            (SELECT ltd_jns_mesin FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor LIMIT 1) AS Mesin,
            (SELECT ltd_spk_nomor FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor LIMIT 1) AS No_SPK,
            (SELECT SUM(ltd_panjang_pakai) FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor) AS Total_Meter
        FROM tlhk_mesintekstil_hdr h
        LEFT JOIN tbarang_mmt b ON h.lth_brg_kode = b.brg_kode
        WHERE h.lth_status = 'POSTED'
    `;

    // Filter Tanggal (Wajib ada biasanya, default hari ini di frontend)
    if (tanggal) {
        sql += ` AND h.lth_tanggal = ?`;
        params.push(tanggal);
    }

    // Filter Shift (Opsional, jika 'Semua' tidak perlu filter)
    if (shift && shift !== 'Semua') {
      sql += ` AND h.lth_shift = ?`;
      params.push(shift);
    }

    sql += ` ORDER BY h.lth_nomor DESC LIMIT 100`;

    const [rows] = await pool.query(sql, params);
    return rows;
};

const generateAppNomor = async (date, connection) => {
    const yymm = format(new Date(date), 'yyMM');
    const prefix = `APP-TEX.${yymm}.%`;
    // GANTI: tapproval_tekstil_hdr -> tlhk_tekstilmmt_hdr
    const sql = `SELECT MAX(CAST(SUBSTRING_INDEX(lth_nomor, '.', -1) AS UNSIGNED)) AS max_num 
                 FROM tlhk_tekstilmmt_hdr WHERE lth_nomor LIKE ?`;
    
    const [rows] = await connection.query(sql, [prefix]);
    const nextNum = (rows[0].max_num || 0) + 1;
    return `APP-TEX.${yymm}.${String(nextNum).padStart(4, '0')}`;
};

/**
 * Menyimpan data Approval dan Update status LHK asal
 */
/**
 * Logika Approve: 
 * 1. Simpan Header ke tlhk_tekstilmmt_hdr
 * 2. Simpan Detail ke tlhk_tekstilmmt_dtl
 * 3. Update status di tlhk_mesintekstil_hdr menjadi 'APPROVED'
 */
/**
 * Fungsi Approve: Menyalin data dari LHK Mesin ke LHK Tekstil (Rekap/Approval)
 * Tanpa memproses stok dan status diubah menjadi 'APPROVE'
 */
const saveApproval = async (data) => {
    const { header, details } = data;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1. Generate Nomor Baru
        const nomorApp = await generateAppNomor(header.tanggal, conn);

        // 2. Simpan ke Header Rekap (tlhk_tekstilmmt_hdr)
        const sqlInsHeader = `
            INSERT INTO tlhk_tekstilmmt_hdr (
                lth_nomor, lth_tanggal, lth_shift, lth_gdg_prod, 
                lth_user_create, lth_date_create, lth_brg_kode, lth_barcode, lth_status
            ) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)
        `;
        
        await conn.query(sqlInsHeader, [
            nomorApp, 
            header.tanggal, 
            header.shift || 1, 
            header.gdgKode || '', 
            header.admin || 'ADMIN', 
            header.brg_kode || '', 
            header.barcode_input || '', 
            'APPROVE' 
        ]);

        // 3. Simpan Detail ke (tlhk_tekstilmmt_dtl)
        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_tekstilmmt_dtl (
                    ltd_lth_nomor, ltd_no_urut, ltd_jns_mesin, ltd_spk_nomor, 
                    ltd_qty_Cetak, ltd_brg_kode, ltd_panjang_pakai, ltd_lebar_pakai
                ) VALUES ?
            `;
            
            const values = details.map((d, i) => {
                // PROTEKSI: Pastikan angka valid (tidak NaN)
                const panjang = parseFloat(d.panjang_per_pcs) || 0;
                const qty = parseFloat(d.jumlah_cetak) || 0;
                const lebar = parseFloat(d.lebar_spk) || 0;
                const totalPakai = panjang * qty;

                return [
                    nomorApp, 
                    i + 1, 
                    d.mesin || '', 
                    d.nomor_spk || '', 
                    qty, 
                    header.brg_kode || '', 
                    totalPakai, // Sudah diproteksi dari NaN
                    lebar
                ];
            });

            await conn.query(sqlDetail, [values]);

            // 4. Update status di tabel ASAL (tlhk_mesintekstil_hdr)
            // Gunakan d.lhk_nomor sesuai dengan key yang dikirim frontend
            const lhkNomorsAsal = details.map(d => d.lhk_nomor).filter(n => n); 
            
            if (lhkNomorsAsal.length > 0) {
                await conn.query(
                    `UPDATE tlhk_mesintekstil_hdr SET lth_status = 'APPROVED' WHERE lth_nomor IN (?)`,
                    [lhkNomorsAsal]
                );
            }
        }

        await conn.commit();
        return { success: true, nomor: nomorApp, message: 'LHK Berhasil di-Approve' };

    } catch (error) {
        await conn.rollback();
        console.error("Error pada saveApproval Tekstil:", error);
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    getLhkByNomor,
    deleteLhk,
    generateNewNomor,
    saveLhk,
    getLookupLhkTekstil,
    saveApproval

};