// backend/src/services/spk.service.js

const pool = require('../config/db.config'); 
const { format } = require('date-fns');

const throwDbError = (message, error) => { throw new Error(message + ': ' + error.message); };

/**
 * Logika Utama: Menggabungkan TSPK, TMEMOSPK, dan Kalkulasi Produksi
 * Diperbaiki agar menyertakan status 'Ngedit' (PIN), Approval, Akumulasi, dan DATA GAMBAR/QR sesuai Delphi
 */
const getBaseSpkQuery = (whereClauseReguler = "1=1", whereClauseMemo = "1=1") => {
    return `
        SELECT x.*,
            /* LOGIKA SINKRONISASI CETAK:
               Jika spk_cmo sudah terisi (bukan null & bukan kosong), maka otomatis 'ACC' (Bisa Cetak).
               Jika belum terisi, maka dia akan mengecek jalur PIN seperti biasa. */
            IF(TRIM(IFNULL(x.Acc_MO, '')) <> '', 'ACC',
                IFNULL(
                    IF(x.ppin = 'N', 'TOLAK',
                        IF(x.ppin = 'Y' AND x.ppakai = '', 'ACC',
                            IF(x.ppin = 'Y' AND x.ppakai = 'Y', '', 
                                IF(x.ppin = '', 'WAIT', '')
                            )
                        )
                    ), ''
                )
            ) AS Ngedit
        FROM (
            /* --- SECTION 1: SPK REGULER --- */
            SELECT 
                t.spk_nomor AS SPK, 
                t.user_create AS MO,
                t.spk_cmo AS CMO,
                t.spk_tanggal AS Tanggal, 
                t.spk_dateline AS Deadline,
                t.spk_statuskerja AS Kepentingan,
                t.spk_divisi AS Divisi, 
                t.spk_nama AS Nama, 
                t.spk_cab AS Cabang,
                t.spk_workshop AS Workshop,
                t.spk_pending AS Pending,            
                t.spk_ketpending AS Ket_Pending,       
                'REGULER' AS Tipe_SPK,
                IFNULL(t.spk_panjang, 0) AS Panjang, 
                IFNULL(t.spk_lebar, 0) AS Lebar,
                t.spk_ukuran AS Ukuran,
                t.spk_gramasi AS Gramasi,
                t.spk_kain AS Bahan, 
                t.spk_finishing AS Finishing,
                t.spk_keterangan AS Pesan,            
                0 AS PraSJ,                                           
                0 AS Kirim,                                           
                t.user_create AS Created,
                t.spk_nomor_po AS PO,
                t.spk_ketpo AS Ket_PO,
                t.spk_datelinepo AS Dateline_PO,
                IF(t.spk_aktif='Y', 'Open', 'Closed') AS STATUS, 
                '' AS Alasan_Close,
                t.spk_pen_nomor AS No_Penawaran,
                t.spk_memo AS MAP,                                        
                IFNULL(t.spk_alokasi, 'TIDAK') AS Alokasi,                 
                
                /* Progress Jalur Kerja Internal (Realisasi) */
                IFNULL(t.spk_mpotong, 'N') AS Potong,
                t.spk_repeat AS "Repeat",
                
                /* Status Kontrol / QC Produksi Eksternal */
                IFNULL(t.spk_ppotong, 'N') AS QC_Potong,
                IFNULL(t.spk_bordir, 'N') AS Bordir,
                CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                IFNULL(t.spk_pcetak, 'N') AS QC_Cetak,
                IFNULL(t.spk_invdc, '') AS DC,       
                IFNULL(t.spk_pjahit, 'N') AS Jahit,
                IFNULL(t.spk_pfinishing, 'N') AS Lipat,
                
                /* Logika Jadi */
                CASE 
                    WHEN t.spk_divisi IN ('1', '5') THEN CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED)
                    WHEN t.spk_divisi = '3' AND TRIM(IFNULL(t.spk_invdc, '')) <> '' THEN CAST(IFNULL(dc_stock.total_stok_dc, 0) AS UNSIGNED)
                    ELSE 0 
                END AS Jadi,

                /* Selisih Manufaktur */
                CAST(GREATEST(0, t.spk_jumlah - (
                    CASE 
                        WHEN t.spk_divisi IN ('1', '5') THEN IFNULL(prod.total_pernah_cetak, 0)
                        WHEN t.spk_divisi = '3' AND TRIM(IFNULL(t.spk_invdc, '')) <> '' THEN IFNULL(dc_stock.total_stok_dc, 0)
                        ELSE 0 
                    END
                )) AS UNSIGNED) AS Kurang_Jadi,

                0 AS Kurang_Potong,
                0 AS Kurang_Bordir,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak_Prod,
                0 AS Kurang_QC_Cetak,
                0 AS Kurang_Jahit,
                0 AS Kurang_Lipat,
                
                t.spk_aktif AS Aktif,
                t.spk_cmo AS Acc_MO, /* Di-alias kan ke Acc_MO untuk dibaca di sub-query luar x.* */
                t.spk_newdesign AS design_baru,
                t.spk_desain AS design_done,          

                /* PERBAIKAN: Mapping Image & QR Code Sesuai Alur Penyimpanan File Delphi */
                CONCAT(t.spk_nomor, '.jpg') AS Design_Image,
                t.spk_nomor AS QR_Data,

                /* PIN System */
                IFNULL((SELECT pin_acc FROM tspk_pin5 WHERE pin_trs="SPK" AND pin_nomor=t.spk_nomor ORDER BY pin_urut DESC LIMIT 1), "") as ppin,
                IFNULL((SELECT pin_dipakai FROM tspk_pin5 WHERE pin_trs="SPK" AND pin_nomor=t.spk_nomor ORDER BY pin_urut DESC LIMIT 1), "") as ppakai,
                t.spk_jumlah AS Jumlah
            FROM tspk t
            
            /* JOIN 1: Hitungan Cetak Mesin */
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod ON prod.ld_spk_nomor = t.spk_nomor
            
            /* JOIN 2: Hitungan Ambil Stok dari Gudang DC */
            LEFT JOIN (
                SELECT d.invd_inv_nomor, SUM(d.invd_jumlah) AS total_stok_dc
                FROM retail.tinv_dtl d
                INNER JOIN retail.tinv_hdr h ON d.invd_inv_nomor = h.inv_nomor
                GROUP BY d.invd_inv_nomor
            ) dc_stock ON dc_stock.invd_inv_nomor = t.spk_invdc
            
            WHERE ${whereClauseReguler}

            UNION ALL

            /* --- SECTION 2: MEMO SPK --- */
            SELECT 
                m.mspk_nomor AS SPK, 
                '' AS MO,
                '' AS CMO,
                m.mspk_tanggal AS Tanggal,
                m.mspk_dateline AS Deadline,
                'INTERNAL' AS Kepentingan,
                m.mspk_divisi AS Divisi,              
                m.mspk_nama AS Nama, 
                m.mspk_cab AS Cabang,                
                m.mspk_workshop AS Workshop,          
                'NORMAL' AS Pending,
                '' AS Ket_Pending,
                'MEMO' AS Tipe_SPK,
                IFNULL(m.mspk_panjang, 0) AS Panjang, 
                IFNULL(m.mspk_lebar, 0) AS Lebar,
                m.mspk_ukuran AS Ukuran,
                m.mspk_gramasi AS Gramasi,

                m.mspk_kain AS Bahan,                
                m.mspk_finishing AS Finishing,        
                m.mspk_keterangan AS Pesan,           
                0 AS PraSJ,
                0 AS Kirim,
                '' AS Created,
                m.mspk_nomor_po AS PO,                
                '' AS Ket_PO,
                m.mspk_tgl_po AS Dateline_PO,         
                'Open' AS STATUS,
                '' AS Alasan_Close,
                '' AS No_Penawaran,
                '' AS MAP,
                'TIDAK' AS Alokasi,
                'N' AS Potong,                        
                'N' AS "Repeat",
                'N' AS QC_Potong,
                'N' AS Bordir,
                CAST(IFNULL(prod_m.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                'N' AS QC_Cetak,
                '' AS DC,
                'N' AS Jahit,
                'N' AS Lipat,
                CAST(IFNULL(prod_m.total_pernah_cetak, 0) AS UNSIGNED) AS Jadi,
                
                CAST(GREATEST(0, m.mspk_jumlah - IFNULL(prod_m.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Jadi,
                0 AS Kurang_Potong,
                0 AS Kurang_Bordir,
                CAST(GREATEST(0, m.mspk_jumlah - IFNULL(prod_m.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak_Prod, 
                0 AS Kurang_QC_Cetak,
                0 AS Kurang_Jahit,
                0 AS Kurang_Lipat,
                m.mspk_aktif AS Aktif,                
                '' AS Acc_MO, 
                'N' AS design_baru,
                'Y' AS design_done,

                /* PERBAIKAN: Samakan struktur kolom untuk UNION file Memo */
                CONCAT(m.mspk_nomor, '.jpg') AS Design_Image,
                m.mspk_nomor AS QR_Data,

                '' as ppin,
                '' as ppakai,
                m.mspk_jumlah AS Jumlah        
            FROM tmemospk m
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod_m ON prod_m.ld_spk_nomor = m.mspk_nomor
            WHERE ${whereClauseMemo}
        ) x
    `;
};

