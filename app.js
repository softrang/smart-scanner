
const $ = id => document.getElementById(id);

const isMobile = new URLSearchParams(location.search).has("room");

const roomFromUrl = new URLSearchParams(location.search).get("room");

let db = null;
let room = "";
let stream = null;
let pages = [];
let roomRef = null;


// Firebase Configuration Check
function validConfig() {
    const config = window.FIREBASE_CONFIG;

    return Boolean(
        config &&
        config.apiKey &&
        config.authDomain &&
        config.projectId &&
        config.appId &&
        config.databaseURL
    );
}


// Firebase Initialize
function initFirebase() {
    if (!validConfig()) {
        $("status").textContent =
            "Firebase Configuration অসম্পূর্ণ";

        if (isMobile) {
            $("mobileInfo").textContent =
                "Firebase Configuration পরীক্ষা করুন।";
        }

        return Promise.reject(
            new Error("Firebase config missing")
        );
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(window.FIREBASE_CONFIG);
    }

    return firebase.auth()
        .signInAnonymously()
        .then(() => {
            db = firebase.database();
            console.log("Firebase connected successfully");
        })
        .catch(error => {
            console.error("Firebase initialization error:", error);
            throw error;
        });
}


// Page Mode
function showPageMode() {

    if (isMobile) {

        $("desktop").hidden = true;

        $("pagesPanel").hidden = true;

        $("mobile").hidden = false;

        $("mobileInfo").textContent =
            "Room: " + roomFromUrl;

    } else {

        $("mobile").hidden = true;

        $("desktop").hidden = false;

    }

}

showPageMode();


// Initialize
initFirebase()
    .then(() => {

        if (isMobile) {

            room = roomFromUrl;

        } else {

            newDesktopRoom();

        }

    })
    .catch(error => {

        console.error(error);

    });


// Create New Desktop QR Room
function newDesktopRoom() {

    if (roomRef) {

        roomRef.off();

    }

    room = "room-" +
        Math.random().toString(36).substring(2, 12);

    $("roomText").textContent = room;

    $("qr").innerHTML = "";

    const joinUrl = new URL(location.href);

    joinUrl.search = "?room=" + encodeURIComponent(room);

    new QRCode($("qr"), {

        text: joinUrl.toString(),

        width: 220,

        height: 220

    });

    $("status").textContent = "Firebase সংযুক্ত";

    roomRef = db.ref("rooms/" + room + "/incoming");

    roomRef.on("child_added", snapshot => {

        const data = snapshot.val();

        if (!data || !data.image) return;

        const img = new Image();

        img.onload = () => {

            const canvas = document.createElement("canvas");

            canvas.width = img.naturalWidth;

            canvas.height = img.naturalHeight;

            canvas.getContext("2d")
                .drawImage(img, 0, 0);

            pages.push(canvas);

            renderPages();

            snapshot.ref.remove();

        };

        img.src = data.image;

    });

}


// New QR Button
$("newRoom").onclick = () => {

    newDesktopRoom();

};


// Start Camera
$("start").onclick = async () => {

    try {

        stream = await navigator.mediaDevices.getUserMedia({

            video: {

                facingMode: {
                    ideal: "environment"
                },

                width: {
                    ideal: 2560
                },

                height: {
                    ideal: 1920
                }

            },

            audio: false

        });

        $("video").srcObject = stream;

        await $("video").play();

        $("start").disabled = true;

        $("capture").disabled = false;

        $("stop").disabled = false;

    } catch (error) {

        alert(
            "ক্যামেরা চালু হয়নি। Camera Permission Allow করুন।"
        );

        console.error(error);

    }

};


// Stop Camera
$("stop").onclick = () => {

    if (stream) {

        stream.getTracks().forEach(track => {

            track.stop();

        });

    }

    stream = null;

    $("video").srcObject = null;

    $("start").disabled = false;

    $("capture").disabled = true;

    $("stop").disabled = true;

};


// Capture Image
$("capture").onclick = () => {

    const video = $("video");

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;

    canvas.height = video.videoHeight;

    canvas.getContext("2d")
        .drawImage(video, 0, 0);

    sendImage(canvas);

};


// Upload Image Button
$("upload").onclick = () => {

    $("file").click();

};


