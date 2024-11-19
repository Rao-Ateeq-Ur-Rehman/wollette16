odoo.define("pos_wollette.ScanQRPopup", function (require) {
    "use strict";

    const AbstractAwaitablePopup = require("point_of_sale.AbstractAwaitablePopup");
    const Registries = require("point_of_sale.Registries");
    const { onMounted, useState, onPatched, useRef } = owl;
    const { useBarcodeReader } = require('point_of_sale.custom_hooks');
    const NumberBuffer = require('point_of_sale.NumberBuffer');

    console.log('NumberBuffer: ', NumberBuffer);

    class ScanQRPopup extends AbstractAwaitablePopup {
        inputRef = useRef('wolletdiv');
        scanning = false;

        constructor() {
            super(...arguments);

            // Initialize component state
            this.state = useState({
                coupons: [],
                outstandingPoints: {},
                promoData: {},
                currentScreen: 'scan',
                total_cart_price: 0.0,
                errorMessage: null,
                coupon_scanning: false,
            });
            this.html5QrcodeScanner = null;

            // Process initial QR code if provided
            if (this.props.code) {
                this.state.currentScreen = 'loading';
                this.processQR(this.props.code.base_code);
            }
        }

        // Get valid coupons based on order lines and original price
        get validCoupons() {
            const orderLines = this.env.pos.get_order().get_orderlines();
            const originalPrice = orderLines.reduce((acc, item) => acc + item.price * item.quantity, 0.0);

            return this.state.coupons.filter(coupon => this.isValidCoupon(coupon, orderLines, originalPrice));
        }

        // Check if a coupon is valid based on its type and order lines
        isValidCoupon(coupon, orderLines, originalPrice) {
            switch (coupon.type) {
                case 'LINE_ITEM_COST_PRICE':
                    return this.hasMatchingProducts(coupon, orderLines);
                case 'LINE_ITEM_PERCENTAGE_PRICE':
                    return this.hasMatchingProductsWithQuantity(coupon, orderLines);
                case 'TRANSACTION_GROSS_PRICE':
                    return this.hasValidTransactionGrossPrice(coupon, orderLines, originalPrice);
                case 'TRANSACTION_PERCENTAGE_PRICE':
                    return this.hasValidTransactionPercentagePrice(coupon, orderLines, originalPrice);
                default:
                    return false;
            }
        }

        // Check if coupon has matching products in the order lines
        hasMatchingProducts(coupon, orderLines) {
            const couponSku = coupon.applicableSaleableIds.map(item => item.sku);
            return orderLines.some(item => couponSku.includes(item.product.default_code));
        }

        // Check if coupon has matching products with required quantity in the order lines
        hasMatchingProductsWithQuantity(coupon, orderLines) {
            const couponSku = coupon.applicableSaleableIds.map(item => item.sku);
            return orderLines.some(item => couponSku.includes(item.product.default_code) && item.quantity >= coupon.minimumQuantity);
        }

        // Check if coupon has valid transaction gross price
        hasValidTransactionGrossPrice(coupon, orderLines, originalPrice) {
            const excludedPrice = this.calculateExcludedPrice(coupon, orderLines);
            return (originalPrice - excludedPrice) >= coupon.minimumAmount.value;
        }

        // Check if coupon has valid transaction percentage price
        hasValidTransactionPercentagePrice(coupon, orderLines, originalPrice) {
            const excludedPrice = this.calculateExcludedPrice(coupon, orderLines);
            return (originalPrice - excludedPrice) >= coupon.minimumAmount.value;
        }

        // Calculate the excluded price for certain products in the order lines
        calculateExcludedPrice(coupon, orderLines) {
            return orderLines.reduce((acc, item) => {
                const isExcluded = coupon.excludedSaleableIds.some(excludedItem => excludedItem.sku === item.product.default_code);
                return isExcluded ? acc + item.price * item.quantity : acc;
            }, 0.0);
        }

        // Check if there are valid points in the state
        get validPoints() {
            return this.state.outstandingPoints && this.state.outstandingPoints.value && this.state.outstandingPoints.savings;
        }

        // Setup component lifecycle hooks and initialize functionalities
        setup() {
            super.setup();
            this.initializeNumberBuffer();
            this.initializeBarcodeReader();
            onMounted(this.onMountedHandler.bind(this));
            onPatched(this.onPatchedHandler.bind(this));
        }

        initializeNumberBuffer() {
            NumberBuffer.use({
                triggerAtEnter: null,
                triggerAtEsc: null,
                triggerAtInput: null,
                nonKeyboardInputEvent: null,
                useWithBarcode: false,
            });
        }

        // Initialize the barcode reader for the popup
        initializeBarcodeReader() {
            useBarcodeReader({
                product: this._barcodeAction.bind(this),
            });
        }

        // Handle component mount event
        onMountedHandler() {
            const orderLines = this.env.pos.get_order().get_orderlines();
            const originalPrice = orderLines.reduce((acc, item) => acc + item.price * item.quantity, 0.0);

            if (originalPrice <= 0.0) {
                this.confirm();
            }

            if (this.state.currentScreen === 'scan') {
                // this.scanQRCodeNew();
            }
        }

        // Method to handle actions to be taken when the component is patched (updated).
        onPatchedHandler() {
            if (this.state.currentScreen === 'scan') {
                // this.scanQRCodeNew();
            } else if (this.html5QrcodeScanner && this.html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
                this.html5QrcodeScanner.stop();
            }
        }

        // Method to handle barcode actions and process the scanned QR code.
        async _barcodeAction(code) {
            console.log('_barcodeAction code: ', code);
            console.log('_barcodeAction code.base_code: ', code.base_code);
            await this.processQR(code.base_code);
        }

        // Method to initiate QR code scanning using the HTML5 QR code scanner.
        async scanQRCodeNew() {
            if (this.scanning) return;
            this.scanning = true;
            this.state.coupon_scanning = true;

            const config = { fps: 30, qrbox: { width: 255, height: 255 } };
            this.html5QrcodeScanner = new Html5Qrcode('reader');

            const qrCodeSuccessCallback = async (decodedText) => {
                if (this.html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
                    await this.html5QrcodeScanner.stop();
                }
                this.html5QrcodeScanner.clear();
                await this.processQR(decodedText);
            };

            await this.html5QrcodeScanner.start({ facingMode: 'environment' }, config, qrCodeSuccessCallback);
            $(this.inputRef.el).hide();
            this.scanning = false;
        }

        // Method to process QR code from a button click.
        async processQRFromButton() {
            return this.processQR($('#wollette_qr_code').val());
        }

        // Method to cancel the current operation and stop the QR code scanner if active.
        async cancel() {
            if (this.html5QrcodeScanner && this.html5QrcodeScanner.getState() === Html5QrcodeScannerState.SCANNING) {
                await this.html5QrcodeScanner.stop();
            }
            await this.confirm();
        }

        // Method to process the QR code and fetch associated data.
        async processQR(code, fake = false) {
            this.clear();
            this.state.currentScreen = 'loading';
            try {
                const data = await this.getData(code, fake);
                this.processReceivedData(data, code);
            } catch (error) {
                console.log('error: ', error)
                this.handleProcessQRError(error);
            }
        }

        // Method to fetch data associated with the QR code, either real or fake data.
        async getData(code, fake) {
            if (!fake) {
                const order = this.env.pos.get_order();
                const session_id = this.env.pos.pos_session.id;
                return this.rpc({
                    model: 'pos.session',
                    method: 'get_staged_transactions',
                    args: [[session_id]],
                    kwargs: { code, order_id: order.name }
                });
            } else {
                return this.getFakeData();
            }
        }

        // Method to process and store the received data from the QR code.
        processReceivedData(data, code) {
            const order = this.env.pos.get_order();
            this.state.promoData = data;
            this.state.total_cart_price = this.calculateTotalCartPrice().toFixed(2);

            order.setWolletteCode(code);
            order.setPartyId(data.partyId);
            order.setStagedTransactionId(data.stagedTransactionId);

            if (data.outstandingPoints) {
                const savingsResult = order.forecast_points(data.outstandingPoints);
                this.state.outstandingPoints = {
                    ...data.outstandingPoints,
                    applied: false,
                    savings: savingsResult.savings,
                    spent_points: savingsResult.pointsUsed
                };
                console.log('this.state.outstandingPoints: ', this.state.outstandingPoints);
            }

            if (!data.outstandingCoupons || data.outstandingCoupons.length === 0) {
                this.nextScreen('points');
            } else {
                this.state.coupons = this.transformCoupons(data.outstandingCoupons);
                order.setOutstandingCoupons(this.state.coupons);
                this.nextScreen('coupons');
            }
        }

        // Method to calculate the total price of items in the cart.
        calculateTotalCartPrice() {
            const orderDataLines = this.env.pos.get_order().orderlines;
            return orderDataLines.reduce((acc, item) => acc + item.price * item.quantity, 0.0);
        }

        // Method to transform and structure the coupon data.
        transformCoupons(outstandingCoupons) {
            return outstandingCoupons.map(coupon => ({
                id: coupon.id,
                amount: coupon.discount?.amount?.value ?? 0,
                description: coupon.discount?.description ?? '',
                extReference: coupon?.extReference ?? '',
                applicableSaleableIds: coupon.discount?.applicableSaleableIds?.length > 0 ? coupon.discount.applicableSaleableIds : [],
                excludedSaleableIds: coupon.discount?.excludedSaleableIds?.length > 0 ? coupon.discount.excludedSaleableIds : [],
                minimumAmount: coupon.discount?.minimumAmount ?? {},
                type: coupon.discount?.type ?? '',
                minimumQuantity: coupon.discount?.minimumQuantity ?? '',
                maximumQuantity: coupon.discount?.maximumQuantity ?? '',
                currencySymbol: (coupon.discount.amount?.currencySymbol || coupon.discount.currencySymbol) ?? '',
                currencyCode: coupon?.currencyCode ?? '',
                percentage: coupon.discount?.percentage ?? '',
                checked: false,
                applied: false,
            }));
        }

        // Method to handle errors encountered while processing the QR code.
        handleProcessQRError(error) {
            let errorMessage = 'Error processing code';
            if (error.message?.data?.message) {
                errorMessage = error.message.data.message;
            }
            this.state.errorMessage = errorMessage;
            console.log('errorMessage: ', errorMessage)
            this.state.currentScreen = 'error';
        }

        // Method to clear the state and optionally close the popup.
        clear(close = false) {
            this.state.coupons = [];
            this.state.outstandingPoints = {};
            this.state.promoData = {};
            const order = this.env.pos.get_order();
            order.setPartyId(null);
            order.setStagedTransactionId(null);
            order.setOutstandingCoupons([]);
            order.setWolletteCode(null);
            this.removePromotionLines(order);

            if (close) {
                this.confirm();
            }
        }

        // Method to remove lines from the current order.
        removePromotionLines(order) {
            const linesToRemove = order.get_orderlines().filter(line => line.promotion);
            linesToRemove.forEach(line => order.remove_orderline(line));
        }

        // Method to apply a specific coupon to the order.
        applyCoupon(coupon) {
            try {
                this.state.currentScreen = 'loading';
                const discount = this.env.pos.get_order().apply_coupon(coupon);
                this.state.total_cart_price = parseFloat((this.state.total_cart_price - discount).toFixed(2));
            } catch (error) {
                this.state.currentScreen = 'coupons';
                throw error;
            } finally {
                this.state.currentScreen = 'coupons';
            }
        }

        // Method to cancel the current operation and reset applied coupons.
        cancel(){
            const self = this;
            self.state.coupons.forEach(coupon =>{
                self.removeCoupon(coupon);
            });
            this.confirm();
        }

        // Method to remove a specific coupon from the order.
        removeCoupon(coupon) {
            try {
                this.state.currentScreen = 'loading';
                const discount = Math.abs(this.env.pos.get_order().remove_coupon(coupon));
                if (discount !== 0) {
                    this.state.total_cart_price = parseFloat((this.state.total_cart_price + discount).toFixed(2));
                }
            } catch (error) {
                this.state.currentScreen = 'coupons';
                throw error;
            } finally {
                this.state.currentScreen = 'coupons';
            }
        }

        // Method to apply all valid coupons to the order.
        applyAllCoupons() {
            this.validCoupons.forEach(coupon => this.applyCoupon(coupon));
            this.nextScreen('points');
        }

        // Method to apply outstanding points to the order.
        applyPoints() {
            try {
                const points = this.state.outstandingPoints;
                this.state.currentScreen = 'loading';
                this.env.pos.get_order().apply_points(points);
                this.confirm();
            } catch (error) {
                this.state.currentScreen = 'error';
                this.state.errorMessage = 'Error applying points';
            }
        }

        // Method to remove applied points from the order.
        removePoints(points) {
            try {
                this.state.currentScreen = 'loading';
                this.env.pos.get_order().remove_points(points);
            } catch (error) {
                this.state.currentScreen = 'error';
                throw error;
            } finally {
                this.state.currentScreen = 'coupons';
            }
        }

        // Method to navigate to the next screen based on the state of coupons and points.
        nextScreen(screen) {
            if (screen === 'coupons' && this.validCoupons.length > 0) {
                this.state.currentScreen = 'coupons';
            } else if (screen === 'coupons' && this.validPoints) {
                this.state.currentScreen = 'points';
            } else if (screen === 'points' && this.validPoints) {
                this.state.currentScreen = 'points';
            } else {
                this.confirm();
            }
        }
    }

    ScanQRPopup.template = "pos_wollette.ScanQRPopup";
    ScanQRPopup.defaultProps = { confirmKey: false, cancelKey: false };
    Registries.Component.add(ScanQRPopup);

    return ScanQRPopup;
});
