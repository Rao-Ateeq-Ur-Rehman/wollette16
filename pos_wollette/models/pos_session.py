import logging, requests, json, time
from odoo import api, fields, models, exceptions, _

_logger = logging.getLogger(__name__)


class PosSession(models.Model):
    _inherit = 'pos.session'

    base_url = fields.Char(related='config_id.pos_api_base_url')
    pos_discount_product_id = fields.Many2one('product.product', related='config_id.pos_discount_product_id')
    pos_api_base_url = fields.Char(related='config_id.pos_api_base_url', help='Base URL for Wollette API')
    pos_database_id = fields.Char(related='config_id.pos_database_id')
    pos_shop_name = fields.Char(related='config_id.pos_shop_name')

    def get_base_params(self):
        self.ensure_one()
        return {
            'databaseId': self.pos_database_id,
            'shopName': self.pos_shop_name,
            'provider': 'Odoo',
        }

    def get_staged_transactions(self, code, order_id):
        self.ensure_one()
        payload = self.get_base_params()
        payload.update({
            'code': code,
            'orderId': order_id,
            'event': 'ODOO_STAGING',
        })
        print('payload: ', payload)
        print('self.pos_api_base_url: ', self.pos_api_base_url)
        res = requests.post(f'{self.pos_api_base_url}staged-transactions', params=payload, json={})
        print('res.url: ', res.url)
        print('self.pos_api_base_url: ', self.pos_api_base_url)
        print('res.json(): ', res.json())
        if not res.ok:
            raise exceptions.ValidationError(_(res.text or res.reason))
        else:
            return res.json()

    def post_parties_staged_transactions(self, party_id, payments, spent_coupon_ids, spent_points, order_id):
        print('post_parties_staged_transactions')
        self.ensure_one()
        payload = self.get_base_params()
        payload.update({
            'event': 'ODOO_UPDATE',
            'orderId': order_id,
        })
        print('post_parties_staged_transactions payload: ', payload)
        json_data = {
            'partyId': party_id if party_id else None,
            'payments': payments,
            'spentCouponIds': spent_coupon_ids,
            'spentPoints': spent_points,
        }
        print('post_parties_staged_transactions json_data: ', json_data)

        # res = requests.patch(f'{self.pos_api_base_url}staged-transactions', params=payload, json=json_data)
        res = requests.patch(f'{self.pos_api_base_url}staged-transactions/parties', params=payload, json=json_data)
        if not res.ok:
            print('error calling cancellation endpoint: %s', _(res.text or res.reason))
            raise exceptions.ValidationError(_(res.text or res.reason))
        else:
            return res.json()

    def post_completed_staged_transactions(self, order):
        print('post_completed_staged_transactions')
        self.ensure_one()
        payload = self.get_base_params()
        payload.update({
            'event': 'ODOO_COMPLETION',
            'orderId': order.pos_reference,
        })
        json_data = order.export_for_wollette()
        print('Order payload: ', payload)
        # res = requests.post(f'{self.pos_api_base_url}staged-transactions/', params=payload, json=json_data)
        print('json_data: ', json_data)
        res = requests.post(f'{self.pos_api_base_url}staged-transactions/completion', params=payload, json=json_data)
        if not res.ok:
            print('error calling completion api: ', res.text or res.reason )
            raise exceptions.ValidationError(_(res.text or res.reason))
        else:
            print('WORKED FINE')
            return True

    def post_cancel_staged_transactions(self, code, order_id):
        print('post_cancel_staged_transactions: ', code, " ", order_id)
        self.ensure_one()
        payload = self.get_base_params()
        payload.update({
            'event': 'ODOO_CANCELLATION',
            'code': code,
            'orderId': order_id,
        })
        json_data = {}
        res = requests.post(f'{self.pos_api_base_url}staged-transactions/cancellation', params=payload, json=json_data)
        if not res.ok:
            # raise exceptions.ValidationError(_(res.text or res.reason))
            print('error calling cancellation endpoint: %s', _(res.text or res.reason))
        else:
            print('True')
            return True

    def complete_wollette_order(self, order):
        print('complete_wollette_order')
        self.ensure_one()
        data = {
            'party_id': order.party_id if order.party_id else None,
            'payments': order.get_wollette_payments(),
            'spent_coupon_ids': order.lines.filtered(lambda l: l.coupon_id).mapped('coupon_id'),
            'spent_points': sum(order.lines.filtered(lambda l: l.spent_points).mapped('spent_points')),
            'order_id': order.pos_reference,
        }
        print('Final data: ', data)
        # call parties only if order has party id and has used coupons/points
        if order.party_id and (data['spent_coupon_ids'] or data['spent_points']):
            self.post_parties_staged_transactions(**data)

        # self.post_parties_staged_transactions(**data)

        self.post_completed_staged_transactions(order)