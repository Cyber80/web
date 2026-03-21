function sendMessage() {
    const userInput = document.getElementById('user-input').value;
    const chatBox = document.getElementById('chat-box');
    // แสดงข้อความจากผู้ใช้
    chatBox.innerHTML += `<div>User: ${userInput}</div>`;
    
    // เคลียร์ช่องกรอก
    document.getElementById('user-input').value = '';
    
    // เรียก API หรือฟังก์ชันที่ติดต่อกับ AI
    getResponse(userInput);
}
function getResponse(input) {
    // จำลองการตอบกลับจาก AI (คุณควรดำเนินการกับ API ของโมเดล AI ที่คุณใช้งานจริง)
    const response = "นี่คือการตอบกลับจาก AI";  // ในส่วนนี้คุณจะเรียก API ของ AI
    const chatBox = document.getElementById('chat-box');
    chatBox.innerHTML += `<div>AI: ${response}</div>`;
}