// backend/src/services/poMmt.service.js

const pool = require('../config/db.config'); 
const { format, parseISO } = require('date-fns');

// --- Helper: Penanganan Error Database ---
const throwDbError = (message, error) => {
  console.error(`${message}:`, error);
  throw new Error(`${message}: ${error.message || error}`);
};

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
 */
const getNextPoNumber = async (date, prefix = 'PK', connection) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const romanMonths = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const romanMonth = romanMonths[d.getMonth() + 1];
  const suffix = `.${prefix}.${romanMonth}.${year}`;
  const db = connection || pool;

  const [rows] = await db.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(po_nomor, '.', 1) AS UNSIGNED)) AS max_num
     FROM tpo_mmt_hdr
     WHERE po_nomor LIKE ? FOR UPDATE`,
    [`%${suffix}`]
  );

  const lastNum = rows[0]?.max_num || 0;
  const nextNum = lastNum + 1;
  const padded = String(nextNum).padStart(5, '0');
  return `${padded}${suffix}`;
};

const formatDateForPrint = (dateValue) => {
  if (!dateValue) return 'N/A';
  if (dateValue instanceof Date) return format(dateValue, 'dd/MM/yyyy');
  try {
    return format(parseISO(String(dateValue)), 'dd/MM/yyyy');
  } catch (e) {
    return String(dateValue); 
  }
};

const getPoMmtData = async (startDate, endDate, supplier) => {
  const sql = `
    SELECT
      h.po_nomor AS Nomor, 
      h.po_tanggal AS Tanggal, 
      h.po_dateline AS Dateline,
      h.po_sup_kode AS KodeSup, 
      s.sup_nama AS Nama, 
      h.po_gdg_kode AS Cab,
      CASE
        -- 1. Cek jika PO ditutup secara manual oleh user
        WHEN h.po_isclosed = 1 THEN 'CLOSE'

        -- 2. Cek jika SEMUA item dalam PO sudah diterima penuh (qty_terima >= qty)
        -- Jika TIDAK ADA satu pun item yang qty_terimanya masih kurang dari pod_qty, maka CLOSED
        WHEN NOT EXISTS (
          SELECT 1 FROM tpo_mmt_dtl d 
          WHERE d.pod_po_nomor = h.po_nomor 
          AND d.pod_qty_terima < d.pod_qty
        ) THEN 'CLOSED'

        -- 3. Cek jika ADA item yang sudah mulai diterima (qty_terima > 0)
        -- Karena kondisi 'Full' sudah dicek di atas, maka yang masuk ke sini pasti 'Sebagian'
        WHEN EXISTS (
          SELECT 1 FROM tpo_mmt_dtl d 
          WHERE d.pod_po_nomor = h.po_nomor 
          AND d.pod_qty_terima > 0
        ) THEN 'ONPROSES'

        -- 4. Jika belum ada penerimaan sama sekali
        ELSE 'OPEN'
      END AS Status,
      h.po_istax AS IsTax, 
      h.po_memo AS Keterangan
    FROM tpo_mmt_hdr h
    LEFT JOIN tsupplier s ON h.po_sup_kode = s.sup_kode
    WHERE h.po_tanggal BETWEEN ? AND ?
    ${supplier ? `AND (h.po_sup_kode LIKE ? OR s.sup_nama LIKE ?)` : ''}
    ORDER BY h.po_tanggal DESC, h.po_nomor DESC
  `;

  const params = [startDate, endDate];
  if (supplier) params.push(`%${supplier}%`, `%${supplier}%`);
  
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    // Pastikan fungsi throwDbError sudah didefinisikan di file Anda
    console.error("Database Error:", error);
    throw new Error("Gagal mengambil data laporan PO");
  }
};

const getPoDetailByNomor = async (nomor) => {
  const sql = `
    SELECT 
      d.pod_nourut AS no, d.pod_brg_kode AS kode, b.brg_nama AS nama,
      d.pod_keterangan AS namaext, d.pod_brg_satuan AS Satuan, d.pod_qty AS QTY,
      d.pod_qty_terima AS QtyBPB, d.pod_harga AS harga, d.pod_discpr AS diskon, d.pod_spk_nomor AS spk,
      pod_qty * pod_harga * (1 - pod_discpr / 100) AS total
    FROM tpo_mmt_dtl d
    LEFT JOIN tbarang_mmt b ON d.pod_brg_kode = b.brg_kode
    WHERE d.pod_po_nomor = ? 
    ORDER BY d.pod_nourut
  `;
  const [rows] = await pool.query(sql, [nomor]);
  return rows;
};

const getPOById = async (nomor) => {
  const [headerRows] = await pool.query(
    `SELECT 
      h.po_nomor AS Nomor, h.po_tanggal AS Tanggal, h.po_sup_kode AS KodeSup,
      s.sup_nama AS SupNama, s.sup_alamat AS SupAlamat, s.sup_kota AS SupKota,
      h.po_memo AS Keterangan, h.po_istax AS IsPpn,
      h.po_taxamount AS PpnRate, h.po_isclosed AS IsClosed, h.po_type AS JenisPo,
      h.po_dateline AS Dateline
    FROM tpo_mmt_hdr h
    LEFT JOIN tsupplier s ON h.po_sup_kode = s.sup_kode
    WHERE h.po_nomor = ?`,
    [nomor]
  );

  if (headerRows.length === 0) return null;
  const header = headerRows[0];
  
  const [detailRows] = await pool.query(
    `SELECT d.pod_nourut AS no, d.pod_brg_kode AS kode, b.brg_nama AS nama,
      d.pod_keterangan AS namaext, d.pod_brg_satuan AS satuan, d.pod_qty AS jumlah,
      d.pod_harga AS harga, d.pod_discpr AS diskon, d.pod_spk_nomor AS spk,
      d.pod_mb_nomor AS mb_nomor,
      d.pod_qty * d.pod_harga * (1 - d.pod_discpr / 100) AS total
    FROM tpo_mmt_dtl d
    LEFT JOIN tbarang_mmt b ON d.pod_brg_kode = b.brg_kode
    WHERE d.pod_po_nomor = ? ORDER BY d.pod_nourut`,
    [nomor]
  );

  return {
    ...header,
    Detail: detailRows,
    Commitments: [], rolls: [],
    Status: header.IsClosed === 1 ? 'CLOSE' : 'OPEN',
    PinStatus: ''
  };
};

const savePoMmt = async (data, nomorToEdit, currentUser) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let poNomor;
    const isUpdating = !!nomorToEdit;
    const { tanggal, supKode, keterangan, isPpn, ppnRate, detail, dateline, jenisPo } = data;

    const totalAmount = detail.filter(d => d.kode).reduce((sum, d) => sum + (Number(d.total) || 0), 0);
    const isTaxInt = isPpn ? 1 : 0;

    if (isUpdating) {
      poNomor = nomorToEdit;
      await connection.query(
        `UPDATE tpo_mmt_hdr SET po_tanggal = ?, po_sup_kode = ?, po_memo = ?, po_istax = ?, po_taxamount = ?, 
         po_amount = ?, date_modified = NOW(), user_modified = ?, po_dateline = ?, po_type = ?
         WHERE po_nomor = ?`,
        [tanggal, supKode, keterangan, isTaxInt, ppnRate, totalAmount, currentUser, dateline, jenisPo, poNomor]
      );
      await connection.query('DELETE FROM tpo_mmt_dtl WHERE pod_po_nomor = ?', [poNomor]);
    } else {
      poNomor = await getNextPoNumber(new Date(tanggal), 'PK', connection);
      await connection.query(
        `INSERT INTO tpo_mmt_hdr (po_nomor, po_tanggal, po_sup_kode, po_memo, po_istax, po_taxamount, po_amount,
         po_gdg_kode, date_create, user_create, po_dateline, po_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
        [poNomor, tanggal, supKode, keterangan, isTaxInt, ppnRate, totalAmount, 'WH-16', currentUser, dateline, jenisPo]
      );
    }

    const validItems = detail.filter(d => d.kode);
    for (const [index, item] of validItems.entries()) {
      await connection.query(
        `INSERT INTO tpo_mmt_dtl (pod_po_nomor, pod_nourut, pod_mb_nomor, pod_brg_kode, pod_brg_satuan,
         pod_qty, pod_harga, pod_discpr, pod_keterangan, pod_spk_nomor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poNomor, index + 1, item.mb_nomor || null, item.kode, item.satuan, parseFloat(item.jumlah) || 0, 
         parseFloat(item.harga) || 0, Number(item.diskon) || 0, String(item.namaext || item.nama || ''), item.spk || null]
      );
    }

    // Update Permintaan Bahan status
    const uniqueMbNomors = [...new Set(validItems.map(d => d.mb_nomor).filter(Boolean))];
    for (const mbNomor of uniqueMbNomors) {
      const [statusRows] = await connection.query(
        `SELECT req.mbd_brg_kode AS Kode, req.mbd_qty AS Required_Qty, COALESCE(SUM(pod.pod_qty), 0) AS Committed_PO_Qty
         FROM tmintabahan_mmt_dtl req
         LEFT JOIN tpo_mmt_dtl pod ON pod.pod_mb_nomor = req.mbd_mb_nomor AND pod.pod_brg_kode = req.mbd_brg_kode
         WHERE req.mbd_mb_nomor = ? GROUP BY req.mbd_brg_kode`,
        [mbNomor]
      );
      let isAllFullyPoed = true;
      for (const sItem of statusRows) {
        await connection.query(`UPDATE tmintabahan_mmt_dtl SET mbd_qty_po = ? WHERE mbd_mb_nomor = ? AND mbd_brg_kode = ?`,
          [Number(sItem.Committed_PO_Qty), mbNomor, sItem.Kode]);
        if (Number(sItem.Committed_PO_Qty) < Number(sItem.Required_Qty)) isAllFullyPoed = false;
      }
      await connection.query(`UPDATE tmintabahan_mmt_hdr SET mb_close_po = ? WHERE mb_nomor = ?`, [isAllFullyPoed ? 1 : 0, mbNomor]);
    }

    await connection.commit();
    return { Nomor: poNomor };
  } catch (error) {
    await connection.rollback();
    throwDbError("Gagal menyimpan data PO", error);
  } finally {
    connection.release();
  }
};

const deletePoMmt = async (nomor) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT po_isclosed FROM tpo_mmt_hdr WHERE po_nomor = ?', [nomor]);
    if (rows.length === 0) return false;
    if (rows[0].po_isclosed === 1) throw new Error('PO sudah di-CLOSE dan tidak dapat dihapus.');
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

const toggleCloseStatus = async (nomor, action, user) => {
  const [result] = await pool.query(
    `UPDATE tpo_mmt_hdr SET po_isclosed = ?, user_modified = ? WHERE po_nomor = ?`,
    [action === 'CLOSE' ? 1 : 0, user, nomor]
  );
  if (result.affectedRows === 0) throw new Error('Nomor PO tidak ditemukan.');
  return true;
};

const loadMkbDetail = async (nomorMkb) => {
  const sql = `SELECT d.mkbd_bhn_kode AS kode, b.brg_nama AS nama, d.mkbd_bhn_satuan AS satuan,
      d.mkbd_jumlah_po AS jumlah, b.brg_hargabeli AS harga, 0 AS diskon, d.mkbd_spk_nomor AS spk, ? AS mkb
      FROM tmkb_dtl d LEFT JOIN tbarang_mmt b ON b.brg_kode = d.mkbd_bhn_kode WHERE d.mkbd_mkb_nomor = ?`;
  const [rows] = await pool.query(sql, [nomorMkb, nomorMkb]);
  if (rows.length === 0) throw new Error('MKB tidak ditemukan.');
  return { Detail: rows.map(i => ({ ...i, total: i.jumlah * i.harga, namaext: i.nama, roll: 0 })) };
};

const getPoDataForPrint = async (nomor) => {
  const poData = await getPOById(nomor);
  if (!poData) throw new Error("Data PO tidak ditemukan.");
  const [compRows] = await pool.query(`SELECT perush_nama, perush_alamat, perush_npwp FROM tperusahaan WHERE perush_kode = 'KP'`);
  const comp = compRows[0] || {};
  const subTotal = poData.Detail.reduce((sum, d) => sum + (d.total || 0), 0);
  const ppn = poData.IsPpn === 1 ? subTotal * ((poData.PpnRate || 11) / 100) : 0;

  return {
    Header: {
      Nomor: poData.Nomor, Tanggal: formatDateForPrint(poData.Tanggal), TglPengiriman: formatDateForPrint(poData.Dateline),
      KeteranganHeader: poData.Keterangan, IsPpn: poData.IsPpn, SubTotal: subTotal, TotalPpn: ppn, GrandTotal: subTotal + ppn,
      NamaSupplier: poData.SupNama, AlamatSupplier: poData.SupAlamat, KotaSupplier: poData.SupKota,
      NamaPerusahaan: comp.perush_nama || 'CV. KENCANA PRINT', AlamatPerusahaan: comp.perush_alamat, NPWPPerusahaan: comp.perush_npwp
    },
    Detail: poData.Detail.map(d => ({ NoUrut: d.no, Kode: d.kode, Deskripsi: d.namaext || d.nama, Quantity: d.jumlah, Satuan: d.satuan, UnitPrice: d.harga, Total: d.total }))
  };
};

const getUnfulfilledMbDetail = async (mbNomor) => {
  const sql = `SELECT req.mbd_brg_kode AS Kode, b.brg_nama AS Nama_Bahan, req.mbd_brg_satuan AS Satuan,
      req.mbd_spk_nomor AS Nomor_SPK, req.mbd_qty AS Required_Qty, req.mbd_qty_po AS Committed_PO_Qty,
      (req.mbd_qty - req.mbd_qty_po) AS Sisa_Qty_Diminta FROM tmintabahan_mmt_dtl req
      LEFT JOIN tbarang_mmt b ON req.mbd_brg_kode = b.brg_kode
      WHERE req.mbd_mb_nomor = ? AND (req.mbd_qty - COALESCE(req.mbd_qty_po, 0)) > 0 ORDER BY req.mbd_nourut`;
  const [rows] = await pool.query(sql, [mbNomor]);
  const [hRows] = await pool.query(`SELECT mb_memo FROM tmintabahan_mmt_hdr WHERE mb_nomor = ?`, [mbNomor]);
  return {
    Nomor: mbNomor, Keterangan: hRows[0]?.mb_memo || '',
    Detail: rows.map(item => ({ Kode: item.Kode, Nama_Bahan: item.Nama_Bahan, Satuan: item.Satuan, Nomor_SPK: item.Nomor_SPK, 
      Jumlah: parseFloat(item.Sisa_Qty_Diminta), Harga: 0, Diskon: 0, mb_nomor: mbNomor }))
  };
};

const getPOLookupData = async (keyword) => {
    try {
        let sql = `
            SELECT * FROM (
                SELECT 
                    h.po_nomor AS Nomor, 
                    DATE_FORMAT(h.po_tanggal, '%d-%m-%Y') AS Tanggal, 
                    h.po_sup_kode AS Supplier,
                    s.sup_nama AS NamaSupplier,
                    CASE
                        -- 1. Cek jika ditutup manual
                        WHEN h.po_isclosed = 1 THEN 'CLOSE'

                        -- 2. Cek jika SEMUA item sudah diterima penuh (Otomatis CLOSED)
                        WHEN NOT EXISTS (
                            SELECT 1 FROM tpo_mmt_dtl d 
                            WHERE d.pod_po_nomor = h.po_nomor 
                            AND d.pod_qty_terima < d.pod_qty
                        ) THEN 'CLOSED'

                        -- 3. Cek jika ada item yang mulai diterima (ONPROSES)
                        WHEN EXISTS (
                            SELECT 1 FROM tpo_mmt_dtl d 
                            WHERE d.pod_po_nomor = h.po_nomor 
                            AND d.pod_qty_terima > 0
                        ) THEN 'ONPROSES'

                        -- 4. Default OPEN
                        ELSE 'OPEN'
                    END AS Status
                FROM tpo_mmt_hdr h
                LEFT JOIN tsupplier s ON h.po_sup_kode = s.sup_kode
            ) AS LookupTable
            -- Hanya tampilkan yang masih bisa diproses (OPEN & ONPROSES)
            -- Status 'CLOSE' (manual) dan 'CLOSED' (penuh) tidak akan tampil
            WHERE Status IN ('OPEN', 'ONPROSES')
        `; 
        
        const params = [];
        
        if (keyword) {
            // Filter pencarian berdasarkan Nomor PO, Kode Supplier, atau Nama Supplier
            sql += ` AND (Nomor LIKE ? OR Supplier LIKE ? OR NamaSupplier LIKE ?)`;
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword, searchKeyword);
        }

        sql += ` ORDER BY Nomor DESC LIMIT 100`; 
        
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        // Pastikan fungsi throwDbError sudah didefinisikan di file service Anda
        throwDbError('Gagal mengambil data PO untuk lookup', error);
    }
};

const getPODetail = async (poNomor) => {
  try {
    const [hRows] = await pool.query(`SELECT po_nomor AS Nomor, DATE_FORMAT(po_tanggal, '%Y-%m-%d') AS Tanggal, po_sup_kode AS Kode_Supplier FROM tpo_mmt_hdr WHERE po_nomor = ?`, [poNomor]);
    if (hRows.length === 0) throw new Error(`Nomor PO ${poNomor} tidak ditemukan.`);
    const [dRows] = await pool.query(`SELECT D.pod_brg_kode AS SKU, B.brg_nama AS Nama_Bahan, D.pod_qty AS QTY_PO, B.brg_satuan AS Satuan, B.brg_panjang AS Panjang, B.brg_lebar AS Lebar
      FROM tpo_mmt_dtl D INNER JOIN tbarang_mmt B ON D.pod_brg_kode = B.brg_kode WHERE D.pod_po_nomor = ?`, [poNomor]);
    return { header: hRows[0], details: dRows };
  } catch (error) {
    throwDbError(`Gagal memuat detail PO ${poNomor}`, error);
  }
};

module.exports = {
  getPoMmtData, getPoDetailByNomor, getPoDataForPrint, getPOById, savePoMmt, deletePoMmt,
  toggleCloseStatus, loadMkbDetail, getUnfulfilledMbDetail, getPOLookupData, getPODetail
};