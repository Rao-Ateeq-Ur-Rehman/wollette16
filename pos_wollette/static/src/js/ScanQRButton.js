odoo.define("point_of_sale.ScanQRButton", function (require) {
    "use strict";

    const PosComponent = require("point_of_sale.PosComponent");
    const ProductScreen = require("point_of_sale.ProductScreen");
    const Registries = require("point_of_sale.Registries");

    class ScanQRButton extends PosComponent {
        async onClick() {
            await this.showPopup("ScanQRPopup");
        }
    }

    ScanQRButton.template = "pos_wollette.ScanQRButton";

    ProductScreen.addControlButton({
        component: ScanQRButton,
        condition: function () {
            return (
                1 == 1
            );
        },
    });

    Registries.Component.add(ScanQRButton);
});
