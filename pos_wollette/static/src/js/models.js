/** @odoo-module alias=pos_sale_loyalty.models **/

import { Orderline, Order } from 'point_of_sale.models';
import Registries from 'point_of_sale.Registries';

export const PosWolletteOrderline = (Orderline) => class PosWolletteOrderline extends Orderline {
    constructor(obj, options) {
        super(...arguments);
        this.promotion = this.promotion || options.promotion;
        this.coupon_id = this.coupon_id || options.coupon_id;
        this.spent_points = this.spent_points || options.spent_points;
        this.related_product_id = this.related_product_id || options.related_product_id;
    }

    setPromotion(promotion, coupon_id = null, spent_points = null, related_product_id = null) {
        this.promotion = promotion;
        if (coupon_id) this.coupon_id = coupon_id;
        if (spent_points) this.spent_points = spent_points;
        if (related_product_id) this.related_product_id = related_product_id;
    }

    //@override
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        json.wollette_promotion = this.promotion;
        json.coupon_id = this.coupon_id;
        json.spent_points = this.spent_points;
        json.related_product_id = this.related_product_id;
        return json;
    }

    // Override method to initialize order line data from JSON, including promotion details
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        this.promotion = json.wollette_promotion;
        this.coupon_id = json.coupon_id;
        this.spent_points = json.spent_points;
        this.related_product_id = json.related_product_id;
    }

    // Override method to set quantity
    set_quantity(quantity, keep_price) {
        console.log(`quantity, keep_price: ${quantity}, ${keep_price}`);
        return super.set_quantity(...arguments);
    }

    // Method to apply applicable coupons to the order line
    apply_coupons() {
        const orderLine = this;
        const promotion_product_id = orderLine.pos.config.pos_discount_product_id[0];

        orderLine.order.outstandingCoupons.forEach(coupon => {
            if (coupon.checked) {
                this.applyCouponToOrderLine(coupon, orderLine, promotion_product_id);
            }
        });
    }

    // Helper method to apply a specific coupon to the order line
    applyCouponToOrderLine(coupon, orderLine, promotion_product_id) {
        coupon.applicableSaleableIds.forEach(prod => {
            if (orderLine.product.default_code === prod.sku && !orderLine.promotion) {
                this.removeExistingPromotionLines(orderLine);
                const couponValue = coupon.amount.value;
                if (couponValue) {
                    this.createCouponOrderLine(coupon, orderLine, promotion_product_id, couponValue);
                }
            }
        });
    }

    // Helper method to remove existing promotion lines related to the order line
    removeExistingPromotionLines(orderLine) {
        const lines_to_delete = orderLine.order.get_orderlines().filter(line => line.promotion && line.related_product_id === orderLine.product.id);
        lines_to_delete.forEach(line => orderLine.order.remove_orderline(line));
    }

    // Helper method to create a new order line for the applied coupon
    createCouponOrderLine(coupon, orderLine, promotion_product_id, couponValue) {
        const lineData = {
            product_id: promotion_product_id,
            price_unit: couponValue * -1,
            description: coupon.description,
            full_product_name: `[Coupon] ${coupon.description}`,
            qty: orderLine.quantity,
        };
        const createdOrderLine = Orderline.create({}, { pos: orderLine.pos, order: orderLine.order, json: lineData });
        createdOrderLine.setPromotion(true, coupon.id, null, orderLine.product.id);
        orderLine.order.add_orderline(createdOrderLine);
    }
};

Registries.Model.extend(Orderline, PosWolletteOrderline);

