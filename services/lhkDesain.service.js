const pool = require('../config/db.config');
const { format } = require('date-fns');

// Helper penyeragaman format error database
const throwDbError = (message, error) => { 
    throw new Error(message + ': ' + error.message); 
};

/**
 * 1. Tarik Data Utama untuk Load All LHK Desain (Header, Status, Komponen, Bordir)
 * Menggunakan pendekatan Single SPK/MAP per form
 */
exports.getFullLhkDesain = async (nomorSpk) => {
    try {
        let headerQuery = '';
        
        // Deteksi tipe nomor dokumen (Memo SPK menggunakan prefix 'MAP')
        if (nomorSpk.startsWith('MAP')) {
            headerQuery = `
                SELECT 
                    s.mspk_nomor AS spk,
                    s.mspk_tanggal AS tgl,
                    s.mspk_dateline AS dateline,
                    s.mspk_nama AS nama,
                    s.mspk_finishing AS finishing,
                    '-' AS bordir,
                    '-' AS map,
                    h.ld_tanggal,
                    s.mspk_panjang,
                    s.mspk_lebar,
                    s.mspk_cab
                FROM tmemospk s
                LEFT JOIN tlhkdesign h ON h.ld_spk = s.mspk_nomor
                WHERE s.mspk_cmo <> '' AND s.mspk_nomor = ?;
            `;
        } else {
            headerQuery = `
                SELECT 
                    s.spk_nomor AS spk,
                    s.spk_tanggal AS tgl,
                    s.spk_dateline AS dateline,
                    s.spk_nama AS nama,
                    s.spk_finishing AS finishing,
                    s.spk_bordir AS bordir,
                    s.spk_memo AS map,
                    s.spk_panjang,
                    s.spk_lebar,
                    s.spk_cab,
                    h.ld_tanggal
                FROM tspk s
                LEFT JOIN tlhkdesign h ON h.ld_spk = s.spk_nomor
                WHERE s.spk_aktif = 'Y' AND s.spk_cmo <> '' AND s.spk_nomor = ?;
            `;
        }

        const [headerResults] = await pool.query(headerQuery, [nomorSpk]);
        if (headerResults.length === 0) return null;

        const header = headerResults[0];

        // --- GRID 1: Tracking Status Kerja Desain (CDS) ---
        const statusQuery = `
            SELECT 
                u.user_cab AS user_cab,
                d.lds_user AS lds_user,
                d.lds_status AS lds_status,
                DATE_FORMAT(d.lds_tgl, '%d-%m-%Y') AS lds_tgl,
                TIME(d.lds_tgl) AS lds_jam,
                d.lds_durasi AS lds_durasi,
                d.lds_note AS lds_note
            FROM tlhkdesign_status d
            LEFT JOIN tuser u ON u.user_kode = d.lds_user
            WHERE d.lds_spk = ?
            ORDER BY d.lds_tgl ASC;
        `;
        const [statusResults] = await pool.query(statusQuery, [nomorSpk]);

        // --- GRID 2: Rincian Ukuran & Komponen Output (CDS2) -> Join menggunakan brg_kode ---
        const komponenQuery = `
            SELECT 
                k.ldk_output AS ldk_output,
                k.ldk_kode AS ldk_kode,
                b.bhn_name AS brg_nama,
                k.ldk_finishing AS ldk_finishing,
                k.ldk_panjang AS ldk_panjang,
                k.ldk_lebar AS ldk_lebar,
                k.ldk_jumlah AS ldk_jumlah,
                k.ldk_sticth AS ldk_sticth,
                k.ldk_pakai AS ldk_pakai
            FROM tlhkdesign_komponen k
            LEFT JOIN tbahan b ON b.bhn_kode = k.ldk_kode
            WHERE k.ldk_spk = ?;
        `;
        const [komponenResults] = await pool.query(komponenQuery, [nomorSpk]);

        // --- GRID 3: Komponen Titik Bordir (CDS3) ---
        let bordirResults = [];
        if (header.bordir === 'Y' || nomorSpk.startsWith('MAP')) {
            const bordirQuery = `
                SELECT a.sk_kode AS sk_kode, b.bhn_name AS brg_nama
                FROM tspk_komponen_bordir a
                LEFT JOIN tbahan b ON b.bhn_kode = a.sk_kode
                WHERE a.sk_nomor = ?
                ORDER BY a.sk_nourut ASC;
            `;
            const [rows] = await pool.query(bordirQuery, [nomorSpk]);
            bordirResults = rows;

            // Fallback ke proof garment jika data bordir utama kosong (Sesuai logic Delphi)
            if (bordirResults.length === 0 && header.map && header.map !== '-') {
                const proofQuery = `
                    SELECT DISTINCT d.pfd_kode AS sk_kode, b.bhn_name AS brg_nama 
                    FROM tproofgarmen_dtl d
                    LEFT JOIN tbahan b ON b.bhn_kode = d.pfd_kode
                    WHERE d.pfd_nomor IN (
                        SELECT h.pf_nomor FROM tproofgarmen_hdr h 
                        WHERE h.pf_lini = 'BORDIR' AND h.pf_spk_nomor = ?
                    );
                `;
                const [pRows] = await pool.query(proofQuery, [header.map]);
                bordirResults = pRows;
            }
        }

        // Return data gabungan ter-format untuk dikonsumsi Vue 3 Frontend
        return {
            header: {
                spk: header.spk,
                nama: header.nama,
                tgl: header.tgl ? format(new Date(header.tgl), 'yyyy-MM-dd') : '',
                dateline: header.dateline ? format(new Date(header.dateline), 'yyyy-MM-dd') : '',
                finishing: header.finishing,
                bordir: header.bordir,
                map: header.map,
                panjang: header.mspk_panjang || header.spk_panjang || 0,
                lebar: header.mspk_lebar || header.spk_lebar || 0,
                cab: header.mspk_cab || header.spk_cab || '',
                ld_tanggal: header.ld_tanggal ? format(new Date(header.ld_tanggal), 'yyyy-MM-dd') : null
            },
            status: statusResults,
            komponen: komponenResults,
            bordir: bordirResults
        };
    } catch (error) {
        throwDbError('Gagal memuat seluruh rincian data LHK Desain', error);
    }
};

