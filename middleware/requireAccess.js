// middleware/requireAccess.js
// Factory middleware untuk membatasi akses route berdasarkan data user di JWT.
// Contoh pemakaian:
//   router.get("/lmkp", verifyToken, requireAccess({ divisi: [1], cab: ["P05"] }), controller.getLaporan);

const requireAccess = (rule = {}) => {
  const allowedDivisi = Array.isArray(rule.divisi)
    ? rule.divisi.map((d) => Number(d))
    : null;
  const allowedCab = Array.isArray(rule.cab)
    ? rule.cab.map((c) => String(c).toUpperCase())
    : null;

  return (req, res, next) => {
    const user = req.user || {};

    // Normalisasi (data dari DB bisa berupa string atau number)
    const divisi = Number(user.divisi);
    const cab = String(user.cab || "").toUpperCase();

    if (allowedDivisi && !allowedDivisi.includes(divisi)) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak: Anda tidak berhak membuka resource ini.",
      });
    }

    if (allowedCab && !allowedCab.includes(cab)) {
      return res.status(403).json({
        success: false,
        message: "Akses ditolak: Anda tidak berhak membuka resource ini.",
      });
    }

    return next();
  };
};

module.exports = requireAccess;
