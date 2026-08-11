// backend/src/controllers/poPaperprint.controller.js

const service = require("../services/poPaperprint.service.js");
const { format, startOfMonth } = require("date-fns");

// READ MASTER (Browse List)
const getPoPaperprint = async (req, res) => {
  const endDate = req.query.endDate || format(new Date(), "yyyy-MM-dd");
  const startDate =
    req.query.startDate || format(startOfMonth(new Date()), "yyyy-MM-dd");

  try {
    const data = await service.getPoPaperprintMaster(startDate, endDate);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// READ DETAIL (Expanded Row per Nomor)
const getPoPaperprintDetail = async (req, res) => {
  const nomor = req.query.nomor || req.params.nomor;
  try {
    const data = await service.getPoPaperprintDetail(nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// READ SINGLE PO (Header + Detail untuk Mode Edit / Print)
const getPoPaperprintByNomor = async (req, res) => {
  const { nomor } = req.params;
  try {
    const details = await service.getPoPaperprintDetail(nomor);
    // Ambil header dari master query dengan rentang tanggal luas
    const masterList = await service.getPoPaperprintMaster(
      "2000-01-01",
      "2099-12-31",
    );
    const header = masterList.find((h) => h.Nomor === nomor) || null;

    if (!header) {
      return res
        .status(404)
        .json({ message: "PO Paperprint tidak ditemukan." });
    }

    res.json({ header, details });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GENERATE MAX NOMOR OTOMATIS
const getMaxNomor = async (req, res) => {
  const { tanggal } = req.query;
  try {
    const nomor = await service.generateMaxNomor(tanggal);
    res.json({ success: true, nomor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// CREATE (Simpan Transaksi Baru)
const createPoPaperprint = async (req, res) => {
  try {
    // Parsing otomatis jika dikirim via FormData (String) atau JSON
    const header =
      typeof req.body.header === "string"
        ? JSON.parse(req.body.header)
        : req.body.header;

    const details =
      typeof req.body.details === "string"
        ? JSON.parse(req.body.details)
        : req.body.details;

    const kdUser = req.body.kdUser || "ADMIN";

    const result = await service.createPoPaperprint(
      { header, details },
      kdUser,
    );
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE (Edit Transaksi)
const updatePoPaperprint = async (req, res) => {
  const { nomor } = req.params;
  try {
    const header =
      typeof req.body.header === "string"
        ? JSON.parse(req.body.header)
        : req.body.header;

    const details =
      typeof req.body.details === "string"
        ? JSON.parse(req.body.details)
        : req.body.details;

    const kdUser = req.body.kdUser || "ADMIN";

    const result = await service.updatePoPaperprint(
      nomor,
      { header, details },
      kdUser,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE (Hapus Transaksi)
const deletePoPaperprint = async (req, res) => {
  const { nomor } = req.params;
  try {
    await service.deletePoPaperprint(nomor);
    res.status(200).json({ message: "PO Paperprint berhasil dihapus." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getPoPaperprint,
  getPoPaperprintDetail,
  getPoPaperprintByNomor,
  getMaxNomor,
  createPoPaperprint,
  updatePoPaperprint,
  deletePoPaperprint,
};
