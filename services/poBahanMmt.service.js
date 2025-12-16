// backend/src/services/poMmt.service.js

const pool = require('../config/db.config'); 
const { format, parseISO } = require('date-fns');

const toRoman = (num) => {
  if (typeof num !== 'number') return '';
  const lookup = { 10: 'X', 9: 'IX', 5: 'V', 4: 'IV', 1: 'I' };
  let roman = '';
  
  if (num === 11) return 'XI';
  if (num === 12) return 'XII';

  for (let i in lookup) {
    while (num >= parseInt(i)) {
      roman += lookup[i];
      num -= parseInt(i);
    }
  }
  return roman;
};

/**
 * Helper: Get Next PO Number (00001/PK/XI/2025)
 * Memastikan urutan dihitung per bulan dan tahun.
 * @param {Date} date - Tanggal transaksi
 * @param {string} prefix - Prefix PO (misal: PK)
 */
const getNextPoNumber = async (date, prefix = 'PK', connection) => {
  const d = new Date(date);
  const year = d.getFullYear();

  const romanMonths = [
    '', 'I', 'II', 'III', 'IV', 'V', 'VI',
    'VII', 'VIII', 'IX', 'X', 'XI', 'XII'
  ];

  const romanMonth = romanMonths[d.getMonth() + 1];

  // Pola akhir nomor: .PK.XII.2025
  const suffix = `.${prefix}.${romanMonth}.${year}`;

  const db = connection || pool;

  // Ambil max nomor berdasarkan format yang benar
  const [rows] = await db.query(
    `SELECT 
        MAX(CAST(SUBSTRING_INDEX(po_nomor, '.', 1) AS UNSIGNED)) AS max_num
     FROM tpo_mmt_hdr
     WHERE po_nomor LIKE ? 
     FOR UPDATE`,
    [`%${suffix}`]
  );

  const lastNum = rows[0]?.max_num || 0;
  const nextNum = lastNum + 1;

  const padded = String(nextNum).padStart(5, '0');

  return `${padded}${suffix}`;
};


// --- Fungsi Helper Baru untuk Formatting Tanggal Aman ---
const formatDateForPrint = (dateValue) => {
    // 1. Cek jika nilai kosong atau tidak ada
    if (!dateValue) return 'N/A';
    
    // 2. Jika nilainya adalah objek Date, ubah ke string ISO
    // MySql driver sering mengembalikan objek Date JS
    if (dateValue instanceof Date) {
        // Langsung format objek Date
        return format(dateValue, 'dd/MM/yyyy');
    }
    
    // 3. Jika berupa string, parseISO untuk memastikan format yang benar
    try {
        return format(parseISO(String(dateValue)), 'dd/MM/yyyy');
    } catch (e) {
        // Fallback jika parsing gagal
        console.error("Format date error:", e);
        return String(dateValue); 
    }
};
// --- READ ALL (Browse) ---
const getPoMmtData = async (startDate, endDate, supplier) => {
  const sql = `
    SELECT
      h.po_nomor AS Nomor, h.po_tanggal AS Tanggal, h.po_dateline AS Dateline,
      h.po_sup_kode AS KodeSup, s.sup_nama AS Nama, h.po_gdg_kode AS Cab,
      CASE
        WHEN h.po_isclosed = 1 THEN 'CLOSE'
        WHEN EXISTS (SELECT 1 FROM tpo_mmt_dtl d WHERE d.pod_po_nomor = h.po_nomor AND d.pod_qty_terima > 0) THEN 'ONPROSES'
        ELSE 'OPEN'
      END AS Status,
      h.po_istax AS IsTax, h.po_memo AS Keterangan
    FROM tpo_mmt_hdr h
    LEFT JOIN tsupplier s ON h.po_sup_kode = s.sup_kode
    WHERE h.po_tanggal BETWEEN ? AND ?
    ${supplier ? `AND (h.po_sup_kode LIKE ? OR s.sup_nama LIKE ?)` : ''}
    ORDER BY h.po_tanggal DESC, h.po_nomor DESC
  `;
  const params = [startDate, endDate];
  if (supplier) {
    params.push(`%${supplier}%`, `%${supplier}%`);
  }

  const [rows] = await pool.query(sql, params);
  return rows;
};

