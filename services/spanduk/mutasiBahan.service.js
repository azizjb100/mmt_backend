const pool = require('../../config/db.config');

const { format } = require('date-fns'); // Tambahkan ini

const throwDbError = (message, error) => { 
    throw new Error(`${message}: ${error.message}`); 
};

exports.fetchMutasiBahan = async (startDate, endDate) => {
    try {
        const sqlMaster = `
            SELECT 
                bbk_nomor AS Nomor, bbk_tanggal AS Tanggal, bbk_keterangan AS Keterangan,
                b.gdg_nama AS Asal, c.gdg_nama AS Tujuan,
                IF(bbk_status_realisasi = 1, 'Sudah', 'Belum') AS Realisasi
            FROM tbbk_hdr a
            LEFT JOIN tgudang b ON b.gdg_kode = a.bbk_gdg_asal
            LEFT JOIN tgudang c ON c.gdg_kode = a.bbk_gdg_tujuan
            WHERE bbk_tanggal >= ? AND bbk_tanggal <= ?
            ORDER BY bbk_nomor, bbk_tanggal 
        `;

        const sqlDetail = `
            SELECT 
                bbkd_bbk_nomor AS Nomor, bbkd_bhn_kode AS Kode, bhn_name AS Nama,
                bhn_satuan AS Satuan, jb_nama AS Jenis, bbkd_jumlah AS Jumlah
            FROM tbbk_hdr
            INNER JOIN tbbk_dtl ON bbk_nomor = bbkd_bbk_nomor
            INNER JOIN tbahan ON bhn_kode = bbkd_bhn_kode
            INNER JOIN tjenisbarang ON jb_Kode = bhn_jb_kode
            WHERE bbk_tanggal >= ? AND bbk_tanggal <= ?
            ORDER BY bbkd_bbk_nomor, bbk_tanggal, bbkd_bhn_kode
        `;

        const [[masterResults], [detailResults]] = await Promise.all([
            pool.query(sqlMaster, [startDate, endDate]),
            pool.query(sqlDetail, [startDate, endDate])
        ]);

        if (masterResults.length === 0) return [];

        // Mapping Data Master-Detail
        const dataMap = new Map();
        masterResults.forEach(item => {
            if (item.Tanggal) item.Tanggal = format(new Date(item.Tanggal), 'yyyy-MM-dd');
            dataMap.set(item.Nomor, { ...item, Detail: [] });
        });

        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                dataMap.get(detail.Nomor).Detail.push(detail);
            }
        });

        return Array.from(dataMap.values());
    } catch (error) {
        throwDbError('Gagal mengambil data mutasi bahan di database', error);
    }
};

exports.fetchReportPenawaran = async (startDate, endDate, filterText = '') => {
    try {
        const escapedFilter = filterText ? `%${filterText}%` : '%';
        const sqlReport = `
            SELECT 
                ? AS FILTERfield, pen_nomor AS Nomor, perush_nama AS Perusahaan,
                DATE_FORMAT(pen_tanggal, '%d/%M/%Y') AS Tanggal,
                cus_nama AS \`Nama Customer\`, pen_keterangan AS Keterangan
            FROM tpenawaran_hdr 
            INNER JOIN tcustomer ON pen_cus_kode = cus_kode
            INNER JOIN tperusahaan ON perush_kode = pen_perush_kode
            WHERE pen_tanggal >= ? AND pen_tanggal <= ?
            ${filterText ? 'AND (pen_nomor LIKE ? OR cus_nama LIKE ?)' : ''}
        `;

        const queryParams = filterText 
            ? [filterText, startDate, endDate, escapedFilter, escapedFilter]
            : [filterText, startDate, endDate];

        const [results] = await pool.query(sqlReport, queryParams);
        return results;
    } catch (error) {
        throwDbError('Gagal mengambil laporan penawaran di database', error);
    }
};