// ===================================
// BROWSE DATA (UTAMA) 
// ===================================
exports.getAllSpkData = async (filters) => {
    try {
        const { startDate, endDate, keyword, cabang } = filters;
        
        let whereReguler = "1=1";
        let whereMemo = "1=1";
        const params = [];

        if (startDate && endDate) {
            whereReguler += ` AND t.spk_tanggal BETWEEN ? AND ?`;
            whereMemo += ` AND m.mspk_tanggal BETWEEN ? AND ?`;
            params.push(startDate, endDate, startDate, endDate);
        }

        if (cabang && cabang !== 'ALL') {
            whereReguler += ` AND t.spk_cab = ?`;
            whereMemo += ` AND 'ALL' = ?`; 
            params.push(cabang, cabang);
        }

        let sql = getBaseSpkQuery(whereReguler, whereMemo);

        if (keyword) {
            sql = `SELECT * FROM (${sql}) as sub WHERE SPK LIKE ? OR Nama LIKE ?`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }

        sql += ` ORDER BY Tanggal DESC`;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data Browse SPK secara keseluruhan', error);
    }
};

// ===================================
// LOOKUP STBJ (Untuk Modal Pencarian)
// ===================================
const getBaseStbjQuery = (whereClause = "1=1") => {
    return `
        SELECT 
            h.stbj_nomor AS Nomor,
            h.stbj_tanggal AS Tanggal,
            h.stbj_keterangan AS Keterangan,
            h.stbj_gdg_kode AS Gudang_Asal,
            h.stbj_gdgp_kode AS Gudang_Tujuan,
            h.stbj_checker AS Checker,
            h.stbj_ts_nomor AS No_TS,
            IFNULL(dtl.total_qty, 0) AS Total_Qty,
            IFNULL(dtl.total_koli, 0) AS Total_Koli
        FROM tstbj_hdr h
        LEFT JOIN (
            SELECT 
                stbjd_stbj_nomor, 
                SUM(stbjd_jumlah) as total_qty, 
                SUM(stbjd_koli) as total_koli 
            FROM tstbj_dtl 
            GROUP BY stbjd_stbj_nomor
        ) dtl ON h.stbj_nomor = dtl.stbjd_stbj_nomor
        WHERE ${whereClause}
    `;
};

