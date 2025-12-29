const service = require('../services/recreateBarcode.service');

exports.generate = async (req, res) => {
    try {
        const result = await service.createManualBarcode(req.body, 'SYSTEM');
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};