const getPoDetailByNomor = async (nomor) => {
    // Query ini sama persis dengan yang ada di getPOById sebelumnya
  const sql = `
    SELECT 
      d.pod_nourut AS no, 
            d.pod_brg_kode AS kode, 
            b.brg_nama AS nama,
      d.pod_keterangan AS namaext, 
            d.pod_brg_satuan AS Satuan, 
            d.pod_qty AS QTY,
      d.pod_qty_terima AS QtyBPB,
            d.pod_harga AS harga, 
            d.pod_discpr AS diskon, 
            d.pod_spk_nomor AS spk,
      pod_qty * pod_harga * (1 - pod_discpr / 100) AS total
    FROM tpo_mmt_dtl d
    LEFT JOIN tbarang_mmt b ON d.pod_brg_kode = b.brg_kode
    WHERE d.pod_po_nomor = ? 
        ORDER BY d.pod_nourut
  `;
  const [rows] = await pool.query(sql, [nomor]);
  return rows;
}

// --- READ ONE (Load by ID for Form) ---
const getPOById = async (nomor) => {
  const [headerRows] = await pool.query(
    `SELECT 
      h.po_nomor AS Nomor, h.po_tanggal AS Tanggal, h.po_sup_kode AS KodeSup,
      s.sup_nama AS SupNama, s.sup_alamat AS SupAlamat, s.sup_kota AS SupKota,
      h.po_memo AS Keterangan,  h.po_istax AS IsPpn,
      h.po_taxamount AS PpnRate, h.po_isclosed AS IsClosed, h.po_type AS JenisPo,
      h.po_dateline AS Dateline
    FROM tpo_mmt_hdr h
    LEFT JOIN tsupplier s ON h.po_sup_kode = s.sup_kode
    WHERE h.po_nomor = ?`,
    [nomor]
  );

  if (headerRows.length === 0) return null;

  const header = headerRows[0];
  
  // --- Detail Item (SUDAH MENAMPILKAN DETAIL) ---
  const [detailRows] = await pool.query(
    `SELECT pod_nourut AS no, pod_brg_kode AS kode, b.brg_name AS nama,
      pod_keterangan AS namaext, pod_brg_satuan AS satuan, pod_qty AS jumlah,
      pod_harga AS harga, pod_discpr AS diskon, pod_spk_nomor AS spk,
      d.pod_mb_nomor AS mb_nomor,
      pod_qty * pod_harga * (1 - pod_discpr / 100) AS total
    FROM tpo_mmt_dtl d
    LEFT JOIN tbarang b ON d.pod_brg_kode = b.brg_kode
    WHERE d.pod_po_nomor = ? ORDER BY d.pod_nourut`,
    [nomor]
  );

  // Placeholder untuk commitments dan rolls (Perlu tabel tpo_mmt_dtl2/3 untuk diimplementasikan)
  const commitments = []; 
  const rolls = []; 

  return {
    ...header,
    Detail: detailRows, // <-- Detail item dikirim ke frontend
    Commitments: commitments,
    Rolls: rolls,
    Status: header.IsClosed === 1 ? 'CLOSE' : 'OPEN',
    PinStatus: ''
  };
};

