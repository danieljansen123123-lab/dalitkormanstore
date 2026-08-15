import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, query, where, orderBy, getDocs, addDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    sendPasswordResetEmail,
    sendEmailVerification,
    deleteUser 
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAk0Cnqz5O_JlWPhSVcWLU7bAnaNFQD8G8",
    authDomain: "dalitkormanstore.firebaseapp.com",
    projectId: "dalitkormanstore",
    storageBucket: "dalitkormanstore.firebasestorage.app",
    messagingSenderId: "276183912516",
    appId: "1:276183912516:web:71e8297211599bf4f96c11",
    measurementId: "G-S2ZE7SC26K"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// חשיפת פונקציות פיירבייס לכל האתר
window.firebaseApp = app;
window.db = db;
window.auth = auth;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.updateDoc = updateDoc;
window.deleteDoc = deleteDoc;
window.collection = collection;
window.query = query;
window.where = where;
window.orderBy = orderBy;
window.writeBatch = writeBatch;
window.serverTimestamp = serverTimestamp;
window.getDocs = getDocs;
window.addDoc = addDoc;

// משתנים גלובליים
window.currentUserData = null;
window.currentUserLoggedIn = false;

// הרשמה + שליחת מייל לאימות + רענון אוטומטי (ללא alert)
window.handleRegister = async function(event) {
    event.preventDefault(); 
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const dateOfBirth = document.getElementById('reg-dob').value;
    const genderInput = document.querySelector('input[name="reg-gender"]:checked');
    const gender = genderInput ? genderInput.value : '';
    const errorMsg = document.getElementById('auth-error-msg');
    const notice = document.getElementById('verification-notice');

    if (errorMsg) errorMsg.innerText = "";

    // 1. Validate Email Format
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!isEmailValid) {
        if (errorMsg) errorMsg.innerText = "אנא הזינו כתובת אימייל תקינה.";
        return;
    }

    // 2. Validate Phone Format
    const isPhoneValid = /^05\d[-]?\d{7}$/.test(phone.trim());
    if (!isPhoneValid) {
        if (errorMsg) errorMsg.innerText = "אנא הזינו מספר טלפון נייד תקין.";
        return;
    }

    // 3. Validate Date of Birth (must be a real date, not in the future)
    if (!dateOfBirth || new Date(dateOfBirth) > new Date()) {
        if (errorMsg) errorMsg.innerText = "אנא הזינו תאריך לידה תקין.";
        return;
    }

    // 4. Validate Password Criteria
    const isPassLength = password.length >= 6;
    const hasCapital = /[A-Z]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!isPassLength || !hasCapital || !hasSymbol) {
        if (errorMsg) errorMsg.innerText = "הסיסמה אינה עומדת בכל דרישות האבטחה.";
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await sendEmailVerification(user);

        await setDoc(doc(db, "Users", user.uid), {
            uid: user.uid,
            fullName: name,
            email: email,
            phone: phone,
            gender: gender,
            dateOfBirth: dateOfBirth,
            role: "user"
        });

        await signOut(auth);

        // Clear form inputs
        document.getElementById('register-form').reset();

        // Display green success text (Page will NOT refresh)
        if (notice) {
            notice.style.display = "block";
            notice.innerText = "החשבון נוצר בהצלחה! נשלח אליך קישור לאימות לתיבת הדואר. יש לאמת את החשבון בתוך 60 דקות, לאחר מכן החשבון יימחק ויש להירשם מחדש.";
        }

    } catch (error) {
        if (errorMsg) errorMsg.innerText = "שגיאה בהרשמה: " + error.message;
        console.error("Error during registration:", error);
    }
};

// יוצרת חשבון חדש בזמן תהליך התשלום (checkout), עבור לקוחה שלא הייתה מחוברת.
// script.js אינו מודול ולכן לא יכול לייבא ישירות מ-Firebase - לכן פעולה זו,
// כמו handleRegister, חיה כאן וחשופה על window לקריאה מ-submitOrder.
// בשונה מ-handleRegister הרגיל: לא מתנתקת בסוף (כדי שההזמנה תמשיך תחת
// המשתמשת החדשה, שכבר מחוברת אוטומטית אחרי היצירה), ולא חוסמת את התשלום
// על אימות אימייל - השליחה קורית ברקע.
window.createAccountForCheckout = async function({ name, email, phone, password, gender, dateOfBirth }) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "Users", user.uid), {
            uid: user.uid,
            fullName: name,
            email: email,
            phone: phone,
            gender: gender,
            dateOfBirth: dateOfBirth,
            role: "user"
        });

        sendEmailVerification(user).catch(e => console.warn('Email verification send failed:', e));

        return { success: true, uid: user.uid };
    } catch (error) {
        console.error("Error creating account during checkout:", error);
        return { success: false, code: error.code || '', message: error.message || '' };
    }
};

