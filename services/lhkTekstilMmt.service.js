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
            h.lth_nomor AS Nomor, 
            DATE_FORMAT(h.lth_tanggal, '%Y-%m-%d') AS Tanggal,
            h.lth_gdg_prod AS Gudang, 
            g.gdg_nama AS Nama_Gudang, 
            h.lth_shift AS Shift,
            h.lth_status AS Status,
            
            -- DATA MESIN & SPK (Mengambil baris detail terkait)
            d.ltd_jns_mesin AS Mesin,
            d.ltd_spk_nomor AS NomorSPK,
            x.spk_nama AS NamaOrder,
            IFNULL(x.spk_panjang, 0) AS spk_panjang,
            IFNULL(x.spk_lebar, 0) AS spk_lebar,
            IFNULL(x.spk_jumlah, 0) AS JumlahOrder,
            
            -- HITUNGAN REALISASI PRODUKSI TEKSTIL
            IFNULL(d.ltd_qty_cetak, 0) AS cetak_meter,        -- Jumlah Cetak MMT/Tekstil
            IFNULL(d.ltd_ambil_bahan, 0) AS PanjangBahanAwal,  -- Bahan Awal yang Diambil
            
            -- SISA METER AKHIR = Bahan Diambil - (Aktual Terpakai + Retur OK + Retur Menciut + Retur NOK)
            -- Atau jika standardnya menggunakan Ambil Bahan - Qty Cetak:
            (IFNULL(d.ltd_ambil_bahan, 0) - IFNULL(d.ltd_qty_cetak, 0)) AS SisaMeterAkhir,
            
            -- DATA BAHAN (Diambil dari lth_brg_kode atau ltd_brg_kode)
            IFNULL(h.lth_brg_kode, d.ltd_brg_kode) AS Kode_bahan,
            b.brg_nama AS nama_Bahan,

            -- STATUS KELENGKAPAN DATA INPUTAN (Mengecek lth_brg_kode di Header)
            IF(LENGTH(IFNULL(h.lth_brg_kode, '')) > 0, 'Y', 'N') AS Lengkap
             
        FROM tlhk_mesintekstil_hdr h
        LEFT JOIN tGUDANG g ON g.gdg_kode = h.lth_gdg_prod
        LEFT JOIN tlhk_mesintekstil_dtl d ON d.ltd_lth_nomor = h.lth_nomor
        LEFT JOIN tbarang_mmt b ON b.brg_kode = IFNULL(h.lth_brg_kode, d.ltd_brg_kode)
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, IFNULL(spk_jumlah, 0) AS spk_jumlah, IFNULL(spk_panjang,0) AS spk_panjang, IFNULL(spk_lebar,0) AS spk_lebar FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama, IFNULL(mspk_jumlah, 0) AS mspk_jumlah, IFNULL(mspk_panjang,0) AS mspk_panjang, IFNULL(mspk_lebar,0) AS mspk_lebar FROM tmemospk 
        ) x ON x.spk_nomor = d.ltd_spk_nomor 
        
        WHERE h.lth_tanggal BETWEEN ? AND ?
        ORDER BY h.lth_tanggal DESC, h.lth_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail LHK berdasarkan nomor (Tetap dipertahankan jika komponen expander Vue membutuhkan detail breakdown)
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            d.ltd_lth_nomor AS Nomor,
            d.ltd_jns_mesin AS Mesin, 
            d.ltd_spk_nomor AS Nomor_SPK, 
            x.spk_nama AS Nama_SPK, 
            x.spk_jumlah AS Jumlah_SPK,
            x.spk_panjang AS Panjang, 
            x.spk_lebar AS Lebar, 
            d.ltd_qty_cetak AS Jml_Cetak, 
            d.ltd_brg_kode AS Kode_Bahan, 
            b.brg_nama AS Nama, 
            
            -- Field Manajemen Bahan Kain/Tekstil
            d.ltd_ambil_bahan AS Ambil_Bahan,
            d.ltd_aktual_bahan AS Aktual_Bahan,
            d.ltd_waste_tinta AS Waste_Tinta,
            
            -- Track Input Data Cetak Multi-Posisi
            d.ltd_cetak1 AS Cetak_1,
            d.ltd_cetak2 AS Cetak_2,
            d.ltd_cetak3 AS Cetak_3,
            d.ltd_cetak4 AS Cetak_4,
            d.ltd_cetak5 AS Cetak_5,
            d.ltd_cetak6 AS Cetak_6,
            d.ltd_cetak7 AS Cetak_7
        FROM tlhk_mesintekstil_dtl d
        LEFT JOIN tbarang_mmt b ON b.brg_kode = d.ltd_brg_kode
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, IFNULL(spk_jumlah, 0) AS spk_jumlah, IFNULL(spk_panjang,0) AS spk_panjang, IFNULL(spk_lebar,0) AS spk_lebar FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama, IFNULL(mspk_jumlah, 0) AS mspk_jumlah, IFNULL(mspk_panjang,0) AS mspk_panjang, IFNULL(mspk_lebar,0) AS mspk_lebar FROM tmemospk 
        ) x ON x.spk_nomor = d.ltd_spk_nomor 
        WHERE d.ltd_lth_nomor = ?
        ORDER BY d.ltd_no_urut
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

        // 1. Ekstrak Semua Nomor SPK unik untuk pencatatan di kartu stok
        const uniqueSpks = details && details.length > 0 
            ? [...new Set(details.map(d => d.nomor_spk || d.Nomor_SPK).filter(s => s))]
            : [];
        const combinedSpkNomor = uniqueSpks.join(', ') || '';

        // 2. Insert atau Update Header
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

            // Bersihkan data lama sebelum insert ulang (Mode Edit)
            await conn.query('DELETE FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = ?', [nomorLhk]);
            
            // FIXED (SAFETY DELETE): Hapus stok lama berdasarkan nomor referensi MAUPUN kombinasi spk_nomor
            await conn.query(`
                DELETE FROM tmasterstok_mmt 
                WHERE mst_noreferensi = ? OR mst_spk_nomor = ?
            `, [nomorLhk, nomorLhk]);
        }

        // 3. Simpan Data Detail Pekerjaan
        let totalPanjangPakaiMeter = 0;
        let sisaOtomatisDariFrontend = 0; 

        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_mesintekstil_dtl (
                    ltd_lth_nomor, ltd_no_urut, ltd_jns_mesin, ltd_spk_nomor, 
                    ltd_qty_Cetak, ltd_brg_kode, ltd_panjang_pakai, ltd_lebar_pakai,
                    ltd_cetak1, ltd_cetak2, ltd_cetak3, ltd_cetak4, ltd_cetak5, ltd_cetak6, ltd_cetak7
                ) VALUES ?
            `;
            
            const values = details.map((d, i) => {
                const panjangPerPcs = Number(d.panjang_per_pcs || d.Panjang || 0);
                const jmlCetak = Number(d.jumlah_cetak || d.Jml_Cetak || 0);
                
                const subtotalMeter = panjangPerPcs * 0.9 * jmlCetak;
                totalPanjangPakaiMeter += subtotalMeter;

                if (d.sisabahan !== undefined) {
                    sisaOtomatisDariFrontend = Number(d.sisabahan || 0);
                }
                
                return [
                    nomorLhk, 
                    i + 1, 
                    d.mesin || d.Mesin, 
                    d.nomor_spk || d.Nomor_SPK, 
                    jmlCetak,
                    header.brg_kode, 
                    subtotalMeter, 
                    d.lebar_spk || d.Lebar || 0,
                    Number(d.cetak_1 ?? d.cetak1 ?? 0),
                    Number(d.cetak_2 ?? d.cetak2 ?? 0),
                    Number(d.cetak_3 ?? d.cetak3 ?? 0),
                    Number(d.cetak_4 ?? d.cetak4 ?? 0),
                    Number(d.cetak_5 ?? d.cetak5 ?? 0),
                    Number(d.cetak_6 ?? d.cetak6 ?? 0),
                    Number(d.cetak_7 ?? d.cetak7 ?? 0)
                ];
            });
            await conn.query(sqlDetail, [values]);
        }

        // 4. Logika Potong & Perbarui Stok Otomatis (Jika Status POSTED)
        if (currentStatus === 'POSTED' && header.barcode_input) {
            
            // DOUBLE CHECK FLUSH: Jika terdeteksi mode edit, sapu bersih sekali lagi sebelum insert baris baru
            if (!isActuallyNew) {
                await conn.query(`
                    DELETE FROM tmasterstok_mmt 
                    WHERE mst_noreferensi = ? OR mst_spk_nomor = ?
                `, [nomorLhk, nomorLhk]);
            }

            const [rows] = await conn.query(`
                SELECT 
                    s.mst_hargabeli, 
                    s.mst_satuan_harga, 
                    s.mst_lebar, 
                    brg.brg_type 
                FROM tmasterstok_mmt s
                LEFT JOIN tbarang_mmt brg ON s.mst_brg_kode = brg.brg_kode
                WHERE s.mst_barcode = ? 
                ORDER BY s.id DESC 
                LIMIT 1
            `, [header.barcode_input]);

            let hargaBeliLama = 0;
            let satuanHargaLama = 'YRD';
            let lebarBahanLama = Number(header.lebar_bahan) || 0;

            if (rows && rows.length > 0) {
                const info = rows[0];
                hargaBeliLama = info.mst_hargabeli || 0;
                satuanHargaLama = info.mst_satuan_harga || 'YRD';
                lebarBahanLama = info.mst_lebar || Number(header.lebar_bahan) || 0;
            } else {
                console.warn(`Peringatan: Barcode roll ${header.barcode_input} tidak ditemukan riwayat harganya di tmasterstok_mmt, menggunakan nilai default.`);
            }

            // Ambil nilai saldo awal roll dari payload frontend (satuan asli: YARD)
            const saldoAwalRoll = Number(Number(header.panjang_awal || header.panjang_bahan).toFixed(2)) || 0;

            // --- PROSES MUTASI 1: OUT (STOK LAMA KELUAR) ---
            const sqlOut = `
                INSERT INTO tmasterstok_mmt (
                    mst_brg_kode, mst_barcode, mst_gdg_kode, mst_stok_in, mst_stok_out, 
                    mst_tanggal, mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi, 
                    mst_satuan_harga, mst_hargabeli, date_create, mst_kategori
                ) VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, NOW(), 'ROLL')
            `;
            
            await conn.query(sqlOut, [
                header.brg_kode, header.barcode_input, header.gdgKode, header.tanggal, 
                saldoAwalRoll, lebarBahanLama, combinedSpkNomor, nomorLhk, 
                satuanHargaLama, hargaBeliLama
            ]);

            // --- PROSES MUTASI 2: IN (SISA TERBARU MASUK) ---
            // FIXED (DECIMAL 2): Mengubah presisi sisa input yard menjadi 2 angka di belakang koma sesuai request
            const sisaBaru = Number(Number(header.sisa_panjang_manual).toFixed(2)) || 0;

            if (sisaBaru > 0) {
                const sqlIn = `
                    INSERT INTO tmasterstok_mmt (
                        mst_brg_kode, mst_barcode, mst_gdg_kode, mst_stok_in, mst_stok_out, 
                        mst_tanggal, mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi, 
                        mst_satuan_harga, mst_hargabeli, date_create, mst_kategori
                    ) VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, NOW(), 'ROLL')
                `;

                await conn.query(sqlIn, [
                    header.brg_kode, header.barcode_input, header.gdgKode, header.tanggal, 
                    sisaBaru, lebarBahanLama, combinedSpkNomor, nomorLhk, 
                    satuanHargaLama, hargaBeliLama
                ]);
            }
        }

        await conn.commit();
        return { success: true, nomor: nomorLhk, message: 'Data LHK berhasil disimpan' };
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
            h.lth_brg_kode AS Kode_Bahan, 
            b.brg_nama AS Nama_Bahan,
            
            -- Mengambil Jenis Mesin (Baris pertama)
            (SELECT ltd_jns_mesin FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor LIMIT 1) AS Mesin,
            
            -- Mengambil Nomor SPK (Baris pertama)
            (SELECT ltd_spk_nomor FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor LIMIT 1) AS No_SPK,
            
            -- TAMBAHAN: Mengambil Ukuran Lebar (Baris pertama)
            (SELECT ltd_lebar_pakai FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor LIMIT 1) AS Lebar,

            -- TAMBAHAN: Mengambil Total Qty Cetak (Hasil SUM dari semua detail)
            (SELECT SUM(ltd_qty_Cetak) FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor) AS Jml_Cetak,
            
            -- Mengambil Total Panjang Pakai (Hasil SUM dari semua detail)
            (SELECT SUM(ltd_panjang_pakai) FROM tlhk_mesintekstil_dtl WHERE ltd_lth_nomor = h.lth_nomor) AS Total_Meter
            
        FROM tlhk_mesintekstil_hdr h
        LEFT JOIN tbarang_mmt b ON h.lth_brg_kode = b.brg_kode
        WHERE h.lth_status = 'POSTED'
    `;

    if (tanggal) {
        sql += ` AND h.lth_tanggal = ?`;
        params.push(tanggal);
    }

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
    const prefix = `MMT-LHK-TA.${yymm}.%`;
    // GANTI: tapproval_tekstil_hdr -> tlhk_tekstilmmt_hdr
    const sql = `SELECT MAX(CAST(SUBSTRING_INDEX(lth_nomor, '.', -1) AS UNSIGNED)) AS max_num 
                 FROM tlhk_tekstilmmt_hdr WHERE lth_nomor LIKE ?`;
    
    const [rows] = await connection.query(sql, [prefix]);
    const nextNum = (rows[0].max_num || 0) + 1;
    return `MMT-LHK-TA.${yymm}.${String(nextNum).padStart(4, '0')}`;
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