/**
 * 2. Simpan Data LHK Desain (Header, Status, Komponen, Bordir) dengan DB Transaction
 */
exports.saveLhkDesain = async (data, userLogin) => {
  const connection = await pool.getConnection();
  try {
      await connection.beginTransaction();

      const { flagEdit, header, status, komponen, bordir } = data;
      const serverTime = new Date();
      const activeUser = userLogin || 'SYSTEM';

      // A. INPUT / UPDATE HEADER (Tabel: tlhkdesign)
      if (flagEdit) {
          await connection.query(
              `UPDATE tlhkdesign SET 
                  ld_tanggal = ?, 
                  user_modified = ?, 
                  date_modified = ? 
               WHERE ld_spk = ?`,
              [header.ld_tanggal, activeUser, serverTime, header.ld_spk]
          );
      } else {
          await connection.query(
              `INSERT INTO tlhkdesign 
                  (ld_spk, ld_tanggal, user_create, date_create) 
               VALUES (?, ?, ?, ?)`,
              [header.ld_spk, header.ld_tanggal, activeUser, serverTime]
          );
      }

      // B. RE-INIT DATA DETAIL (Delete lama untuk overwrite aman)
      await connection.query('DELETE FROM tlhkdesign_status WHERE lds_spk = ?', [header.ld_spk]);
      await connection.query('DELETE FROM tlhkdesign_komponen WHERE ldk_spk = ?', [header.ld_spk]);
      if (header.spk_bordir === 'Y') {
          await connection.query('DELETE FROM tspk_komponen_bordir WHERE sk_nomor = ?', [header.ld_spk]);
      }

      // C. INSERT GRID 1: STATUS PENGERJAAN
      if (status && status.length > 0) {
          const statusValues = status.map((s) => {
              // Parsing format string tanggal 'dd-mm-yyyy HH:mm:ss' kembali ke format standar MySQL DateTime
              let parsedDateTime = serverTime;
              if (s.lds_tgl && s.lds_jam) {
                  const [day, month, year] = s.lds_tgl.split('-');
                  parsedDateTime = new Date(`${year}-${month}-${day} ${s.lds_jam}`);
              }
              return [
                  header.ld_spk,
                  s.lds_user || activeUser,
                  s.lds_status,
                  parsedDateTime,
                  s.lds_durasi || '',
                  s.lds_note || ''
              ];
          });

          await connection.query(
              `INSERT INTO tlhkdesign_status 
                  (lds_spk, lds_user, lds_status, lds_tgl, lds_durasi, lds_note) 
               VALUES ?`,
              [statusValues]
          );
      }

      // D. INSERT GRID 2: RINCIAN UKURAN & KOMPONEN OUTPUT BAHAN MMT
      if (komponen && komponen.length > 0) {
          const komponenValues = komponen.map((k) => [
              header.ld_spk,
              k.ldk_kode,
              k.ldk_output || 'MMT',
              k.ldk_finishing || '',
              Number(k.ldk_panjang) || 0,
              Number(k.ldk_lebar) || 0,
              Number(k.ldk_jumlah) || 0,
              Number(k.ldk_sticth) || 0,
              Number(k.ldk_pakai) || 0
          ]);

          await connection.query(
              `INSERT INTO tlhkdesign_komponen 
                  (ldk_spk, ldk_kode, ldk_output, ldk_finishing, ldk_panjang, ldk_lebar, ldk_jumlah, ldk_sticth, ldk_pakai) 
               VALUES ?`,
              [komponenValues]
          );
      }

      // E. INSERT GRID 3: TITIK BORDIR
      if (header.spk_bordir === 'Y' && bordir && bordir.length > 0) {
          const bordirValues = bordir.map((b, index) => [
              header.ld_spk,
              b.sk_kode,
              index + 1 // sk_nourut secara serial
          ]);

          await connection.query(
              `INSERT INTO tspk_komponen_bordir 
                  (sk_nomor, sk_kode, sk_nourut) 
               VALUES ?`,
              [bordirValues]
          );
      }

      await connection.commit();
      return { success: true, nomorSpk: header.ld_spk };

  } catch (error) {
      await connection.rollback();
      throwDbError('Gagal memproses simpan transaksi LHK Desain', error);
  } finally {
      connection.release();
  }
};