// Gallery Image
$("file").onchange = event => {

    const file = event.target.files[0];

    if (!file) return;

    const img = new Image();

    img.onload = () => {

        const canvas = document.createElement("canvas");

        canvas.width = img.naturalWidth;

        canvas.height = img.naturalHeight;

        canvas.getContext("2d")
            .drawImage(img, 0, 0);

        sendImage(canvas);

        URL.revokeObjectURL(img.src);

    };

    img.src = URL.createObjectURL(file);

    event.target.value = "";

};


// Send Image to Firebase
async function sendImage(canvas) {

    if (!db) {

        alert("Firebase সংযোগ নেই");

        return;

    }

    const imageData = canvas.toDataURL(
        "image/jpeg",
        0.80
    );

    if (imageData.length > 8 * 1024 * 1024) {

        alert(
            "ছবিটি অনেক বড়। ছোট ছবি ব্যবহার করুন।"
        );

        return;

    }

    try {

        await db.ref(
            "rooms/" + roomFromUrl + "/incoming"
        ).push({

            image: imageData,

            createdAt: Date.now()

        });

        $("mobileInfo").textContent =
            "ছবি কম্পিউটারে পাঠানো হয়েছে!";

    } catch (error) {

        alert("ছবি পাঠানো যায়নি");

        console.error(error);

    }

}


// Render Pages
function renderPages() {

    $("pages").innerHTML = "";

    $("count").textContent =
        pages.length + " page";

    pages.forEach((canvas, index) => {

        const box = document.createElement("div");

        box.className = "page";

        const img = document.createElement("img");

        img.src = canvas.toDataURL(
            "image/jpeg",
            0.92
        );

        const label = document.createElement("p");

        label.textContent =
            "পৃষ্ঠা " + (index + 1);

        const del = document.createElement("button");

        del.textContent = "মুছুন";

        del.onclick = () => {

            pages.splice(index, 1);

            renderPages();

        };

        box.append(img, label, del);

        $("pages").append(box);

    });


    if (pages.length === 0) {

        $("pages").innerHTML =
            '<div class="empty">এখনো কোনো পৃষ্ঠা নেই</div>';

    }


    ["pdf", "jpg", "print", "clear"].forEach(id => {

        $(id).disabled = pages.length === 0;

    });

}


// Clear Pages
$("clear").onclick = () => {

    pages = [];

    renderPages();

};


// Download JPG
$("jpg").onclick = () => {

    const canvas = pages[pages.length - 1];

    const link = document.createElement("a");

    link.href = canvas.toDataURL("image/jpeg", 0.95);

    link.download = "scan.jpg";

    link.click();

};


// Create Multi-page PDF
$("pdf").onclick = () => {

    if (!window.jspdf) {

        alert("PDF Library লোড হয়নি");

        return;

    }

    const { jsPDF } = window.jspdf;

    const paper = $("paper").value;

    const dimensions = paper === "A3"
        ? [297, 420]
        : [210, 297];

    const pdf = new jsPDF({

        orientation: "portrait",

        unit: "mm",

        format: paper

    });


    pages.forEach((canvas, index) => {

        if (index > 0) {

            pdf.addPage(paper, "portrait");

        }

        const ratio =
            canvas.width / canvas.height;

        let width = dimensions[0];

        let height = dimensions[1];

        if (ratio > width / height) {

            height = width / ratio;

        } else {

            width = height * ratio;

        }

        const x = (dimensions[0] - width) / 2;

        const y = (dimensions[1] - height) / 2;

        pdf.addImage(

            canvas.toDataURL("image/jpeg", 0.94),

            "JPEG",

            x,

            y,

            width,

            height

        );

    });

    pdf.save("A3-Smart-Scanner.pdf");

};


// Print
$("print").onclick = () => {

    const printWindow = window.open("", "_blank");

    if (!printWindow) {

        alert("Pop-up অনুমতি দিন");

        return;

    }

    const images = pages.map(canvas => {

        return `
            <img src="${canvas.toDataURL("image/jpeg", 0.94)}">
        `;

    }).join("");


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>Print Scanner</title>

            <style>

                @page {

                    size: ${$("paper").value};

                    margin: 0;

                }

                body {

                    margin: 0;

                }

                img {

                    width: 100%;

                    height: 100vh;

                    object-fit: contain;

                    page-break-after: always;

                }

            </style>

        </head>

        <body>

            ${images}

            <script>

                window.onload = () => window.print();

            <\/script>

        </body>

        </html>

    `);

    printWindow.document.close();

};
