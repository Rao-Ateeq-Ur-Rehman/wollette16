
odoo.define("pos_wollette.ProductScreen", function (require) {
    "use strict";

    const ProductScreen = require("point_of_sale.ProductScreen");
    const Registries = require("point_of_sale.Registries");

    const PosWolletteProductScreen = (ProductScreen) =>
        class extends ProductScreen {
            /**
             * @override
             */
            _setValue(val) {
                console.log('in overridden _setValue');
                console.log(val);
                const res = super._setValue(...arguments);
                /* const selectedLine = this.currentOrder.get_selected_orderline();
                console.log(selectedLine);
                if (val != 'remove' && selectedLine && !selectedLine.promotion) {
                    if (this.env.pos.numpadMode === 'quantity' || this.env.pos.numpadMode === 'price') {
                        selectedLine.apply_coupons();
                    }
                } */
                return res;
            }
        };

    Registries.Component.extend(ProductScreen, PosWolletteProductScreen);
    return ProductScreen;
});