export const PosWolletteOrder = (Order) => class PosWolletteOrder extends Order {
    constructor(obj, options) {
        super(...arguments);
        console.log('I am Order Setup');
        console.log('this.party_id: ',this.party_id,"Options: ", options.party_id);
        console.log('this.staged_transaction_id: ',this.staged_transaction_id,"Options: ", options.staged_transaction_id);
        console.log('this.outstandingCoupons: ',this.outstandingCoupons,"Options: ", options.outstandingCoupons);
        console.log('this.wollette_code: ',this.wollette_code,"Options: ", options.wollette_code);
        this.party_id = this.party_id || options.party_id;
        this.staged_transaction_id = this.staged_transaction_id || options.staged_transaction_id;
        this.outstandingCoupons = this.outstandingCoupons || options.outstandingCoupons || [];
        this.wollette_code = this.wollette_code || options.wollette_code || null;
    }

    // Method to set the party ID
    setPartyId(party_id) {
        this.party_id = party_id;
    }

    // Method to set the staged transaction ID
    setStagedTransactionId(staged_transaction_id) {
        this.staged_transaction_id = staged_transaction_id;
    }

    // Method to set outstanding coupons
    setOutstandingCoupons(outstandingCoupons) {
        this.outstandingCoupons = outstandingCoupons;
    }

    // Method to set Wollette code
    setWolletteCode(code) {
        this.wollette_code = code;
    }

    // Getter to retrieve a temporary ID from the order UID
    get temporaryID() {
        return parseInt(this.uid.split('-')[2]);
    }

    //@override
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        json.party_id = this.party_id;
        json.staged_transaction_id = this.staged_transaction_id;
        json.outstanding_coupons = this.outstandingCoupons;
        json.wollette_code = this.wollette_code;
        return json;
    }

    //@override
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        this.party_id = json.party_id;
        this.staged_transaction_id = json.staged_transaction_id;
        this.outstandingCoupons = json.outstanding_coupons;
        this.wollette_code = json.wollette_code;
    }

    apply_coupon(coupon) {
        console.log('coupon: ', coupon);

        let cart_data = this.get_orderlines();
        let discountedPrice = 0.0;
        let originalPrice = 0.0;

        // Calculate original price
        cart_data.forEach(item => {
            if (item.price > 0) {
                originalPrice += item.price * item.quantity;
            }
        });

        // Apply coupon based on its type
        switch (coupon.type) {
            case 'LINE_ITEM_COST_PRICE':
                var discountApplied =  this.applyLineItemCostPriceCoupon(coupon, cart_data, originalPrice);
                return discountApplied;
                break;
            case 'LINE_ITEM_PERCENTAGE_PRICE':
                var discountApplied = this.applyLineItemPercentagePriceCoupon(coupon, cart_data, originalPrice);
                return discountApplied;
                break;
            case 'TRANSACTION_GROSS_PRICE':
                var discountApplied = this.applyTransactionGrossPriceCoupon(coupon, cart_data, originalPrice);
                return discountApplied;
                break;
            case 'TRANSACTION_PERCENTAGE_PRICE':
                var discountApplied = this.applyTransactionPercentagePriceCoupon(coupon, cart_data, originalPrice);
                return discountApplied;
                break;
            default:
                console.error('Unknown coupon type:', coupon.type);
                break;
        }
    }

    // Helper functions for applying different types of coupons

    applyLineItemCostPriceCoupon(coupon, cart_data, originalPrice) {
        let couponSku = coupon.applicableSaleableIds.map(item => item.sku);
        let matchingProducts = cart_data.filter(item => couponSku.includes(item.product.default_code));
        let maxQuantity = coupon.maximumQuantity;

        if (matchingProducts.length > 0) {
            let discountValue = coupon.amount;
            // Calculate total quantity of matching products
            let totalQuantity = matchingProducts.reduce((sum, item) => sum + item.quantity, 0);
            // Ensure total quantity does not exceed maxQuantity
            let limitedQuantity = Math.min(totalQuantity, maxQuantity);
            // Calculate total discount
            let totalDiscount = limitedQuantity * discountValue;
            let discountedPrice = originalPrice - totalDiscount;
            this.createOrderLineForCoupon(coupon, totalDiscount, discountedPrice, cart_data);
            return totalDiscount;
        }
    }

//    applyLineItemCostPriceCoupon(coupon, cart_data, originalPrice) {
//        console.log('coupon: ', coupon);
//        console.log('cart_data: ', cart_data);
//        let couponSku = coupon.applicableSaleableIds.map(item => item.sku);
//        let matchingProducts = cart_data.filter(item => couponSku.includes(item.product.default_code));
//        let maxQuantity = coupon.maximumQuantity;
//
//        if (matchingProducts.length > 0) {
//            let discountValue = coupon.amount;
//            // Calculate total quantity of matching products
//            let totalQuantity = matchingProducts.reduce((sum, item) => sum + item.quantity, 0);
//            // Calculate total discount
//            let totalDiscount = totalQuantity * discountValue;
//            let discountedPrice = originalPrice - totalDiscount;
//            this.createOrderLineForCoupon(coupon, totalDiscount, discountedPrice, cart_data);
//            return totalDiscount;
//        }
//    }

