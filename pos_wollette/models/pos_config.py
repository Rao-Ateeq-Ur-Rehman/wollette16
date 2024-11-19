# Copyright (C) 2017 - Today: GRAP (http://www.grap.coop)
# @author: Sylvain LE GAL (https://twitter.com/legalsylvain)
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl.html).

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    pos_discount_product_id = fields.Many2one('product.product', related='pos_config_id.pos_discount_product_id', readonly=False, help='Product that is used to create discount lines')
    pos_api_base_url = fields.Char(related='pos_config_id.pos_api_base_url', help='Base URL for Wollette API', readonly=False)
    pos_database_id = fields.Char(related='pos_config_id.pos_database_id', readonly=False)
    pos_shop_name = fields.Char(related='pos_config_id.pos_shop_name', readonly=False)


class PosConfig(models.Model):
    _inherit = 'pos.config'

    pos_discount_product_id = fields.Many2one('product.product')
    pos_api_base_url = fields.Char()
    pos_database_id = fields.Char()
    pos_shop_name = fields.Char()