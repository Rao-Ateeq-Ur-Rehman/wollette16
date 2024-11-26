# Copyright (C) 2017 - Today: GRAP (http://www.grap.coop)
# @author: Sylvain LE GAL (https://twitter.com/legalsylvain)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

from odoo import http
from odoo.http import request


class SaleOrderLine(models.Model):
    _inherit = "sale.order.line"

    product_image = fields.Image(related='product_id.image_1920', string='Test Image', max_width=200, max_height=200, store=True, attachment=False)

    @api.model
    def create(self, vals):
        print("A new order line created")

    @api.model
    def _prepare_from_pos(self, sale_order, order_line_data):
        ProductProduct = self.env["product.product"]
        product = ProductProduct.browse(order_line_data["product_id"])
        return {
            "order_id": sale_order.id,
            "product_id": order_line_data["product_id"],
            "name": product.name,
            "product_uom_qty": order_line_data["qty"],
            "discount": order_line_data["discount"],
            "price_unit": order_line_data["price_unit"],
            "tax_id": order_line_data["tax_ids"],
        }