// התחברות + רענון אוטומטי (ללא alert)
window.handleLogin = async function(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('auth-error-msg');

    if (errorMsg) errorMsg.innerText = "";

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (!user.emailVerified) {
            // Check creation time vs current time
            const creationTime = new Date(user.metadata.creationTime).getTime();
            const currentTime = new Date().getTime();
            const diffInMinutes = (currentTime - creationTime) / (1000 * 60);

            // If account was created more than 60 minutes ago and remains unverified
            if (diffInMinutes > 60) {
                // Delete user document from Firestore
                try {
                    await deleteDoc(doc(db, "Users", user.uid));
                } catch (e) {
                    console.error("Firestore cleanup error:", e);
                }

                // Delete unverified user from Firebase Authentication
                await deleteUser(user);
                await signOut(auth);

                if (errorMsg) {
                    errorMsg.innerText = "חלפו 60 דקות ללא אימות האימייל, ולכן החשבון נמחק. אנא הירשם מחדש.";
                }
                return;
            }

            await signOut(auth);
            if (errorMsg) {
                errorMsg.innerText = "החשבון עדיין לא מאומת! אנא אמת את כתובת האימייל בקישור שנשלח אליך (הקישור בתוקף ל-60 דקות).";
            }
            return;
        }

        if (typeof window.closeAuthModal === "function") window.closeAuthModal();
        document.getElementById('login-form').reset();

        window.location.reload();
    } catch (error) {
        if (errorMsg) errorMsg.innerText = "אימייל או סיסמה שגויים, אנא נסה שוב.";
    }
};

// עדכון פרטים אישיים (שם וטלפון) + רענון לדף (ללא alert)
window.handleUpdateDetails = async function(event) {
    event.preventDefault();
    const newName = document.getElementById('acc-name').value;
    const newPhone = document.getElementById('acc-phone').value;
    const msgElement = document.getElementById('update-msg');
    
    if (!auth.currentUser) return;

    try {
        const userRef = doc(db, "Users", auth.currentUser.uid);
        await updateDoc(userRef, {
            fullName: newName,
            phone: newPhone
        });
        
        window.location.reload();
    } catch (error) {
        if (msgElement) {
            msgElement.style.color = "red";
            msgElement.innerText = "שגיאה בעדכון הפרטים.";
        }
        console.error("שגיאה בעדכון פרטים:", error);
    }
};

// שליחת אימייל לאיפוס סיסמה + רענון לדף (ללא alert)
window.handlePasswordReset = async function() {
    const currentUser = auth.currentUser;

    if (!currentUser) return;

    const email = currentUser.email || (window.currentUserData && window.currentUserData.email);

    if (!email) return;

    try {
        await sendPasswordResetEmail(auth, email);
        window.location.reload();
    } catch (error) {
        console.error("שגיאה באיפוס סיסמה:", error);
    }
};

// "שכחת סיסמה?" בטופס ההתחברות - למשתמשת שאינה מחוברת ולכן לא יכולה
// להשתמש ב-handlePasswordReset למעלה (שדורש session פעיל). משתמשת
// בכתובת שכבר הוקלדה בטופס ההתחברות עצמו.
window.handleForgotPassword = async function() {
    const emailInput = document.getElementById('login-email');
    const email = emailInput ? emailInput.value.trim() : '';
    const msgEl = document.getElementById('forgot-password-msg');

    if (!msgEl) return;

    if (!email) {
        msgEl.className = 'forgot-password-msg error';
        msgEl.innerText = "נא להזין קודם את כתובת האימייל שלך בשדה שלמעלה, ואז ללחוץ שוב על \u2018שכחת סיסמה?\u2019.";
        return;
    }

    msgEl.className = 'forgot-password-msg';
    msgEl.innerText = "שולחת...";

    try {
        await sendPasswordResetEmail(auth, email);
        msgEl.className = 'forgot-password-msg success';
        msgEl.innerText = "נשלח אימייל לאיפוס סיסמה. בדקי את תיבת הדואר שלך (כולל תיקיית ספאם).";
    } catch (error) {
        console.error("שגיאה בשליחת אימייל איפוס סיסמה:", error);
        msgEl.className = 'forgot-password-msg error';
        msgEl.innerText = "לא הצלחנו לשלוח אימייל. ודאי שהכתובת נכונה ונסי שוב.";
    }
};