//    applyLineItemCostPriceCoupon(coupon, cart_data, originalPrice) {
//        console.log('coupon: ', coupon);
//        console.log('cart_data: ', cart_data);
//        let couponSku = coupon.applicableSaleableIds.map(item => item.sku);
//        let matchingProducts = cart_data.filter(item => couponSku.includes(item.product.default_code));
//
//        if (matchingProducts.length > 0) {
//            let discountValue = coupon.amount;
//            let disc = matchingProducts.length * discountValue;
//            let discountedPrice = originalPrice - disc;
//            this.createOrderLineForCoupon(coupon, disc, discountedPrice, cart_data);
//            return disc;
//        }
//    }

    // Method to apply LINE_ITEM_PERCENTAGE_PRICE coupon type
    applyLineItemPercentagePriceCoupon(coupon, cart_data, originalPrice) {
        let couponSku = coupon.applicableSaleableIds.map(item => item.sku);
        let discountPercentage = coupon.percentage;
        let maxQuantity = coupon.maximumQuantity;
        let matchingProducts = cart_data.filter(item => couponSku.includes(item.product.default_code));
        let discount = 0.0;

        matchingProducts.forEach(item => {
            if (item.quantity >= coupon.minimumQuantity) {
                // Calculate the quantity eligible for discount
                let eligibleQuantity = Math.min(item.quantity, maxQuantity);
                discount += item.price * eligibleQuantity;
                // Reduce maxQuantity for next items
                maxQuantity -= eligibleQuantity;
            }
        });

        if (discount > 0) {
            let discountAmount = (discount * discountPercentage) / 100;
            let discountedPrice = originalPrice - discountAmount;
            this.createOrderLineForCoupon(coupon, discountAmount, discountedPrice, cart_data);
            return discountAmount;
        }
    }


