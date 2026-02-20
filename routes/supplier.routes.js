const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplier.controller");
const verifyToken = require("../middleware/auth.middleware");

router.get("/", supplierController.getSuppliers);
router.get("/next-kode", supplierController.getNextSupplierKode);
router.get("/:kode", supplierController.getSupplierByKode);

router.post("/", verifyToken, supplierController.saveSupplier);
router.put(
    "/:kode",
    verifyToken,
    (req, _res, next) => {
        req.body = {
            ...(req.body || {}),
            Kode: req.params.kode,
            isEditMode: true,
        };
        next();
    },
    supplierController.saveSupplier,
);

router.post("/save", verifyToken, supplierController.saveSupplier);
router.put("/", verifyToken, supplierController.saveSupplier);

router.delete("/:kode", verifyToken, supplierController.deleteSupplier);

module.exports = router;
