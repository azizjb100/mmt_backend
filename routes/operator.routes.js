// backend/src/routes/operatorMmt.routes.js

const express = require('express');
const router = express.Router();
const controller = require('../controllers/operator.controller.js');
 

// GET /api/mmt/operator/browse (btnRefreshClick)
router.get(`/`, controller.getOperators);

// GET /api/mmt/operator/:kode (untuk Edit)
router.get(`/:kode`, controller.getOperatorByKode);

// POST /api/mmt/operator/save (New/Edit Save)
router.post(`/save`, controller.saveOperator);

// DELETE /api/mmt/operator/:kode (cxButton4Click)
router.delete(`/:kode`, controller.deleteOperator);

module.exports = router;