/**
 * Mengambil daftar history Approval (tlhk_tekstilmmt_hdr)
 */
const getAllApprovalHeaders = async (startDate, endDate) => {
    // Memastikan format tanggal aman untuk query MySQL
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            h.lth_nomor AS Nomor, 
            DATE_FORMAT(h.lth_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lth_shift AS Shift,
            h.lth_user_create AS Admin,
            h.lth_status AS Status,
            
            -- Ambil total pemakaian meter langsung dari tabel detail tekstil mmt
            (SELECT IFNULL(SUM(d.ltd_panjang_pakai), 0) 
             FROM tlhk_tekstilmmt_dtl d
             WHERE d.ltd_lth_nomor = h.lth_nomor) AS Total_Meter,
             
            -- Ambil jumlah item pekerjaan dari tabel detail tekstil mmt
            (SELECT COUNT(*) 
             FROM tlhk_tekstilmmt_dtl d
             WHERE d.ltd_lth_nomor = h.lth_nomor) AS Jumlah_Item
        FROM tlhk_tekstilmmt_hdr h
        WHERE h.lth_tanggal BETWEEN ? AND ?
        ORDER BY h.lth_tanggal DESC, h.lth_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail Approval berdasarkan nomor rekap
 */
const getApprovalDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            d.ltd_lth_nomor AS Nomor_App,
            d.ltd_no_urut AS No_Urut,
            d.ltd_jns_mesin AS Mesin, 
            d.ltd_spk_nomor AS Nomor_SPK, 
            x.spk_nama AS Nama_SPK,
            d.ltd_qty_Cetak AS Jml_Cetak, 
            d.ltd_brg_kode AS Kode_Bahan, 
            b.brg_nama AS Nama_Bahan,
            d.ltd_panjang_pakai AS Total_Panjang,
            d.ltd_lebar_pakai AS Lebar
        FROM tlhk_tekstilmmt_dtl d
        LEFT JOIN tbarang_mmt b ON d.ltd_brg_kode = b.brg_kode
        LEFT JOIN (
            SELECT spk_nomor, spk_nama FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama FROM tmemospk 
        ) x ON x.spk_nomor = d.ltd_spk_nomor 
        WHERE d.ltd_lth_nomor = ?
        ORDER BY d.ltd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

/**
 * Mengambil data lengkap Approval (Header + Detail)
 */
const getApprovalFullByNomor = async (nomor) => {
    const sqlHeader = `
        SELECT 
            lth_nomor AS Nomor, 
            DATE_FORMAT(lth_tanggal, '%Y-%m-%d') AS Tanggal, 
            lth_shift AS Shift,
            lth_user_create AS Admin,
            lth_status AS Status
        FROM tlhk_tekstilmmt_hdr
        WHERE lth_nomor = ?
    `;

    const [headerRows] = await pool.query(sqlHeader, [nomor]);
    if (headerRows.length === 0) return null;

    const details = await getApprovalDetailsByNomor(nomor);

    return {
        header: headerRows[0],
        details: details
    };
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    getLhkByNomor,
    getAllApprovalHeaders,
    getApprovalDetailsByNomor,
    getApprovalFullByNomor,
    deleteLhk,
    generateNewNomor,
    saveLhk,
    getLookupLhkTekstil,
    saveApproval

};