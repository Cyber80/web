document.addEventListener('DOMContentLoaded', function() {
    const mainContent = document.getElementById('main-content');
    const navLinks = document.querySelectorAll('.sidebar ul li a');

    // ฟังก์ชันสำหรับโหลดเนื้อหา
    async function loadContent(pageName) {
        try {
            const response = await fetch(`${pageName}.html`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.text();
            mainContent.innerHTML = data;

            // อัปเดตสถานะ active ของเมนู
            navLinks.forEach(link => {
                if (link.dataset.page === pageName) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
            // อัปเดต URL ใน address bar (ตัวเลือกเสริม)
            history.pushState({ page: pageName }, '', `?page=${pageName}`);

        } catch (error) {
            console.error('Error loading content:', error);
            mainContent.innerHTML = `<h2>ข้อผิดพลาดในการโหลดเนื้อหา</h2><p>ไม่สามารถโหลดหน้า ${pageName} ได้ในขณะนี้ โปรดลองอีกครั้งในภายหลัง</p>`;
        }
    }

    // เพิ่ม event listener ให้กับลิงก์เมนู
    navLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault(); // ป้องกันการโหลดหน้าใหม่ทั้งหมด
            const pageName = this.dataset.page;
            loadContent(pageName);
        });
    });

    // โหลดหน้าเริ่มต้นเมื่อเข้าเว็บครั้งแรก หรือเมื่อมีการกด Back/Forward ในเบราว์เซอร์
    // ตรวจสอบ URL เพื่อโหลดหน้าที่ถูกต้อง
    const urlParams = new URLSearchParams(window.location.search);
    const initialPage = urlParams.get('page') || 'index'; // Default to 'index' if no param
    loadContent(initialPage);

    // จัดการเมื่อผู้ใช้กดปุ่มย้อนกลับ/ไปข้างหน้าของเบราว์เซอร์
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.page) {
            loadContent(event.state.page);
        } else {
            // กรณีที่ไม่มี state (เช่น เข้ามาหน้าแรกโดยตรง)
            loadContent('index');
        }
    });
});