// --- SAVE (Insert/Update) ---
const savePoMmt = async (data, nomorToEdit, currentUser) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let poNomor;
    const isUpdating = !!nomorToEdit;

    const {
      tanggal, supKode, keterangan, isPpn, ppnRate, detail,
      dateline, jenisPo
    } = data;

    // Hitung total PO dari detail
    const totalAmount = detail
      .filter(d => d.kode)
      .reduce((sum, d) => sum + (Number(d.total) || 0), 0);

    const isTaxInt = isPpn ? 1 : 0;

    // =====================================================
    // =============== UPDATE MODE ==========================
    // =====================================================
    if (isUpdating) {
      poNomor = nomorToEdit;

      await connection.query(
        `UPDATE tpo_mmt_hdr SET 
           po_tanggal = ?, po_sup_kode = ?, po_memo = ?, po_istax = ?, po_taxamount = ?, 
           po_amount = ?, date_modified = NOW(), user_modified = ?, po_dateline = ?, po_type = ?
         WHERE po_nomor = ?`,
        [tanggal, supKode, keterangan, isTaxInt, ppnRate, totalAmount,
         currentUser, dateline, jenisPo, poNomor]
      );

      // Hapus detail lama
      await connection.query('DELETE FROM tpo_mmt_dtl WHERE pod_po_nomor = ?', [poNomor]);
    }
    // =====================================================
    // ================= INSERT MODE BARU ==================
    // =====================================================
    else {
      const transDate = new Date(tanggal);

      // generate nomor PO
      poNomor = await getNextPoNumber(transDate, 'PK', connection);

      await connection.query(
        `INSERT INTO tpo_mmt_hdr (
           po_nomor, po_tanggal, po_sup_kode, po_memo, po_istax, po_taxamount, po_amount,
           po_gdg_kode, date_create, user_create, po_dateline, po_type
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [poNomor, tanggal, supKode, keterangan, isTaxInt, ppnRate, totalAmount,
         'MMT', currentUser, dateline, jenisPo]
      );
    }

    // =====================================================
    // =============== INSERT DETAIL PO =====================
    // =====================================================
    const validItems = detail.filter(d => d.kode);

    for (const [index, item] of validItems.entries()) {
      const diskonValue = Number(item.diskon) || 0;
      
      // ✅ PERBAIKAN TIPE DATA (Mencegah Truncated Error)
      // Gunakan parseFloat untuk memastikan kuantitas dan harga diproses sebagai angka desimal
      const qtyValue = parseFloat(item.jumlah) || 0; 
      const hargaValue = parseFloat(item.harga) || 0;
      
      const namaExtValue = String(item.namaext || item.nama || '');
      const spkValue = item.spk || null;
      const mbNomorValue = item.mb_nomor || null; // Nilai Permintaan Bahan

      await connection.query(
        `INSERT INTO tpo_mmt_dtl (
           pod_po_nomor, pod_nourut, pod_mb_nomor, pod_brg_kode, pod_brg_satuan,
           pod_qty, pod_harga, pod_discpr, pod_keterangan, pod_spk_nomor
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          poNomor,
          index + 1,
          // ✅ PERBAIKAN URUTAN PARAMETER SQL (Harus 10 parameter)
          mbNomorValue, // 1. pod_mb_nomor (Nomor Permintaan Bahan)
          item.kode,    // 2. pod_brg_kode
          item.satuan,  // 3. pod_brg_satuan
          qtyValue,     // 4. pod_qty
          hargaValue,   // 5. pod_harga
          diskonValue,  // 6. pod_discpr
          namaExtValue, // 7. pod_keterangan
          spkValue      // 8. pod_spk_nomor
          
          // Total 10 parameter: poNomor, index+1, mbNomorValue, item.kode, item.satuan, 
          // qtyValue, hargaValue, diskonValue, namaExtValue, spkValue.
        ]
      );
    }


    // ✅ PENTING: Gunakan mb_nomor untuk update status Permintaan Bahan (bukan SPK)
    const uniqueMbNomors = [...new Set(validItems.map(d => d.mb_nomor).filter(Boolean))];

    // Jika tidak ada Permintaan Bahan (mb_nomor), skip bagian ini
    if (uniqueMbNomors.length > 0) {

      for (const mbNomor of uniqueMbNomors) {

        const [statusRows] = await connection.query(
            `SELECT 
              req.mbd_brg_kode AS Kode,
              req.mbd_qty AS Required_Qty,
              COALESCE(SUM(pod.pod_qty), 0) AS Committed_PO_Qty
            FROM tmintabahan_mmt_dtl req
            LEFT JOIN tpo_mmt_dtl pod 
                  ON pod.pod_mb_nomor = req.mbd_mb_nomor
                  AND pod.pod_brg_kode = req.mbd_brg_kode
            WHERE req.mbd_mb_nomor = ?
            GROUP BY req.mbd_brg_kode`,
          [mbNomor]
        );

        let isAllItemsFullyPoed = true;

        for (const statusItem of statusRows) {
          const poQty = Number(statusItem.Committed_PO_Qty);
          const requiredQty = Number(statusItem.Required_Qty);

          // update qty_po
          await connection.query(
            `UPDATE tmintabahan_mmt_dtl 
              SET mbd_qty_po = ?
              WHERE mbd_mb_nomor = ? AND mbd_brg_kode = ?`,
            [poQty, mbNomor, statusItem.Kode]
          );

          // cek apakah terpenuhi
          if (poQty < requiredQty) {
            isAllItemsFullyPoed = false;
          }
        }

        // update header
        const newCloseStatus = isAllItemsFullyPoed ? 1 : 0;

        await connection.query(
          `UPDATE tmintabahan_mmt_hdr 
            SET mb_close_po = ?, date_modified = NOW(), user_modified = ?
            WHERE mb_nomor = ?`,
          [newCloseStatus, currentUser, mbNomor]
        );
      }
    }

    await connection.commit();
    return { Nomor: poNomor };

  } catch (error) {
    await connection.rollback();
    console.error("Save PO Error:", error);
    // ✅ Tambahkan error.message untuk detail error lebih jelas
    throw new Error(`Gagal menyimpan data PO: ${error.message || error}`); 
  } finally {
    connection.release();
  }
};