// חישוב ברכה לפי שעה
function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "בוקר טוב";
    if (hour >= 12 && hour < 17) return "צהריים טובים";
    if (hour >= 17 && hour < 21) return "ערב טוב";
    return "לילה טוב";
}

// מאזין למצב התחברות
onAuthStateChanged(auth, async (user) => {
    const userLabels = document.querySelectorAll('.user-label');
    
    if (user && user.emailVerified) {
        window.currentUserLoggedIn = true;
        
        // --- 1. טעינת ה-Wishlist של המשתמש מ-Firebase ---
        if (typeof window.loadUserWishlistFromFirebase === 'function') {
            window.loadUserWishlistFromFirebase(user.uid);
        }

        try {
            const docSnap = await getDoc(doc(db, "Users", user.uid));
            if (docSnap.exists()) {
                const userData = docSnap.data();
                window.currentUserData = userData;
                
                const firstName = userData.fullName ? userData.fullName.split(" ")[0] : "אורח";
                const greeting = getGreeting();
                
                userLabels.forEach(label => {
                    label.innerText = `${greeting}, ${firstName}`;
                });

                if (document.getElementById('acc-name')) {
                    document.getElementById('acc-name').value = userData.fullName || "";
                    document.getElementById('acc-phone').value = userData.phone || "";
                    document.getElementById('acc-email').value = userData.email || "";
                }
            }
        } catch (error) {
            console.error("שגיאה בשליפת נתונים:", error);
            userLabels.forEach(label => label.innerText = "מחובר");
        }
    } else {
        window.currentUserLoggedIn = false;
        window.currentUserData = null;
        
        // --- 2. איפוס ה-Wishlist בעת התנתקות/אורח ---
        window.userWishlist = [];
        if (typeof updateWishlistIconsUI === 'function') {
            updateWishlistIconsUI();
        }

        userLabels.forEach(label => label.innerText = "התחברות");
        
        const path = window.location.pathname;
        if (path.includes('account.html') || path.includes('account-details.html')) {
            window.location.href = 'index.html';
        }
    }
});
document.addEventListener('DOMContentLoaded', () => {
    // --- Helper function for showing/hiding spec boxes on focus ---
    const setupFieldRules = (inputId, rulesBoxId) => {
        const input = document.getElementById(inputId);
        const rulesBox = document.getElementById(rulesBoxId);
        if (!input || !rulesBox) return;

        input.addEventListener('focus', () => rulesBox.classList.add('visible'));
        input.addEventListener('blur', () => {
            if (!input.value.trim()) {
                rulesBox.classList.remove('visible');
            }
        });
    };

    setupFieldRules('reg-email', 'email-rules');
    setupFieldRules('reg-phone', 'phone-rules');
    setupFieldRules('reg-password', 'password-rules');

    // --- Live Email Validation ---
    const regEmail = document.getElementById('reg-email');
    if (regEmail) {
        regEmail.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const ruleEmail = document.getElementById('rule-email-format');
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

            ruleEmail.className = isValid ? 'rule valid' : 'rule invalid';
            ruleEmail.innerText = isValid ? '✔ כתובת אימייל תקינה' : '✖ כתובת אימייל תקינה (למשל: name@example.com)';
        });
    }

    // --- Live Phone Validation ---
    const regPhone = document.getElementById('reg-phone');
    if (regPhone) {
        regPhone.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            const rulePhone = document.getElementById('rule-phone-format');
            const isValid = /^05\d[-]?\d{7}$/.test(val);

            rulePhone.className = isValid ? 'rule valid' : 'rule invalid';
            rulePhone.innerText = isValid ? '✔ מספר נייד תקין' : '✖ מספר נייד תקין להתקשרות (למשל: 0501234567)';
        });
    }

    // --- Live Password Validation ---
    const regPassword = document.getElementById('reg-password');
    if (regPassword) {
        regPassword.addEventListener('input', (e) => {
            const val = e.target.value;

            // 1. Length rule (at least 6)
            const ruleLength = document.getElementById('rule-pass-length');
            const isLengthValid = val.length >= 6;
            ruleLength.className = isLengthValid ? 'rule valid' : 'rule invalid';
            ruleLength.innerText = isLengthValid ? '✔ לפחות 6 תווים' : '✖ לפחות 6 תווים';

            // 2. Capital letter rule (at least one uppercase A-Z)
            const ruleCapital = document.getElementById('rule-pass-capital');
            const hasCapital = /[A-Z]/.test(val);
            ruleCapital.className = hasCapital ? 'rule valid' : 'rule invalid';
            ruleCapital.innerText = hasCapital ? '✔ לפחות אות אנגלית גדולה אחת (A-Z)' : '✖ לפחות אות אנגלית גדולה אחת (A-Z)';

            // 3. Symbol rule (at least 1 special character)
            const ruleSymbol = document.getElementById('rule-pass-symbol');
            const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val);
            ruleSymbol.className = hasSymbol ? 'rule valid' : 'rule invalid';
            ruleSymbol.innerText = hasSymbol ? '✔ לפחות סמל מיוחד אחד (!@#$%^&*)' : '✖ לפחות סמל מיוחד אחד (!@#$%^&*)';
        });
    }
});
window.handleLogout = async function() {
    try {
        await signOut(auth);
        window.currentUserLoggedIn = false;
        window.currentUserData = null;
        window.location.href = "index.html";
    } catch (error) {
        console.error("שגיאה בהתנתקות:", error);
    }
};
// פתיחת מודאל אישור המחיקה
window.handleDeleteAccount = function() {
    const overlay = document.getElementById('delete-modal-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
};

// סגירת מודאל אישור המחיקה
window.closeDeleteModal = function() {
    const overlay = document.getElementById('delete-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
};

// ביצוע המחיקה בפועל עם אנימציית טעינה ו-V
window.executeAccountDeletion = async function() {
    const user = auth.currentUser;
    const deleteBtn = document.getElementById('confirm-delete-btn');
    const deleteMsg = document.getElementById('delete-msg');

    if (!user || !deleteBtn) return;

    // 1. הפעלת מצב טעינה (Spinner)
    deleteBtn.classList.add('loading');
    deleteBtn.disabled = true;

    try {
        // מחיקת כל התורים ששייכים לחשבון הזה, לפני מחיקת החשבון עצמו - כדי
        // שלא יישארו תורים "יתומים" ששייכים למשתמש שכבר לא קיים
        const appointmentsQuery = query(collection(db, 'Appointments'), where('userId', '==', user.uid));
        const appointmentsSnap = await getDocs(appointmentsQuery);
        if (!appointmentsSnap.empty) {
            const batch = writeBatch(db);
            appointmentsSnap.forEach(docSnap => batch.delete(docSnap.ref));
            await batch.commit();
        }

        // מחיקה מ-Firestore
        await deleteDoc(doc(db, "Users", user.uid));

        // מחיקה מ-Firebase Authentication
        await deleteUser(user);

        // 2. מעבר למצב הצלחה (הצגת V ירוק)
        deleteBtn.classList.remove('loading');
        deleteBtn.classList.add('success');

        // השהייה קצרה לראות את ה-✔ לפני המעבר דף
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);

    } catch (error) {
        console.error("שגיאה במחיקת החשבון:", error);
        
        // איפוס הכפתור במקרה של שגיאה
        deleteBtn.classList.remove('loading');
        deleteBtn.disabled = false;
        closeDeleteModal();

        if (deleteMsg) {
            deleteMsg.style.color = "#d9534f";
            if (error.code === 'auth/requires-recent-login') {
                deleteMsg.innerText = "מטעמי אבטחה, עליך להתחבר מחדש לפני מחיקת החשבון.";
            } else {
                deleteMsg.innerText = "שגיאה במחיקת החשבון: " + error.message;
            }
        }
    }
    
};
