const pool = require('../config/db.config');
const { format } = require('date-fns');

/**
 * Mengambil data laporan BS dari mesin digital (MMT) dan tekstil dengan filter dinamis
 */
const getLaporanBsData = async (filters) => {
    const { startDate, endDate, gdgKode, search, type } = filters;

    let paramsMesin = [startDate, endDate];
    let paramsTekstil = [startDate, endDate];

    // 1. Query BS dari LHK Mesin (MMT)
    let queryMesin = `
        SELECT 
            'MMT' AS Jenis_LHK,
            h.lnomor AS Nomor_LHK,
            DATE_FORMAT(h.ltanggal, '%Y-%m-%d') AS Tanggal,
            h.lgdg_prod AS Gdg_Kode,
            h.loperator AS Operator,
            h.lmesin AS Mesin,
            h.lbahan AS Brg_Kode,
            b.brg_nama AS Brg_Nama,
            h.lbarcode_roll AS Barcode,
            h.lpanjang_bs AS Panjang_BS,
            h.llebar_bs AS Lebar_BS,
            (h.lpanjang_bs * h.llebar_bs) AS Luas_BS_M2,
            h.lstatus AS Status
        FROM tlhk_mesin_hdr h
        LEFT JOIN tbarang_mmt b ON h.lbahan = b.brg_kode
        WHERE h.ltanggal BETWEEN ? AND ? 
          AND h.lpanjang_bs > 0
    `;

    if (gdgKode) {
        queryMesin += ` AND h.lgdg_prod = ?`;
        paramsMesin.push(gdgKode);
    }
    if (search) {
        queryMesin += ` AND (h.lnomor LIKE ? OR h.lbarcode_roll LIKE ? OR b.brg_nama LIKE ?)`;
        paramsMesin.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // 2. Query BS dari LHK Mesin Tekstil
    let queryTekstil = `
        SELECT 
            'TEKSTIL' AS Jenis_LHK,
            h.lth_nomor AS Nomor_LHK,
            DATE_FORMAT(h.lth_tanggal, '%Y-%m-%d') AS Tanggal,
            h.lth_gdg_prod AS Gdg_Kode,
            'SYSTEM' AS Operator, 
            'Mesin Tekstil' AS Mesin,
            h.lth_brg_kode AS Brg_Kode,
            b.brg_nama AS Brg_Nama,
            h.lth_barcode AS Barcode,
            h.lth_panjang_bs AS Panjang_BS,
            h.lth_lebar_bs AS Lebar_BS,
            (h.lth_panjang_bs * h.lth_lebar_bs) AS Luas_BS_M2,
            h.lth_status AS Status
        FROM tlhk_mesintekstil_hdr h
        LEFT JOIN tbarang_mmt b ON h.lth_brg_kode = b.brg_kode
        WHERE h.lth_tanggal BETWEEN ? AND ? 
          AND h.lth_panjang_bs > 0
    `;

    if (gdgKode) {
        queryTekstil += ` AND h.lth_gdg_prod = ?`;
        paramsTekstil.push(gdgKode);
    }
    if (search) {
        queryTekstil += ` AND (h.lth_nomor LIKE ? OR h.lth_barcode LIKE ? OR b.brg_nama LIKE ?)`;
        paramsTekstil.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    let rawData = [];

    // Eksekusi berdasarkan tipe filter yang dipilih frontend
    if (type === 'MMT') {
        const [rows] = await pool.query(`${queryMesin} ORDER BY h.ltanggal DESC, h.lnomor DESC`, paramsMesin);
        rawData = rows;
    } else if (type === 'TEKSTIL') {
        const [rows] = await pool.query(`${queryTekstil} ORDER BY h.lth_tanggal DESC, h.lth_nomor DESC`, paramsTekstil);
        rawData = rows;
    } else {
        // Gabungkan kedua data (Default / ALL)
        const [rowsMesin] = await pool.query(queryMesin, paramsMesin);
        const [rowsTekstil] = await pool.query(queryTekstil, paramsTekstil);
        
        rawData = [...rowsMesin, ...rowsTekstil].sort((a, b) => {
            return new Date(b.Tanggal).getTime() - new Date(a.Tanggal).getTime();
        });
    }

    // Hitung ringkasan total (Summary) untuk statistik widget/footer tabel
    const summary = rawData.reduce((acc, cur) => {
        acc.total_records += 1;
        acc.total_panjang += Number(cur.Panjang_BS || 0);
        acc.total_luas_m2 += Number(cur.Luas_BS_M2 || 0);
        return acc;
    }, { total_records: 0, total_panjang: 0, total_luas_m2: 0 });

    // Membulatkan nilai desimal hasil kalkulasi
    const formattedData = rawData.map(row => ({
        ...row,
        Panjang_BS: Number(Number(row.Panjang_BS).toFixed(2)),
        Lebar_BS: Number(Number(row.Lebar_BS).toFixed(2)),
        Luas_BS_M2: Number(Number(row.Luas_BS_M2).toFixed(2))
    }));

    return {
        summary,
        list: formattedData
    };
};

module.exports = {
    getLaporanBsData
};