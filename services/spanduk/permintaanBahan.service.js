const pool = require('../../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => { 
    throw new Error(`${message}: ${error.message}`); 
};

/**
 * Controller / Service untuk mengambil data Permintaan Garmen (Browse Minta Garmen)
 * @param {string} startDate - Tanggal mulai (format: YYYY-MM-DD)
 * @param {string} endDate - Tanggal akhir (format: YYYY-MM-DD)
 * @param {string} jenis - Jenis Garmen ('ACCESORIES', 'OBAT', 'SPAREPART', 'ATK/RTK')
 * @param {string} cab - Kode cabang ('ALL', 'P01', 'P02', dst)
 */
exports.fetchPermintaanGarmen = async (startDate, endDate, jenis = 'ACCESORIES', cab = 'ALL') => {
    try {
        // --- 1. MEMBUAT QUERY MASTER SECARA DINAMIS ---
        let sqlMaster = `
            SELECT 
                x.Nomor, x.Jenis, x.Tanggal, x.Jam, x.Cab, x.GdgPeminta,
        `;
        
        // Kondisi kolom opsional berdasarkan jenis barang (seperti kode Delphi asli)
        if (jenis === 'ACCESORIES') {
            sqlMaster += ` v.Divisi, x.SPK, x.NamaSpk, x.JmlSpk, x.Keterangan, `;
        } else if (jenis === 'SPAREPART') {
            sqlMaster += ` x.Bagian, `;
        }
        
        sqlMaster += `
                x.sts AS Status,
                x.AlasanClose,
                IF(x.totr = 0, '', IF(x.totr > x.tota, 'N', 'Y')) AS Approve,
                x.Usr,
                IFNULL((
                    SELECT
                        IF(pin_acc = '' AND pin_dipakai = '', 'WAIT',
                        IF(pin_acc = 'Y' AND pin_dipakai = '', 'ACC',
                        IF(pin_acc = 'Y' AND pin_dipakai = 'Y', '',
                        IF(pin_acc = 'N', 'TOLAK', ''))))
                    FROM tspk_pin5 
                    WHERE pin_trs = 'PERMINTAAN GARMEN' AND pin_nomor = x.Nomor 
                    ORDER BY pin_urut DESC LIMIT 1
                ), '') AS Ngedit
            FROM (
                SELECT 
                    h.min_jenis AS Jenis, h.min_nomor AS Nomor, h.min_tanggal AS Tanggal, 
                    DATE_FORMAT(h.date_create, '%H:%i:%s') AS Jam, h.min_cab AS Cab, h.min_spk_nomor AS SPK, 
                    IFNULL(s.spk_divisi, m.mspk_divisi) AS kddiv,
                    IF(h.min_gp = '', p.pab_nama, RIGHT(g.gdgp_nama, LENGTH(g.gdgp_nama) - 6)) AS GdgPeminta,
                    IFNULL(s.spk_nama, m.Mspk_nama) AS NamaSpk, IFNULL(s.spk_jumlah, 0) AS JmlSpk, 
                    h.min_ket AS Keterangan, h.min_bagian AS Bagian, h.user_create AS usr,
                    IF(h.min_close = 0, 'OPEN', IF(h.min_close = 1, 'CLOSE', IF(h.min_close = 9, 'DICLOSE', 'PROSES'))) AS sts,
                    h.min_alasanclose AS AlasanClose,
                    IFNULL((SELECT COUNT(*) FROM tgarmenrealisasi_hdr q WHERE q.re_minta = h.min_nomor), 0) AS totr,
                    IFNULL((SELECT COUNT(*) FROM tgarmenrealisasi_hdr q WHERE q.re_minta = h.min_nomor AND q.re_apv IS NOT NULL), 0) AS tota
                FROM tgarmenminta_hdr h
                LEFT JOIN tgudangproduksi g ON g.gdgp_kode = h.min_gp
                LEFT JOIN tspk s ON s.spk_nomor = h.min_spk_nomor
                LEFT JOIN tmemospk m ON m.mspk_nomor = h.min_spk_nomor
                LEFT JOIN tpabrik p ON p.pab_kode = h.min_cab
                WHERE h.min_tanggal >= ? AND h.min_tanggal <= ?
                  AND h.min_jenis = ?
        `;

        const masterParams = [startDate, endDate, jenis];
        
        // Filter Cabang jika bukan 'ALL'
        if (cab !== 'ALL') {
            sqlMaster += ` AND h.min_cab = ? `;
            masterParams.push(cab);
        }

        sqlMaster += `
                ORDER BY h.min_nomor
            ) x 
            LEFT JOIN tdivisi v ON v.kode = x.kddiv
        `;


        // --- 2. MEMBUAT QUERY DETAIL SECARA DINAMIS ---
        let sqlDetail = `
            SELECT 
                d.mind_nomor AS Nomor, d.mind_brg_kode AS Kode, 
                IF(b.brg_note = '', b.brg_nama, CONCAT(b.brg_nama, ' - ', b.brg_note)) AS Nama, 
                b.brg_satuan AS Satuan, d.mind_jumlah AS Jumlah,
                IFNULL((
                    SELECT SUM(i.red_jumlah) 
                    FROM tgarmenrealisasi_dtl i 
                    INNER JOIN tgarmenrealisasi_hdr j ON j.re_nomor = i.red_nomor 
                    WHERE j.re_minta = h.min_nomor AND i.red_brg_kode = d.mind_brg_kode
                ), 0) AS Realisasi,
                d.mind_ket AS Keterangan
            FROM tgarmenminta_hdr h
            INNER JOIN tgarmenminta_dtl d ON d.mind_nomor = h.min_nomor
            LEFT JOIN tgarmen_brg b ON b.brg_kode = d.mind_brg_kode
            WHERE h.min_tanggal >= ? AND h.min_tanggal <= ?
              AND h.min_jenis = ?
        `;

        const detailParams = [startDate, endDate, jenis];

        if (cab !== 'ALL') {
            sqlDetail += ` AND h.min_cab = ? `;
            detailParams.push(cab);
        }

        sqlDetail += ` ORDER BY h.min_nomor `;


        // --- 3. EKSEKUSI PARALEL DATABASE ---
        const [[masterResults], [detailResults]] = await Promise.all([
            pool.query(sqlMaster, masterParams),
            pool.query(sqlDetail, detailParams)
        ]);

        if (masterResults.length === 0) return [];

        // --- 4. MAPPING DATA MASTER-DETAIL ---
        const dataMap = new Map();
        
        // Mempersiapkan struktur object master
        masterResults.forEach(item => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd');
            dataMap.set(item.Nomor, { ...item, Detail: [] });
        });

        // Memasukkan array detail ke dalam object master yang cocok berdasarkan 'Nomor'
        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                dataMap.get(detail.Nomor).Detail.push(detail);
            }
        });

        return Array.from(dataMap.values());

    } catch (error) {
        throwDbError('Gagal mengambil data permintaan garmen di database', error);
    }
};
