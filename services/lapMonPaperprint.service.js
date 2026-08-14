const pool = require("../config/db.config");
const moment = require("moment");

const lapMonCetakPaperprint = async (startDate, endDate) => {
  const tglMulai = moment(startDate).format("YYYY-MM-DD");
  const tglSelesai = moment(endDate).add(1, "day").format("YYYY-MM-DD");

  const ssql = `
    SELECT
        /* =====================================================
           DATA SPK
        ===================================================== */
        spk.spk_perush_kode AS PERUSH,
        spk.spk_nomor AS NO_SPK,
        spk.spk_nama AS NAMA_ORDER,
        spk.spk_jumlah AS ORDER_SPK_PCS,
        
        /* PANJANG DAN LEBAR DARI tlhk_sublim_dtl */
        COALESCE(lhk.PANJANG, 0) AS PANJANG,
        COALESCE(lhk.LEBAR, 0) AS LEBAR,

        DATE_FORMAT(spk.spk_tanggal, '%Y-%m-%d') AS TGL_SPK,
        DATE_FORMAT(spk.spk_dateline, '%Y-%m-%d') AS DEADLINE,

        /* =====================================================
           DATA LHK
        ===================================================== */
        COALESCE(lhk.NO_LHK, '-') AS NO_LHK,
        CASE
            WHEN lhk.TANGGAL_LHK IS NULL THEN '-'
            ELSE DATE_FORMAT(lhk.TANGGAL_LHK, '%Y-%m-%d')
        END AS TANGGAL_LHK,

        /* =====================================================
           ORDER METER
        ===================================================== */
        (
            COALESCE(spk.spk_jumlah, 0)
            * COALESCE(spk.spk_panjang, 0)
            * COALESCE(spk.spk_lebar, 0)
        ) AS ORDER_SPK_METER,

        /* =====================================================
           KURANG VARIANT
        ===================================================== */
        (
            COALESCE(spk.spk_jumlah, 0)
            - (COALESCE(lhk.JUMLAH_PCS, 0) + COALESCE(ext.CETAK_LUAR, 0))
        ) AS KURANG_VARIANT,

        /* CETAK LUAR */
        COALESCE(ext.CETAK_LUAR, 0) AS CETAK_LUAR,

        /* PCS PER MESIN */
        COALESCE(lhk.PCS_SB01, 0) AS PCS_SB01,
        COALESCE(lhk.PCS_SB02, 0) AS PCS_SB02,
        COALESCE(lhk.PCS_SB03, 0) AS PCS_SB03,
        COALESCE(lhk.PCS_SB04, 0) AS PCS_SB04,
        COALESCE(lhk.PCS_SB05, 0) AS PCS_SB05,
        COALESCE(lhk.JUMLAH_PCS, 0) AS JUMLAH_PCS,

        /* METER PER MESIN (Hasil perhitungan perkalian PANJANG * LEBAR * JUMLAH) */
        COALESCE(lhk.METER_SB01, 0) AS METER_SB01,
        COALESCE(lhk.METER_SB02, 0) AS METER_SB02,
        COALESCE(lhk.METER_SB03, 0) AS METER_SB03,
        COALESCE(lhk.METER_SB04, 0) AS METER_SB04,
        COALESCE(lhk.METER_SB05, 0) AS METER_SB05,
        COALESCE(lhk.JUMLAH_METER, 0) AS JUMLAH_METER

    FROM tspk spk

    /* =========================================================
       LHK SUBLIM
    ========================================================= */
    LEFT JOIN (
        SELECT
            d.lsbd_spk_nomor AS NOMOR_SPK,

            /* PANJANG & LEBAR DARI tlhk_sublim_dtl */
            MAX(COALESCE(d.lsbd_panjang, 0)) AS PANJANG,
            MAX(COALESCE(d.lsbd_lebar, 0)) AS LEBAR,

            /* NOMOR & TANGGAL LHK */
            MAX(h.lsb_nomor) AS NO_LHK,
            MAX(h.lsb_tanggal) AS TANGGAL_LHK,

            /* TOTAL PCS */
            SUM(COALESCE(d.lsbd_jumlah, 0)) AS JUMLAH_PCS,

            /* TOTAL METER = SUM( PANJANG * LEBAR * JUMLAH_PCS ) */
            SUM(
                COALESCE(d.lsbd_panjang, 0) 
                * COALESCE(d.lsbd_lebar, 0) 
                * COALESCE(d.lsbd_jumlah, 0)
            ) AS JUMLAH_METER,

            /* PCS PER MESIN */
            SUM(CASE WHEN TRIM(d.lsbd_lokasi) = 'SB01' THEN COALESCE(d.lsbd_jumlah, 0) ELSE 0 END) AS PCS_SB01,
            SUM(CASE WHEN TRIM(d.lsbd_lokasi) = 'SB02' THEN COALESCE(d.lsbd_jumlah, 0) ELSE 0 END) AS PCS_SB02,
            SUM(CASE WHEN TRIM(d.lsbd_lokasi) = 'SB03' THEN COALESCE(d.lsbd_jumlah, 0) ELSE 0 END) AS PCS_SB03,
            SUM(CASE WHEN TRIM(d.lsbd_lokasi) = 'SB04' THEN COALESCE(d.lsbd_jumlah, 0) ELSE 0 END) AS PCS_SB04,
            SUM(CASE WHEN TRIM(d.lsbd_lokasi) = 'SB05' THEN COALESCE(d.lsbd_jumlah, 0) ELSE 0 END) AS PCS_SB05,

            /* METER PER MESIN = SUM( PANJANG * LEBAR * JUMLAH_PCS ) PER MESIN */
            SUM(
                CASE 
                    WHEN TRIM(d.lsbd_lokasi) = 'SB01' 
                    THEN (COALESCE(d.lsbd_panjang, 0) * COALESCE(d.lsbd_lebar, 0) * COALESCE(d.lsbd_jumlah, 0))
                    ELSE 0 
                END
            ) AS METER_SB01,

            SUM(
                CASE 
                    WHEN TRIM(d.lsbd_lokasi) = 'SB02' 
                    THEN (COALESCE(d.lsbd_panjang, 0) * COALESCE(d.lsbd_lebar, 0) * COALESCE(d.lsbd_jumlah, 0))
                    ELSE 0 
                END
            ) AS METER_SB02,

            SUM(
                CASE 
                    WHEN TRIM(d.lsbd_lokasi) = 'SB03' 
                    THEN (COALESCE(d.lsbd_panjang, 0) * COALESCE(d.lsbd_lebar, 0) * COALESCE(d.lsbd_jumlah, 0))
                    ELSE 0 
                END
            ) AS METER_SB03,

            SUM(
                CASE 
                    WHEN TRIM(d.lsbd_lokasi) = 'SB04' 
                    THEN (COALESCE(d.lsbd_panjang, 0) * COALESCE(d.lsbd_lebar, 0) * COALESCE(d.lsbd_jumlah, 0))
                    ELSE 0 
                END
            ) AS METER_SB04,

            SUM(
                CASE 
                    WHEN TRIM(d.lsbd_lokasi) = 'SB05' 
                    THEN (COALESCE(d.lsbd_panjang, 0) * COALESCE(d.lsbd_lebar, 0) * COALESCE(d.lsbd_jumlah, 0))
                    ELSE 0 
                END
            ) AS METER_SB05

        FROM tlhk_sublim_dtl d
        INNER JOIN tlhk_sublim_hdr h
            ON TRIM(h.lsb_nomor) = TRIM(d.lsbd_lsb_nomor)
        GROUP BY
            d.lsbd_spk_nomor
    ) lhk
        ON TRIM(lhk.NOMOR_SPK) = TRIM(spk.spk_nomor)

    /* =========================================================
       CETAK LUAR
    ========================================================= */
    LEFT JOIN (
        SELECT
            poe_spk_nomor,
            SUM(COALESCE(poe_jumlah, 0)) AS CETAK_LUAR
        FROM tpoexternal_hdr
        WHERE poe_cab = 'P05'
        GROUP BY poe_spk_nomor
    ) ext
        ON TRIM(ext.poe_spk_nomor) = TRIM(spk.spk_nomor)

    /* FILTER & ORDERING */
    WHERE spk.spk_aktif = 'Y'
      AND lhk.TANGGAL_LHK >= ?
      AND lhk.TANGGAL_LHK < ?
    ORDER BY
        lhk.TANGGAL_LHK ASC,
        spk.spk_nomor ASC
  `;

  const params = [`${tglMulai} 00:00:00`, `${tglSelesai} 00:00:00`];
  const connection = await pool.getConnection();

  try {
    const [rows] = await connection.execute(ssql, params);
    return rows;
  } catch (error) {
    console.error("Error lapMonCetakPaperprint:", error);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  lapMonCetakPaperprint,
};
