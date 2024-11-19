import base64

from odoo import http
from odoo.http import request


class PublicImageController(http.Controller):
    @http.route('/public_image/<int:product_id>', type='http', auth='public', website=True)
    def public_image(self, product_id, **kwargs):
        print('III')
        product = request.env['product.product'].sudo().browse(product_id)
        if not product or not product.image_1920:
            return request.not_found()
        image_base64 = product.image_1920
        image_binary = base64.b64decode(image_base64)
        return request.make_response(image_binary, headers=[
            ('Content-Type', 'image/png'),
            ('Content-Disposition', 'inline; filename="%s.png"' % product.name),
        ])