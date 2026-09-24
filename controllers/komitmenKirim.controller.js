const service = require("../services/komitmenkirim.service");

const getBrowse = async (req, res) => {
  try {
    const { startDate, endDate, cabang } = req.query;
    const data = await service.getBrowse(startDate, endDate, cabang || "");
    res.json({ success: true, data });
  } catch (e) {
    console.error("getBrowse komitmenKirim", e);
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDetail = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await service.getDetail(nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getFormDetail = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await service.getFormDetail(nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getCabang = async (req, res) => {
  try {
    const data = await service.getCabangOptions();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getDivisi = async (req, res) => {
  try {
    const data = await service.getDivisiOptions();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const toggleClose = async (req, res) => {
  try {
    const { nomor } = req.params;
    const { isClose } = req.body;
    await service.toggleClose(nomor, isClose);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const deleteData = async (req, res) => {
  try {
    const { nomor } = req.params;
    await service.deleteData(nomor);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getPencapaian = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await service.getPencapaian(nomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const savePencapaian = async (req, res) => {
  try {
    const { nomor } = req.params;
    await service.savePencapaian(nomor, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const getUnnotifiedMap = async (req, res) => {
  try {
    const userKode = req.user?.kode || req.user?.user_kode || "";
    const data = await service.getUnnotifiedMap(userKode);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const markMapNotified = async (req, res) => {
  try {
    const { ids } = req.body;
    const userKode = req.user?.kode || "";
    await service.markMapNotified(ids, userKode);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const createHeader = async (req, res) => {
  try {
    const userKode = req.user?.kode || "SYSTEM";
    const userBagian = req.user?.bagian || "";
    const data = await service.createHeader(req.body, userKode, userBagian);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const updateHeaderField = async (req, res) => {
  try {
    const { nomor } = req.params;
    const { field, value } = req.body;
    const userKode = req.user?.kode || "SYSTEM";
    const userBagian = req.user?.bagian || "";
    await service.updateHeaderField(nomor, field, value, userKode, userBagian);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const searchKandidatSo = async (req, res) => {
  try {
    const data = await service.searchSoKandidat(req.query);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchKandidatPraOrder = async (req, res) => {
  try {
    const data = await service.searchPraOrderKandidat(req.query);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const searchKandidatMap = async (req, res) => {
  try {
    const data = await service.searchMapKandidat(req.query);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getSoInfo = async (req, res) => {
  try {
    const { soNomor, divisi, excludeNomor } = req.query;
    const data = await service.getSoInfo(soNomor, divisi, excludeNomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getMapInfo = async (req, res) => {
  try {
    const data = await service.getMapInfo(req.query);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getMhInfo = async (req, res) => {
  try {
    const { mhNomor, divisi, excludeNomor } = req.query;
    const data = await service.getMhInfo(mhNomor, divisi, excludeNomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const getPenawaranDetailList = async (req, res) => {
  try {
    const { penNomor } = req.query;
    const data = await service.getPenawaranDetailList(penNomor);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

const getPenawaranItemInfo = async (req, res) => {
  try {
    const data = await service.getPenawaranItemInfo(req.query);
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: e.message });
  }
};

const addDetailRow = async (req, res) => {
  try {
    const { pjwNomor } = req.params;
    const userKode = req.user?.kode || "SYSTEM";
    const userBagian = req.user?.bagian || "";
    const data = await service.addDetailRow(pjwNomor, req.body, userKode, userBagian);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const updateDetailField = async (req, res) => {
  try {
    const { pjwdId } = req.params;
    const { field, value } = req.body;
    const userKode = req.user?.kode || "SYSTEM";
    const userBagian = req.user?.bagian || "";
    await service.updateDetailField(pjwdId, field, value, userKode, userBagian);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const deleteDetailRow = async (req, res) => {
  try {
    const { pjwdId } = req.params;
    const userKode = req.user?.kode || "SYSTEM";
    const userBagian = req.user?.bagian || "";
    await service.deleteDetailRow(pjwdId, userKode, userBagian);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const checkTargetPeriod = async (req, res) => {
  try {
    const { pjwdId, tanggal } = req.query;
    const data = await service.checkTargetPeriod(pjwdId, tanggal);
    res.json({ success: true, data });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

const moveDetailRow = async (req, res) => {
  try {
    const { pjwdId } = req.params;
    const { targetPjwNomor } = req.body;
    const userKode = req.user?.kode || "SYSTEM";
    const userBagian = req.user?.bagian || "";
    await service.moveDetailRowToPeriod(pjwdId, targetPjwNomor, userKode, userBagian);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = {
  getBrowse,
  getDetail,
  getFormDetail,
  getCabang,
  getDivisi,
  toggleClose,
  deleteData,
  getPencapaian,
  savePencapaian,
  getUnnotifiedMap,
  markMapNotified,
  createHeader,
  updateHeaderField,
  searchKandidatSo,
  searchKandidatPraOrder,
  searchKandidatMap,
  getSoInfo,
  getMapInfo,
  getMhInfo,
  getPenawaranDetailList,
  getPenawaranItemInfo,
  addDetailRow,
  updateDetailField,
  deleteDetailRow,
  checkTargetPeriod,
  moveDetailRow,
};