//    applyLineItemPercentagePriceCoupon(coupon, cart_data, originalPrice) {
//        let couponSku = coupon.applicableSaleableIds.map(item => item.sku);
//        let discountPercentage = coupon.percentage;
//        let maxQuantity = coupon.maximumQuantity;
//        let matchingProducts = cart_data.filter(item => couponSku.includes(item.product.default_code));
//        let discount = 0.0;
//
//        matchingProducts.forEach(item => {
//            if (item.quantity >= coupon.minimumQuantity) {
//                discount += item.price * item.quantity;
//            }
//        });
//        if (discount > 0) {
//            let discountAmount = (discount * discountPercentage) / 100;
//            let discountedPrice = originalPrice - discountAmount;
//            this.createOrderLineForCoupon(coupon, discountAmount, discountedPrice, cart_data);
//            return discountAmount;
//        }
//    }

    // Method to apply TRANSACTION_GROSS_PRICE coupon type
    applyTransactionGrossPriceCoupon(coupon, cart_data, originalPrice) {
        let excludedSaleableIds = coupon.excludedSaleableIds;
        let minValue = coupon.minimumAmount.value;
        let excludedPrice = 0.0;
        cart_data.forEach(item => {
            let isExcluded = excludedSaleableIds.some(excludedItem => excludedItem.sku === item.product.default_code);
            if (isExcluded) {
                excludedPrice += item.price * item.quantity;
            }
        });

        let applicableTotal = originalPrice - excludedPrice;

        if (applicableTotal >= minValue) {
            let discountAmount = coupon.amount;
            let discountedPrice = originalPrice - discountAmount;
            this.createOrderLineForCoupon(coupon, discountAmount, discountedPrice, cart_data);
            return discountAmount;
        }
    }

    applyTransactionPercentagePriceCoupon(coupon, cart_data, originalPrice) {
        let excludedSaleableIds = coupon.excludedSaleableIds;
        let minValue = coupon.minimumAmount.value;
        let excludedPrice = 0.0;

        cart_data.forEach(item => {
            let isExcluded = excludedSaleableIds.some(excludedItem => excludedItem.sku === item.product.default_code);
            if (isExcluded && item.price >= 0) {
                excludedPrice += item.price * item.quantity;
            }
        });

        let applicableTotal = originalPrice - excludedPrice;

        if (applicableTotal >= minValue) {
            let discountPercentage = coupon.percentage;
            let discountAmount = (applicableTotal * discountPercentage) / 100;
            let discountedPrice = originalPrice - discountAmount;
            this.createOrderLineForCoupon(coupon, discountAmount, discountedPrice, cart_data);
            return discountAmount;
        }
    }

    // Helper function to create an order line for the applied coupon
    createOrderLineForCoupon(coupon, discountAmount, discountedPrice, cart_data) {
        let pos = cart_data[0].pos;
        let product_id = cart_data[0].pos.config.pos_discount_product_id[0];
        let line = {
            product_id: product_id,
            price_unit: discountAmount * -1,
            description: coupon.description,
            full_product_name: `Discount [${coupon.description}]`,
            qty: 1,
        };

        let createdOrderLine = Orderline.create({}, { pos: pos, order: this, json: line });
        createdOrderLine.setPromotion(true, coupon.id, null, product_id);
        this.add_orderline(createdOrderLine);
        coupon.checked = true;
        coupon.applied = true;
    }


    remove_coupon(coupon) {
        const lines_to_delete = this.get_orderlines().filter(line => line.promotion && line.coupon_id === coupon.id);
        console.log('lines_to_delete: ', lines_to_delete);
        lines_to_delete.forEach(line => this.remove_orderline(line));
        coupon.checked = false;
        coupon.applied = false;
        return lines_to_delete.length > 0 ? lines_to_delete[0].price : 0;
    }

    apply_points(points) {
        const available = points.value;
        const savings = this.forecast_points(points);
        if (!available || !savings) return;

        this.removeExistingPoints();
        if (savings) {
            this.createPointsOrderLine(points, savings);
            points.applied = true;
        }
    }

    removeExistingPoints() {
        const lines_to_delete = this.get_orderlines().filter(line => line.promotion && line.points);
        lines_to_delete.forEach(line => this.remove_orderline(line));
    }

    createPointsOrderLine(points, savings) {
        const promotion_product_id = this.pos.config.pos_discount_product_id[0];
        const line = {
            product_id: promotion_product_id,
            price_unit: savings.savings * -1,
            description: `Discount [${points.name}]`,
            full_product_name: `Discount [${points.name}]`,
            qty: 1,
        };
        const createdOrderLine = Orderline.create({}, { pos: this.pos, order: this, json: line });
        console.log('points.spent_points: ', points.spent_points);
        createdOrderLine.setPromotion(true, null, points.spent_points);
        this.add_orderline(createdOrderLine);
    }

    remove_points(points) {
        this.removeExistingPoints();
        points.applied = false;
    }

    forecast_points(points) {
        const cart_data = this.get_orderlines();
        const excludedSaleableIds = points.redemptionPolicy.excludedSaleableIds;
        const originalPrice = cart_data.reduce((acc, item) => {
            const taxAmount = item.get_tax();
            const priceWithoutTax = item.price * item.quantity;
            return acc + priceWithoutTax + taxAmount;
        }, 0.0);
        const excludedPrice = cart_data.reduce((acc, item) => {
            const isExcluded = excludedSaleableIds.some(excludedItem => excludedItem.sku === item.product.default_code);
            return isExcluded ? acc + item.price * item.quantity : acc;
        }, 0.0);

        const applicableTotal = originalPrice - excludedPrice;
        if (applicableTotal > 0.0) {
            const result = this.calculateSavings(points, applicableTotal);
            return result;
        }
        return { savings: 0, pointsUsed: 0 };
    }

    calculateSavings(points, applicableTotal) {
        let savings = 0.0;
        let availablePoints = points.value;
        let pointsUsed = 0;
        const baseRatePoints = points.redemptionPolicy.points;
        const baseRateAmount = points.redemptionPolicy.amount.value;

        while (availablePoints > 0 && availablePoints >= baseRatePoints && savings < applicableTotal) {
            if ((savings + baseRateAmount) > applicableTotal) break;
            availablePoints -= baseRatePoints;
            pointsUsed += baseRatePoints;
            savings += baseRateAmount;
        }
        return { savings, pointsUsed };
    }
};

Registries.Model.extend(Order, PosWolletteOrder);
