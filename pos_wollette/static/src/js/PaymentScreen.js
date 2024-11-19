
odoo.define("pos_wollette.PaymentScreen", function (require) {
  "use strict";

  const PaymentScreen = require("point_of_sale.PaymentScreen");
  const Registries = require("point_of_sale.Registries");
  const { onMounted } = owl;

  const PosWollettePaymentScreen = (OriginalPaymentScreen) =>
    class extends OriginalPaymentScreen {

      /**
       * @override
       */
      setup() {
        super.setup();
        onMounted(() => {
          this.showPopup("ScanQRPopup");
        });
      }

      async back(data = {}) {
        console.log('in pos_wollette PaymentScreen back method');
        const order = this.env.pos.get_order();

        console.log('Back Order: ', order);

        if (order.wollette_code) {
            console.log('order.wollette_code: ', order.wollette_code);
          const session_id = this.env.pos.pos_session.id;
          await this.rpc({
            model: 'pos.session',
            method: 'post_cancel_staged_transactions',
            args: [[session_id]],
            kwargs: {
              code: order.wollette_code,
              order_id: order.name,
            }
          });
          //clear the order points if applicable
          //clear the order parties_id
          order.setPartyId(null);
          //clear the order coupons
          order.setOutstandingCoupons([]);
          //clear the wollette code
          order.setWolletteCode(null);
          //delete promotion lines
          var lines_to_delete = _.filter(order.get_orderlines(), function (line) {
            return line.promotion;
          });
          console.log('lines_to_delete');
          console.log(lines_to_delete);
          _.each(lines_to_delete, function (line) {
            order.remove_orderline(line);
          });
        }
        return this.showScreen('ProductScreen', data);
      }

    };

  Registries.Component.extend(PaymentScreen, PosWollettePaymentScreen);
  return PaymentScreen;
});