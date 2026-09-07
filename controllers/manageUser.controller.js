const userService = require("../services/user.service");

const browse = async (req, res) => {
  try {
    const data = await userService.getUserBrowse();
    res.json(data);
  } catch (error) {
    console.error("ERROR API USER BROWSE:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAkses = async (req, res) => {
  try {
    const { kode } = req.params;
    const data = await userService.getUserAksesByCode(kode);

    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }

    res.json({ success: true, ...data });
  } catch (error) {
    console.error("ERROR API GET USER AKSES:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const saveAkses = async (req, res) => {
  try {
    const { kode } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res
        .status(400)
        .json({ success: false, message: "Format permissions tidak valid" });
    }

    const result = await userService.saveUserAkses(kode, permissions);
    res.json(result);
  } catch (error) {
    console.error("ERROR API SAVE USER AKSES:", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  browse,
  getAkses,
  saveAkses,
};