exports.getStbjLookupData = async (keyword) => {
    try {
        let sql = `SELECT * FROM (${getBaseStbjQuery()}) AS stbj_combined`;
        const params = [];

        if (keyword) {
            sql += ` WHERE (Nomor LIKE ? OR Keterangan LIKE ? OR No_TS LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY Tanggal DESC LIMIT 50`;
        
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data lookup STBJ', error);
    }
};

/**
 * PERBAIKAN: Mengganti spk_close menjadi spk_aktif agar sinkron dengan alor data Open/Closed Delphi & Web
 */
exports.getSpkForStbjLookup = async (keyword) => {
    try {
        const sql = `
            SELECT 
                t.spk_nomor AS SPK,
                t.spk_nama AS Nama,
                t.spk_tanggal AS Tanggal,
                t.spk_jumlah AS Qty_Order,
                CAST(IFNULL(stbj.total_stbj, 0) AS UNSIGNED) AS Sudah_STBJ,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(stbj.total_stbj, 0)) AS UNSIGNED) AS Kurang_STBJ,
                t.spk_statuskerja AS Kepentingan,
                IF(t.spk_aktif='Y', 'Open', 'Closed') AS STATUS
            FROM tspk t
            LEFT JOIN (
                SELECT stbjd_spk_nomor, SUM(stbjd_jumlah) AS total_stbj
                FROM tstbj_dtl
                GROUP BY stbjd_spk_nomor
            ) stbj ON stbj.stbjd_spk_nomor = t.spk_nomor
            WHERE (t.spk_nomor LIKE ? OR t.spk_nama LIKE ?)
            ORDER BY t.spk_tanggal DESC
            LIMIT 100
        `;

        const searchKeyword = `%${keyword}%`;
        const [rows] = await pool.query(sql, [searchKeyword, searchKeyword]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil perhitungan SPK vs STBJ', error);
    }
};

// ===================================
// DETAIL STBJ (Header & Rincian Item)
// ===================================
exports.getStbjFullDetail = async (nomorStbj) => {
    try {
        const [header] = await pool.query(getBaseStbjQuery("h.stbj_nomor = ?"), [nomorStbj]);
        if (header.length === 0) throw new Error(`STBJ ${nomorStbj} tidak ditemukan.`);

        const sqlItems = `
            SELECT 
                d.stbjd_spk_nomor AS No_SPK,
                s.spk_nama AS Nama_SPK,
                d.stbjd_size AS Size,
                d.stbjd_jumlah AS Qty,
                d.stbjd_koli AS Koli,
                d.stbjd_packing AS Packing,
                d.stbjd_keterangan AS Catatan
            FROM tstbj_dtl d
            LEFT JOIN tspk s ON d.stbjd_spk_nomor = s.spk_nomor
            WHERE d.stbjd_stbj_nomor = ?
            ORDER BY d.stbjd_spk_nomor ASC
        `;
        const [items] = await pool.query(sqlItems, [nomorStbj]);

        return {
            ...header[0],
            items: items
        };
    } catch (error) {
        throwDbError(`Gagal memuat detail STBJ ${nomorStbj}`, error);
    }
};

exports.getSpkForJadwalKirimLookup = async (keyword) => {
    try {
        // PERBAIKAN UTAMA: Ditambahkan tanda $ pada fungsi di bawah ini
        const baseQuery = getBaseSpkQuery();
        const sql = `
            SELECT 
                combined.SPK,
                combined.Nama,
                combined.Tanggal,
                combined.Ukuran,
                combined.Bahan,
                combined.Jumlah AS Total_Order,
                CAST(IFNULL(jdwl.total_terjadwal, 0) AS UNSIGNED) AS Sudah_Kirim,
                CAST(GREATEST(0, combined.Jumlah - IFNULL(jdwl.total_terjadwal, 0)) AS UNSIGNED) AS Belum_Kirim,
                combined.Tipe_SPK,
                combined.Ngedit
            FROM (${baseQuery}) AS combined
            LEFT JOIN (
                SELECT spk_nomor, SUM(jumlah) AS total_terjadwal
                FROM tjadwalkirim
                GROUP BY spk_nomor
            ) jdwl ON jdwl.spk_nomor = combined.SPK
            WHERE (combined.SPK LIKE ? OR combined.Nama LIKE ?)
            ORDER BY combined.Tanggal DESC
            LIMIT 100
        `;

        const searchKeyword = `%${keyword || ''}%`;
        const [rows] = await pool.query(sql, [searchKeyword, searchKeyword]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data SPK untuk Jadwal Kirim', error);
    }
};

exports.getSpkLookupData = async (keyword) => {
    try {
        let sql = `SELECT * FROM (${getBaseSpkQuery()}) AS combined_spk`; 
        const params = [];
        if (keyword) {
            sql += ` WHERE (SPK LIKE ? OR Nama LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY Tanggal DESC LIMIT 50`;
        const [rows] = await pool.query(sql, params);
        return rows; 
    } catch (error) {
        throwDbError('Gagal mengambil data SPK untuk lookup', error);
    }
};

// ===================================
// 2. DETAIL SIZE (Expanded Row Logic)
// ===================================
exports.getSpkDetailSize = async (nomor) => {
    try {
        const sql = `
            SELECT 
                z.spks_nomor AS Nomor, 
                z.spks_size AS Size, 
                z.spks_qty AS Qty,
                IFNULL((SELECT SUM(d.stbjd_jumlah) FROM tstbj_dtl d 
                        WHERE d.stbjd_spk_nomor=z.spks_nomor AND d.stbjd_size=z.spks_size), 0) AS Stbj,
                (z.spks_qty - IFNULL((SELECT SUM(d.stbjd_jumlah) FROM tstbj_dtl d 
                                      WHERE d.stbjd_spk_nomor=z.spks_nomor AND d.stbjd_size=z.spks_size), 0)) AS Kurang
            FROM tspk_size z
            WHERE z.spks_nomor = ?
        `;
        const [rows] = await pool.query(sql, [nomor]);
        return rows;
    } catch (error) {
        throwDbError('Gagal memuat detail size', error);
    }
};

// ===================================
// 3. DETAIL UNTUK PRINT / EDIT
// ===================================
exports.getSpkDetailByNomor = async (nomor) => {
    try {
        const sql = `SELECT * FROM (${getBaseSpkQuery("t.spk_nomor = ?")}) AS combined_spk`;
        const [rows] = await pool.query(sql, [nomor]);
        if (rows.length === 0) throw new Error(`Nomor SPK \${nomor} tidak ditemukan.`);
        return rows[0]; 
    } catch (error) {
        throwDbError(`Gagal memuat detail SPK \${nomor}`, error);
    }
};

/**
 * PERBAIKAN: Mengganti pemanggilan konteks 'this' menjadi 'exports' langsung 
 * untuk mencegah error runtime Node.js saat dipanggil di routing controller.
 */
exports.getSpkForPrint = async (nomor) => {
    try {
      // 1. Ambil Header Data SPK Utama
      const header = await exports.getSpkDetailByNomor(nomor);

      // 2. Ambil Detail Size (jika ada)
      const details = await exports.getSpkDetailSize(nomor);

      // 3. PERBAIKAN UTAMA: Mengambil data distribusi pengiriman asli dari tabel talokasi
      let alokasiDetails = [];
      if (header.Alokasi === 'YA' || header.Alokasi === 'Y') {
          const sqlAlokasi = `
              SELECT 
                  IFNULL(alamat, '') AS Alamat,
                  IFNULL(kota, '') AS Kota,
                  IFNULL(person, '') AS Person,
                  IFNULL(hp, '') AS Hp,
                  IFNULL(jumlah, 0) AS Jumlah
              FROM talokasi
              WHERE spk_nomor = ?
              ORDER BY urut ASC
          `;
          const [rowsAlokasi] = await pool.query(sqlAlokasi, [nomor]);
          
          // Lakukan pemetaan (mapping) data agar dibaca dengan seragam oleh Frontend Vue
          alokasiDetails = rowsAlokasi.map(row => {
              return {
                  // Jika alamat kosong, fallback tampilkan nama Kota (Sesuai Gambar 1: CILACAP, JEMBER, dll.)
                  Alokasi: row.Kota ? row.Kota.toUpperCase() : (row.Alamat ? row.Alamat : "-"),
                  Jumlah: Number(row.Jumlah),
                  Detail_Lengkap: {
                      Alamat: row.Alamat,
                      Kota: row.Kota,
                      Person: row.Person,
                      Hp: row.Hp
                  }
              };
          });
      }

      return {
          ...header,
          details: details,
          Daftar_Alokasi: alokasiDetails // Menggunakan nama properti array 'Daftar_Alokasi'
      };
    } catch (error) {
        throwDbError(`Gagal memproses data cetak SPK ${nomor}`, error);
    }
};

const getBaseSpkRegulerOnlyQuery = (whereClause = "1=1") => {
    return `
        SELECT x.*,
            IFNULL(
                IF(x.ppin='N', 'TOLAK',
                    IF(x.ppin='Y' AND x.ppakai='', 'ACC',
                        IF(x.ppin='Y' AND x.ppakai='Y', '', 
                            IF(x.ppin='WAIT', 'WAIT', '')
                        )
                    )
                ), ''
            ) AS Ngedit
        FROM (
            SELECT 
                t.spk_nomor AS SPK, 
                t.spk_nama AS Nama, 
                v.divisi AS Divisi, 
                t.spk_tanggal AS Tanggal, 
                t.spk_jumlah AS Jumlah,
                t.spk_ukuran AS Ukuran, 
                t.spk_kain AS Bahan, 
                t.spk_gramasi AS Gramasi,
                IFNULL(t.spk_panjang, 0) AS Panjang, 
                IFNULL(t.spk_lebar, 0) AS Lebar,
                t.spk_statuskerja AS Kepentingan,
                t.spk_cmo AS CMO,
                IF(t.spk_aktif='Y', 'Open', 'Closed') AS STATUS,
                t.spk_aktif AS Aktif,
                t.spk_pending AS Pending,
                t.spk_accpending AS AccPending,
                t.spk_newdesign AS design_baru,
                t.spk_designdone AS design_done,

                /* PIN System (Logika Ngedit) */
                IFNULL((SELECT pin_acc FROM tspk_pin5 WHERE pin_trs="SPK" AND pin_nomor=t.spk_nomor ORDER BY pin_urut DESC LIMIT 1), "NULL") as ppin,
                IFNULL((SELECT pin_dipakai FROM tspk_pin5 WHERE pin_trs="SPK" AND pin_nomor=t.spk_nomor ORDER BY pin_urut DESC LIMIT 1), "NULL") as ppakai,

                /* PERBAIKAN: Akumulasi Produksi Gabungan (Mesin Standar + Mesin Tekstil) */
                CAST((IFNULL(prod.total_cetak_reguler, 0) + IFNULL(prod_tekstil.total_cetak_tekstil, 0)) AS UNSIGNED) AS Sudah_Cetak,
                
                /* Kurang Cetak = Jumlah Order dikurangi Total Sudah Cetak */
                CAST(GREATEST(0, t.spk_jumlah - (IFNULL(prod.total_cetak_reguler, 0) + IFNULL(prod_tekstil.total_cetak_tekstil, 0))) AS UNSIGNED) AS Kurang_Cetak,
                'REGULER' as Tipe_SPK
            FROM tspk t
            LEFT JOIN v_help_spk v ON v.Spk = t.spk_nomor
            
            /* JOIN 1: Hitungan Cetak Mesin Reguler */
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_cetak_reguler
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod ON prod.ld_spk_nomor = t.spk_nomor

            /* JOIN 2: PERBAIKAN BERSAMA - Hitungan Cetak Mesin Tekstil */
            LEFT JOIN (
                SELECT ltd_spk_nomor, SUM(ltd_qty_cetak) as total_cetak_tekstil
                FROM tlhk_mesintekstil_dtl
                GROUP BY ltd_spk_nomor
            ) prod_tekstil ON prod_tekstil.ltd_spk_nomor = t.spk_nomor
            
            WHERE ${whereClause}
        ) x
    `;
};

exports.getSpkForMesin = async (keyword) => {
    try {
        // Menggunakan variabel terpisah agar string SQL ter-compile dengan sempurna oleh Node.js
        const baseQuery = getBaseSpkRegulerOnlyQuery("t.spk_aktif = 'Y'");
        let sql = `SELECT * FROM (${baseQuery}) AS spk_mesin`;
        
        const params = [];

        if (keyword) {
            sql += ` WHERE (SPK LIKE ? OR Nama LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY Tanggal DESC LIMIT 100`;
        
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data SPK khusus Mesin', error);
    }
};

exports.getMemoSpkLookupData = async (keyword) => {
    try {
        let sql = `
            SELECT 
                m.mspk_nomor AS SPK, 
                m.mspk_tanggal AS Tanggal,
                m.mspk_dateline AS Deadline,
                m.mspk_divisi AS Divisi,              
                m.mspk_nama AS Nama, 
                m.mspk_cab AS Cabang,                
                m.mspk_workshop AS Workshop,          
                'MEMO' AS Tipe_SPK,
                IFNULL(m.mspk_panjang, 0) AS Panjang, 
                IFNULL(m.mspk_lebar, 0) AS Lebar,
                m.mspk_ukuran AS Ukuran,
                m.mspk_gramasi AS Gramasi,
                m.mspk_kain AS Bahan,                
                m.mspk_finishing AS Finishing,        
                m.mspk_keterangan AS Pesan,           
                'Open' AS STATUS,
                m.mspk_aktif AS Aktif,
                m.mspk_jumlah AS Jumlah,
                CAST(IFNULL(prod_m.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, m.mspk_jumlah - IFNULL(prod_m.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak
            FROM tmemospk m
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod_m ON prod_m.ld_spk_nomor = m.mspk_nomor
            WHERE 1=1
        `;

        const params = [];

        // Jika ada keyword pencarian berdasarkan Nomor SPK atau Nama
        if (keyword) {
            sql += ` AND (m.mspk_nomor LIKE ? OR m.mspk_nama LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY m.mspk_tanggal DESC LIMIT 50`;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data lookup Memo SPK', error);
    }
};

// ===================================
// LOOKUP SPK FOR SUBLIM (Include Realisasi Bahan Gudang)
// ===================================
exports.getSpkForSublimLookup = async (keyword) => {
    try {
        // Ambil base query SPK (UNION Reguler & Memo) agar mendukung kedua tipe SPK
        const baseQuery = getBaseSpkQuery();
        
        /**
         * Perbaikan Berdasarkan Struktur Asli:
         * 1. Hubungkan combined.SPK langsung ke tmkb_hdr (Silakan sesuaikan nama kolom SPK di tmkb_hdr Anda jika berbeda)
         * 2. Hubungkan tmkb_hdr ke tmkb_dtl via mkb_nomor = mkbd_mkb_nomor
         */
        const sql = `
            SELECT 
                combined.SPK,
                combined.Nama,
                combined.Tanggal,
                combined.Jumlah AS Qty_Order,
                combined.Bahan AS Nama_Bahan_Rencana,
                combined.Tipe_SPK,
                combined.Divisi,
                combined.Panjang,
                combined.Lebar,

                -- Data Realisasi Gudang dari Header & Detail
                IFNULL(h.promin_nomor, '-') AS Nomor_Realisasi,
                IFNULL(d.promind_bhn_kode, '') AS Barang_ID,
                combined.Bahan AS Nama_Bahan_Realisasi,
                CAST(IFNULL(d.promind_jumlah, 0) AS DECIMAL(10,2)) AS Bahan_Awal
                
            FROM (${baseQuery}) AS combined
            
            -- 1. Hubungkan SPK langsung ke tabel Header (tproduksiminta_hdr)
            -- Catatan: Ganti 'mkb_spk_nomor' dengan nama kolom SPK yang ada di tproduksiminta_hdr Anda
            LEFT JOIN tproduksiminta_hdr h ON h.promin_spk_nomor = combined.SPK
            
            -- 2. Dari Header, hubungkan ke tabel Detail (tproduksiminta_dtl) untuk mengambil item kain & qty
            LEFT JOIN tproduksiminta_dtl d ON d.promind_promin_nomor = h.promin_nomor
            
            WHERE combined.Aktif = 'Y' -- Hanya ambil SPK yang masih Open
              AND (combined.SPK LIKE ? OR combined.Nama LIKE ?)
            ORDER BY combined.Tanggal DESC
            LIMIT 100
        `;

        const searchKeyword = `%${keyword || ''}%`;
        const [rows] = await pool.query(sql, [searchKeyword, searchKeyword]);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data SPK untuk Sublim beserta Realisasi Bahan', error);
    }
};