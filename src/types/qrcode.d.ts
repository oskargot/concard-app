/** The slice of `qrcode` the card back uses (the package ships no types). */
declare module 'qrcode' {
	interface QRCodeModel {
		version: number;
		modules: { size: number; data: Uint8Array | boolean[] };
	}
	const QRCode: {
		create(text: string, options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): QRCodeModel;
	};
	export default QRCode;
}
