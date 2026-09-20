/**
 * Feature switches shared by client and server.
 *
 * QR_VERIFICATION_ENABLED: identifying and registering players by scanning their card's QR code.
 * Disabled for now: attendance is verified from the "Verificar" button of each player in the list.
 * The scanner, the lookup and the QR carnet code stay in place; set to true to bring it back.
 */
export const QR_VERIFICATION_ENABLED = false;