// --- DELETE ---
const deletePoMmt = async (nomor) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const [statusRows] = await connection.query('SELECT po_isclosed FROM tpo_mmt_hdr WHERE po_nomor = ?', [nomor]);
    if (statusRows.length === 0) {
       await connection.rollback();
       return false;
    }
    if (statusRows[0].po_isclosed === 1) {
       throw new Error('PO sudah di-CLOSE dan tidak dapat dihapus.');
    }

    await connection.query('DELETE FROM tpo_mmt_dtl WHERE pod_po_nomor = ?', [nomor]);
    const [result] = await connection.query('DELETE FROM tpo_mmt_hdr WHERE po_nomor = ?', [nomor]);

    await connection.commit();
    return result.affectedRows > 0;
    
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// --- TOGGLE CLOSE ---
const toggleCloseStatus = async (nomor, action, user) => {
  const newStatus = action === 'CLOSE' ? 1 : 0;
  
  const [result] = await pool.query(
    `UPDATE tpo_mmt_hdr SET
      po_isclosed = ?, date_modified = NOW(), user_modified = ?
    WHERE po_nomor = ?`,
    [newStatus, user, nomor]
  );

  if (result.affectedRows === 0) {
    throw new Error('Nomor PO tidak ditemukan.');
  }
  return true;
};

// --- GET DETAIL ITEM FOR LOOKUP (Contoh: MKB) ---
const loadMkbDetail = async (nomorMkb) => {
  const sql = `
    SELECT
      d.mkbd_bhn_kode AS kode, b.brg_name AS nama, d.mkbd_bhn_satuan AS satuan,
      d.mkbd_jumlah_po AS jumlah, b.brg_hargabeli AS harga, 0 AS diskon,
      d.mkbd_spk_nomor AS spk, ? AS mkb
    FROM tmkb_dtl d
    LEFT JOIN tbarang b ON b.brg_kode = d.mkbd_bhn_kode
    WHERE d.mkbd_mkb_nomor = ?
  `;
  const [detailRows] = await pool.query(sql, [nomorMkb, nomorMkb]);
  
  if (detailRows.length === 0) {
    throw new Error('MKB tidak ditemukan atau tidak memiliki detail yang valid.');
  }

  const detailsWithTotal = detailRows.map(item => ({
    ...item,
    total: item.jumlah * item.harga * (1 - item.diskon / 100),
    namaext: item.nama, 
    roll: 0
  }));

  return { Detail: detailsWithTotal };
};

