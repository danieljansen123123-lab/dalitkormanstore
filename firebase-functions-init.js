import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-functions.js";

// Module scripts run in document order, so firebase-init.js (loaded just
// before this file in every page that uses it) has already run and set
// window.firebaseApp by the time this line executes.
//
// "me-west1" (Tel Aviv) must match the region set on both functions in
// functions/index.js - if these ever get out of sync, calls will fail
// since the client would be looking in the wrong region entirely.
const functionsInstance = getFunctions(window.firebaseApp, "me-west1");

window.functionsInstance = functionsInstance;
window.firebaseFunctions = { httpsCallable };
