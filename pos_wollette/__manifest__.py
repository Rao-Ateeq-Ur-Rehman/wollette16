# Copyright (C) 2024 - Today: Wollette (https://www.wollette.com)

{
    "name": "Wollette Smart POS",
    "version": "16.6.0.0.0",
    "author": "Wollette Ltd",
    "category": "Point Of Sale",
    "license": "Other proprietary",
    "depends": ["point_of_sale", "sale"],
    "maintainers": ["wollette-ltd"],
    "development_status": "Production/Stable",
    "website": "https://www.wollette.com",
    "data": [
        "views/res_config_settings_views.xml",
    ],
    "assets": {
        "point_of_sale.assets": [
            "pos_wollette/static/src/css/pos.css",
            #"pos_wollette/static/src/xml/ScanQRButton.xml",
            "pos_wollette/static/src/xml/ScanQRPopup.xml",
            "pos_wollette/static/src/xml/PaymentScreen.xml",
            "pos_wollette/static/src/lib/html5-qrcode-2.3.8.min.js",
            "pos_wollette/static/src/js/models.js",
            "pos_wollette/static/src/js/ProductScreen.js",
            "pos_wollette/static/src/js/PaymentScreen.js",
            #"pos_wollette/static/src/js/ScanQRButton.js",
            "pos_wollette/static/src/js/ScanQRPopup.js",
        ],
    },
    "installable": True,
    "images": ['pos_wollette/static/description/main_screenshot.png'],
}
