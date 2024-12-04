import logging
import requests
import json
from itertools import groupby
import os
import base64
from odoo.http import request, content_disposition


from odoo import api, fields, models, exceptions, _
from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class ProductImageController(http.Controller):

    @http.route('/custom/image/product/<int:product_id>', type='http', auth='public', csrf=False)
    def product_image(self, product_id, **kwargs):
        print('product_image called')

        # Retrieve the access token from the headers
        # access_token = request.httprequest.headers.get('Authorization')
        # if not access_token:
        #     print('NO access toke')
        #     return request.not_found()

        # Verify the access token
        # order = request.env['pos.order'].sudo().search([('access_token', '=', access_token)], limit=1)
        # if not order:
        #     print('NO Order Found')
        #     return request.not_found()

        # Fetch the product
        product = request.env['product.product'].sudo().browse(product_id)
        if not product.exists():
            print('NO Product ID Found')
            return request.not_found()

        # Get the image data
        image_data = product.image_1920
        if not image_data:
            return request.not_found()

        # Decode the image data
        image_base64 = base64.b64decode(image_data)

        # Serve the image
        headers = [
            ('Content-Type', 'image/png'),
            ('Content-Disposition', content_disposition('product_image.png'))
        ]
        return request.make_response(image_base64, headers=headers)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    party_id = fields.Char()
    staged_transaction_id = fields.Char()
    outstanding_coupons = fields.Text()
    temporary_id = fields.Integer(compute='_compute_temporary_id')

    @api.depends('pos_reference')
    def _compute_temporary_id(self):
        for rec in self:
            if rec.pos_reference:
                rec.temporary_id = int(rec.pos_reference.split('-')[2])
            else:
                rec.temporary_id = 0

    @api.model
    def create_from_ui(self, orders, draft=False):
        res = super().create_from_ui(orders, draft)
        for o in res:
            order = self.browse(o['id'])
            # if order.party_id:
            try:
                order.session_id.complete_wollette_order(order)
            except Exception as e:
                _logger.exception('Error posting to Wollette: %s', e)
        return res

    @api.model
    def _order_fields(self, ui_order):
        res = super()._order_fields(ui_order)
        res.update({
            'party_id': ui_order.get('party_id'),
            'staged_transaction_id': ui_order.get('staged_transaction_id'),
            'outstanding_coupons': json.dumps(ui_order.get('outstanding_coupons')),
        })
        _logger.debug('Order fields: %s', res)
        return res

    # WORKING PERFECT
    def export_for_wollette(self):
        self.ensure_one()
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        db_name = self.env.cr.dbname
        return {
            'lines': [{
                'qty': line.qty,
                'display_name': line.full_product_name,
                'name': line.name,
                'sku': line.product_id.default_code if line.price_unit > 0 and line.product_id.default_code else None,
                'price_unit': line.price_unit,
                'price_subtotal': line.price_subtotal,
                'price_subtotal_incl': line.price_subtotal_incl,
                'product_image_url': '%s/custom/image/product/%d' % (
                    base_url, line.product_id.id) if line.price_unit >= 0 else None,
                # 'product_image_url': '%s/custom/image/product/%d?access_token=%s' % (
                #     base_url, line.product_id.id, self.access_token) if line.price_unit >= 0 else None,
            } for line in self.lines],
            'payment_ids': self.get_wollette_payments(),
            'name': self.pos_reference,
            'amount_paid': self.amount_paid,
            'amount_total': self.amount_total,
            'amount_tax': self.amount_tax,
            'amount_return': self.amount_return,
            'pos_session_id': self.session_id.id,
            'pricelist_id': self.pricelist_id.id,
            'partner_id': self.partner_id.id,
            'user_id': self.user_id.id,
            'sequence_number': self.sequence_number,
            'creation_date': fields.Datetime.to_string(self.date_order),
            'to_invoice': self.to_invoice,
            'to_ship': self.to_ship,
            'state': self.state,
            'id': self.id,
            'is_tipped': self.is_tipped,
            'tip_amount': self.tip_amount,
            'access_token': self.access_token,
        }

    def get_wollette_payments(self):
        self.ensure_one()
        grouped_payments = {}
        for payment in self.payment_ids:
            method_name = payment.payment_method_id.name
            if method_name in grouped_payments:
                grouped_payments[method_name] += payment.amount
            else:
                grouped_payments[method_name] = payment.amount
        return [{'method': method, 'total': total} for method, total in grouped_payments.items()]


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    product_image = fields.Image(related='product_id.image_1920', string='Test Image', store=True, attachment=False)
    wollette_promotion = fields.Boolean()
    coupon_id = fields.Char()
    spent_points = fields.Float()