/**
 * 3. Validasi & Load Komponen Bahan Secara Instan (Untuk Event Perubahan Kode / F1)
 */
exports.validateBahanLhk = async (kode, outputType) => {
    try {
        let sql = '';
        const searchPattern = `%${kode}%`;

        if (outputType === 'BORDIR') {
            sql = `
                SELECT bhn_kode AS Kode, bhn_name AS Nama, bhn_satuan AS Satuan 
                FROM tbahan 
                WHERE bhn_bordir <> 0 AND bhn_aktif = 0 AND bhn_kode LIKE ? 
                LIMIT 1;
            `;
        } else {
            sql = `
                SELECT bhn_kode AS Kode, bhn_name AS Nama, bhn_satuan AS Satuan
                FROM tbahan 
                WHERE bhn_bordir = 0 AND bhn_jb_kode = 'LL' AND bhn_aktif = 0 AND bhn_kode LIKE ? 
                LIMIT 1;
            `;
        }

        const [results] = await pool.query(sql, [searchPattern]);
        
        if (results.length === 0) {
            return { eof: true, brg_nama: '' };
        }
        
        return { eof: false, kode: results[0].Kode, brg_nama: results[0].Nama };
    } catch (error) {
        throwDbError('Gagal melakukan validasi komponen bahan', error);
    }
};