const getPoDataForPrint = async (nomor) => {
    // 1. Ambil Header dan Detail dari fungsi yang sudah ada (getPOById)
    const poData = await getPOById(nomor);
    if (!poData) throw new Error("Data PO tidak ditemukan.");

    const [compRows] = await pool.query(
        `SELECT 
            perush_nama AS comp_name, 
            perush_alamat AS comp_alamat, 
            perush_npwp AS comp_npwp 
         FROM tperusahaan WHERE perush_kode = 'KP'`
    );
    const compInfo = compRows[0] || {};
    
    // 3. Hitung Summary
    const subTotal = poData.Detail.reduce((sum, d) => sum + (d.total || 0), 0);
    const ppnRate = poData.IsPpn === 1 ? (poData.PpnRate || 11) : 0;
    const totalPpn = subTotal * (ppnRate / 100);
    const grandTotal = subTotal + totalPpn;

    // 4. Format Output
    const formattedData = {
        Header: {
            Nomor: poData.Nomor,
            // MENGGUNAKAN HELPER BARU UNTUK MENGHINDARI ERROR SPLIT
            Tanggal: formatDateForPrint(poData.Tanggal),
            TglPengiriman: formatDateForPrint(poData.Dateline),
            KeteranganHeader: poData.Keterangan, 
            IsPpn: poData.IsPpn,
            PpnRate: ppnRate,
            SubTotal: subTotal,
            TotalPpn: totalPpn,
            GrandTotal: grandTotal,
            NamaSupplier: poData.SupNama,
            AlamatSupplier: poData.SupAlamat,
            KotaSupplier: poData.SupKota,
            // Informasi Perusahaan (dari compInfo)
            NamaPerusahaan: compInfo.comp_name || 'CV. KENCANA PRINT',
            AlamatPerusahaan: compInfo.comp_alamat || 'Padokan, RT. 04 / RW. 04, Sawahan',
            NPWPPerusahaan: compInfo.comp_npwp || '02.765.779.0-527.000',
        },
        Detail: poData.Detail.map(d => ({
            NoUrut: d.no,
            Kode: d.kode,
            Deskripsi: d.namaext || d.nama || 'N/A', 
            Quantity: d.jumlah,
            Satuan: d.satuan,
            UnitPrice: d.harga,
            Total: d.total,
        })),
    };

    return formattedData;
};

const getUnfulfilledMbDetail = async (mbNomor) => {
    const sql = `
        SELECT
            req.mbd_brg_kode AS Kode,
            b.brg_nama AS Nama_Bahan,
            req.mbd_brg_satuan AS Satuan,
            req.mbd_spk_nomor AS Nomor_SPK,
            req.mbd_qty AS Required_Qty,
            req.mbd_qty_po AS Committed_PO_Qty,
            (req.mbd_qty - req.mbd_qty_po) AS Sisa_Qty_Diminta
        FROM tmintabahan_mmt_dtl req
        LEFT JOIN tbarang_mmt b ON req.mbd_brg_kode = b.brg_kode
        WHERE req.mbd_mb_nomor = ? 
          -- KRITIS: Hanya ambil jika Sisa_Qty_Diminta > 0
          AND (req.mbd_qty - COALESCE(req.mbd_qty_po, 0)) > 0
        ORDER BY req.mbd_nourut
    `;

    const [rows] = await pool.query(sql, [mbNomor]);
    
    // Perlu juga ambil data header (untuk keterangan, dll.)
    const [headerRows] = await pool.query(
        `SELECT mb_memo FROM tmintabahan_mmt_hdr WHERE mb_nomor = ?`,
        [mbNomor]
    );

    const header = headerRows[0] || {};

    return {
        Nomor: mbNomor,
        Keterangan: header.mb_memo || '',
        // Format Detail untuk digunakan di frontend
        Detail: rows.map(item => ({
            Kode: item.Kode,
            Nama_Bahan: item.Nama_Bahan,
            Satuan: item.Satuan,
            Nomor_SPK: item.Nomor_SPK,
            // Gunakan Sisa_Qty_Diminta sebagai jumlah yang akan di-PO
            Jumlah: parseFloat(item.Sisa_Qty_Diminta) || 0,
            
            // Tambahkan data Permintaan Bahan yang diperlukan
            Harga: 0, // Harga akan diisi manual/dari master harga
            Diskon: 0,
            mb_nomor: mbNomor,
            
            // Data tambahan untuk referensi
            Qty_Diminta_Awal: parseFloat(item.Required_Qty) || 0,
            Qty_PO_Lalu: parseFloat(item.Committed_PO_Qty) || 0,
        }))
    };
};

// Export semua fungsi service menggunakan CommonJS
module.exports = {
  getPoMmtData,
  getPoDetailByNomor,
  getPoDataForPrint,
  getPOById,
  savePoMmt,
  deletePoMmt,
  toggleCloseStatus,
  loadMkbDetail,
  getUnfulfilledMbDetail

};