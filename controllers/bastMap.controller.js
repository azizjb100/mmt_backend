const bastMapService = require("../services/bastMap.service");

// --- GET BROWSE LIST ---
const getBrowseList = async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      onProgressOnly: req.query.onProgress,
      search: req.query.search, // Jika ingin dipakai tambahan filter search di backend
    };

    // Ambil informasi cabang user dari token/middleware auth (misal: req.user.cabang)
    const userCabang = req.user?.cabang || "ALL";

    const data = await bastMapService.getBrowseList(filters, userCabang);

    return res.status(200).json({
      status: true,
      message: "Berhasil mengambil data browse BAST MAP",
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

// --- DELETE BAST ---
const deleteBast = async (req, res, next) => {
  try {
    const { nomor } = req.params;
    const userKode = req.user?.kode || "SYSTEM";

    await bastMapService.deleteBast(nomor, userKode);

    return res.status(200).json({
      status: true,
      message: `BAST MAP dengan nomor ${nomor} berhasil dihapus.`,
    });
  } catch (error) {
    next(error);
  }
};

// --- GET EXPORT DETAIL ---
const getExportDetail = async (req, res, next) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      onProgressOnly: req.query.onProgress,
      search: req.query.search,
    };

    const userCabang = req.user?.cabang || "ALL";

    const data = await bastMapService.getExportDetail(filters, userCabang);

    return res.status(200).json({
      status: true,
      message: "Berhasil mengambil data export detail BAST MAP",
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBrowseList,
  deleteBast,
  getExportDetail,
};
