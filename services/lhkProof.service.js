const pool = require('../config/db.config');
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-P';

// 🔥 HELPER FUNCTION: Menentukan kategori sisa potongan bahan otomatis
const getKategori = (panjang, lebar) => {
    // Anda bisa menyesuaikan threshold (batas) ini sesuai aturan operasional gudang Anda
    if (panjang >= 10) {
        return 'ROLL';   // Jika sisa panjang masih besar, masuk kategori Roll kembali
    } else if (panjang >= 1 && panjang < 10) {
        return 'RETUR';  // Sisa potongan tanggung yang masih bisa dipakai printing retail
    } else {
        return 'SCRAP';  // Sisa ukuran kecil / afal nyempil
    }
};

/**
 * Mengambil daftar master LHK Proof (Browse)
 */
const getAllHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            h.lpr_nomor AS nomor, 
            DATE_FORMAT(h.lpr_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lpr_gdg_kode AS Gudang, 
            g.gdg_nama AS Nama_Gudang, 
            IF(h.lpr_jenis="M","MMT",IF(h.lpr_jenis="S","SUBLIM",IF(h.lpr_jenis="T","TEKSTIL",""))) AS Jenis, 
            h.lpr_operator AS Operator,
            h.lpr_keterangan AS Keterangan,
            
            -- --- TAMBAHAN DATA LOGISTIK DI LEVEL HEADER ---
            d.lprd_barcode AS Barcode_Roll,
            IFNULL(d.total_j_meter, 0) AS Total_J_Meter,
            IFNULL(d.panjang_awal, 0) AS Panjang_Awal,
            IFNULL(d.panjang_terpakai, 0) AS Panjang_Terpakai,
            IFNULL(d.sisa_bahan, 0) AS Sisa_Bahan
            
        FROM tlhk_proofmmt_hdr h
        LEFT JOIN tGUDANG g ON g.gdg_kode = h.lpr_gdg_kode
        -- Join dengan subquery detail untuk mengambil snapshot roll bahan pertama & akumulasi meter lari
        LEFT JOIN (
            SELECT 
                lprd_lpr_nomor,
                MAX(lprd_barcode) AS lprd_barcode,                   -- Ambil barcode roll yang digunakan
                SUM(lprd_j_meter) AS total_j_meter,                   -- Total akumulasi J_Meter terpakai
                MAX(lprd_panjang_awal) AS panjang_awal,               -- Snapshot panjang awal roll
                MAX(lprd_panjang_terpakai) AS panjang_terpakai,       -- Snapshot panjang terpakai logistik
                MIN(lprd_sisa_bahan) AS sisa_bahan                    -- Sisa bahan paling akhir setelah potong
            FROM tlhk_proofmmt_dtl
            GROUP BY lprd_lpr_nomor
        ) d ON d.lprd_lpr_nomor = h.lpr_nomor
        
        WHERE h.lpr_tanggal BETWEEN ? AND ?
        ORDER BY h.lpr_tanggal DESC, h.lpr_nomor DESC
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
            lprd_panjang AS Panjang,           -- Gunakan ukuran simpanan LHK riil
            lprd_lebar AS Lebar,             -- Gunakan ukuran simpanan LHK riil
            x.spk_jumlah AS J_Order,
            cetak1, cetak2, cetak3, cetak4, cetak5, cetak6, cetak7,
            lprd_j_meter AS J_Meter,
            lprd_j_proof AS J_Proof, 
            lprd_bahan AS Jenis_Bahan,
            lprd_lokasi AS Lokasi,
            lprd_keterangan AS Keterangan, 
            lprd_no_urut AS No_Urut,
            -- --- TAMBAHKAN KOLOM HISTORI UTK FORM EDIT DI FRONTEND ---
            lprd_barcode AS barcode_detail,    -- Barcode roll yang dipakai
            lprd_panjang_awal AS panjang_roll_awal, -- Panjang awal roll saat itu (Yard/Meter)
            lprd_sisa_bahan AS sisabahan       -- Sisa bahan setelah potong (Yard/Meter)
        FROM tlhk_proofmmt_dtl 
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_jumlah FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama, mspk_jumlah FROM tmemospk 
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
            lpr_operator,     -- Mengambil kolom lpr_operator asli
            lpr_keterangan    -- Mengambil kolom lpr_keterangan asli
        FROM tlhk_proofmmt_hdr
        WHERE lpr_nomor = ?
    `;

    const [headerRows] = await pool.query(sqlHeader, [nomor]);
    if (headerRows.length === 0) return null;

    const header = headerRows[0];
    const details = await getDetailsByNomor(nomor); 

    if (details && details.length > 0) {
        header.lpr_barcode = details[0].barcode_detail || "";
        header.lpr_mesin = details[0].Lokasi || ""; 
    }

    return {
        header: header,
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
    const currentStatus = header.lstatus || 'DRAFT';

    if (!header || !Array.isArray(details) || details.length === 0) {
        if (conn) conn.release();
        throw new Error("Data header atau detail kerja tidak boleh kosong.");
    }

    try {
        await conn.beginTransaction();

        let nomorLhk = header.nomor;
        const now = new Date();
        const dateToUse = header.tanggal ? new Date(header.tanggal) : now;
        const formattedDate = format(dateToUse, 'yyyy-MM-dd');
        const userAction = header.user || 'SYSTEM';

        // 1. OLAH DATA MASTER HEADER (Operator disimpan di lpr_keterangan)
       if (!nomorLhk || nomorLhk === 'AUTO') {
            nomorLhk = await generateNewNomor(header.tanggal, conn);
            
            const sqlInsHeader = `
                INSERT INTO tlhk_proofmmt_hdr (
                    lpr_nomor, lpr_tanggal, lpr_gdg_kode, lpr_jenis, 
                    lpr_operator, lpr_keterangan, lpr_date_Create, lpr_user_create, lpr_status
                ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
            `;
            await conn.query(sqlInsHeader, [
                nomorLhk, formattedDate, header.gdgKode, header.jenis, 
                header.operator, header.keterangan, userAction, currentStatus
            ]);
        } else {
            const sqlUpdHeader = `
                UPDATE tlhk_proofmmt_hdr SET 
                    lpr_tanggal = ?, lpr_gdg_kode = ?, lpr_jenis = ?, 
                    lpr_operator = ?, lpr_keterangan = ?, lpr_date_modified = NOW(), lpr_user_modified = ?, lpr_status = ?
                WHERE lpr_nomor = ?
            `;
            await conn.query(sqlUpdHeader, [
                formattedDate, header.gdgKode, header.jenis, 
                header.operator, header.keterangan, userAction, currentStatus, nomorLhk
            ]);

            await conn.query('DELETE FROM tlhk_proofmmt_dtl WHERE lprd_lpr_nomor = ?', [nomorLhk]);
            await conn.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [nomorLhk]);
        }

        // 2. OLAH BULK INSERT DATA DETAIL WORK-FLOW (Menyimpan cetak1-7 & lprd_j_meter)
        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_proofmmt_dtl (
                    lprd_lpr_nomor, lprd_spk_nomor, lprd_panjang, lprd_lebar, 
                    lprd_j_proof, lprd_j_meter, lprd_barcode, lprd_lokasi, lprd_bahan, lprd_keterangan, lprd_no_urut,
                    lprd_panjang_awal, lprd_panjang_terpakai, lprd_sisa_bahan,
                    cetak1, cetak2, cetak3, cetak4, cetak5, cetak6, cetak7
                ) VALUES ?
            `;
            
            const values = details.map((d, i) => {
                const pAwalMeter = Number(d.panjang_roll_awal || 0);
                const pSisaMeter = Number(d.sisabahan || 0);
                
                // Kalkulasi total pemakaian riil dalam satuan Meter untuk lprd_j_meter
                const totalMeterTerpakai = Number((pAwalMeter - pSisaMeter).toFixed(2));

                let pAwal = pAwalMeter;
                let pSisa = pSisaMeter;
                
                // Jika jenis kain Tekstil, simpan histori saldo awal/sisa dalam bentuk Yard ke DB detail
                if (header.jenis === 'T') {
                    pAwal = pAwal > 0 ? Number((pAwal / 0.9).toFixed(2)) : 0;
                    pSisa = pSisa > 0 ? Number((pSisa / 0.9).toFixed(2)) : 0;
                }
                
                // Panjang terpakai logistik (Yard untuk Tekstil, Meter untuk MMT)
                const pTerpakaiLogistik = Number((pAwal - pSisa).toFixed(2));
                const lokasiMesin = d.lokasi || header.mesin || "";

                return [
                    nomorLhk, 
                    d.nomor_spk, 
                    d.panjang || 0, 
                    d.lebar || 0, 
                    d.aktual_proof || 0, 
                    totalMeterTerpakai, // <--- Menyimpan total meter pemakaian ke lprd_j_meter
                    d.barcode_detail || null, 
                    lokasiMesin, 
                    d.jenis_bahan, 
                    d.keterangan || "", 
                    i + 1,
                    pAwal, 
                    pTerpakaiLogistik, 
                    pSisa,
                    // Pecahan cetak kolom C1 sampai C7
                    Number(d.cetak1 || 0),
                    Number(d.cetak2 || 0),
                    Number(d.cetak3 || 0),
                    Number(d.cetak4 || 0),
                    Number(d.cetak5 || 0),
                    Number(d.cetak6 || 0),
                    Number(d.cetak7 || 0)
                ];
            });
            
            await conn.query(sqlDetail, [values]);
        }

        // 3. LOGIKA ENGINE POTONG STOK OTOMATIS
        if (currentStatus === 'POSTED') {
            for (let i = 0; i < details.length; i++) {
                const d = details[i];
                const usedBarcode = d.barcode_detail;
                
                let ambilPanjang = Number(d.panjang_roll_awal || 0); 
                let sisaPanjang = Number(d.sisabahan || 0);
                const sisaLebar = Number(d.sisabahanlebar || 0);

                if (header.jenis === 'T') {
                    if (ambilPanjang > 0) ambilPanjang = Number((ambilPanjang / 0.9).toFixed(2));
                    if (sisaPanjang > 0) sisaPanjang = Number((sisaPanjang / 0.9).toFixed(2));
                }

                if (usedBarcode && ambilPanjang > 0) {
                    const [rows] = await conn.query(`
                        SELECT mst_brg_kode, mst_hargabeli, mst_satuan_harga, mst_lebar 
                        FROM tmasterstok_mmt 
                        WHERE mst_barcode = ? 
                        AND mst_stok_in = 1 AND mst_stok_out = 0
                        ORDER BY id DESC
                        LIMIT 1
                    `, [usedBarcode]);

                    if (rows && rows.length > 0) {
                        const brgKode = rows[0].mst_brg_kode;
                        const hargaBeliLama = rows[0].mst_hargabeli;
                        const satuanHargaLama = rows[0].mst_satuan_harga;
                        const lebarAwal = rows[0].mst_lebar;

                        const finalLebarInput = (sisaLebar > 0) ? sisaLebar : lebarAwal;

                        // A. MUTASI KELUAR
                        await conn.query(`
                            INSERT INTO tmasterstok_mmt (
                                mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                                mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                                mst_hargabeli, mst_satuan_harga, mst_tanggal, mst_barcode, mst_kategori
                            ) VALUES (?, ?, 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'ROLL')
                        `, [
                            brgKode, header.gdgKode, ambilPanjang, lebarAwal, 
                            d.nomor_spk, nomorLhk, hargaBeliLama, satuanHargaLama, formattedDate, usedBarcode
                        ]);

                        // B. MUTASI MASUK
                        if (sisaPanjang > 0) {
                            const kategoriSisa = getKategori(sisaPanjang, finalLebarInput);
                            await conn.query(`
                                INSERT INTO tmasterstok_mmt (
                                    mst_brg_kode, mst_gdg_kode, mst_stok_in, mst_stok_out,
                                    mst_panjang, mst_lebar, mst_spk_nomor, mst_noreferensi,
                                    mst_hargabeli, mst_satuan_harga, mst_tanggal, mst_barcode,
                                    mst_kategori
                                ) VALUES (?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `, [
                                brgKode, header.gdgKode, sisaPanjang, finalLebarInput, 
                                d.nomor_spk, nomorLhk, hargaBeliLama, satuanHargaLama, formattedDate, usedBarcode,
                                kategoriSisa
                            ]);
                        }
                    } else {
                        console.warn(`Peringatan: Barcode ${usedBarcode} tidak ditemukan di master stok induk.`);
                    }
                }
            }
        }

        await conn.commit();
        return { success: true, nomor: nomorLhk, status: currentStatus };
    } catch (error) {
        await conn.rollback();
        console.error("Proses pembukuan stok LHK Proof Gagal:", error);
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