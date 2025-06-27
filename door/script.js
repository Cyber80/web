document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.button-group button');
    const statusMessage = document.getElementById('status-message');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const command = button.dataset.command; // ดึงค่าจาก data-command attribute
            sendCommandToESP32(command);
        });
    });

    function sendCommandToESP32(command) {
        statusMessage.textContent = `กำลังส่งคำสั่ง: ${command}...`;
        
        // ส่งคำสั่ง HTTP GET ไปยัง ESP32
        // ตัวอย่าง: ถ้า command คือ 'open', จะเรียกไปยัง /open
        fetch(`/${command}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text(); // หรือ response.json() ถ้า ESP32 ส่ง JSON กลับมา
            })
            .then(data => {
                statusMessage.textContent = `ESP32 ตอบกลับ: ${data}`;
                console.log('ESP32 Response:', data);
            })
            .catch(error => {
                statusMessage.textContent = `เกิดข้อผิดพลาด: ${error.message}`;
                console.error('Error sending command:', error);
            });
    }
});