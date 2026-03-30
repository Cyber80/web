// script.js
let pageEditor = document.getElementById('page-editor');
let imageManager = document.getElementById('image-manager');
let formatConverter = document.getElementById('format-converter');

function init() {
    pageEditor.style.display = 'block';
    imageManager.style.display = 'none';
    formatConverter.style.display = 'none';

    // ฟังก์ชันเพิ่ม/ลบหน้า
    function addRemovePage() {
        const pages = document.getElementById('page-editor-container').children;
        if (pages.length > 0) {
            pages[0].remove();
        }
        // วาดแถวและคอลัมน์สำหรับการเขียนข้อความ
        for (let i = 0; i < 10; i++) {
            const row = document.createElement('div');
            row.classList.add('row');
            for (let j = 0; j < 20; j++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                pageEditor.getElementById('page-editor-container').appendChild(cell);
            }
        }
    }

    // ฟังก์ชันเพิ่ม/ลบภาพ
    function addRemoveImage() {
        const images = document.getElementById('image-manager-container').children;
        if (images.length > 0) {
            images[0].remove();
        }
        // วาดแถวและคอลัมน์สำหรับการเลือกและวางภาพ
        for (let i = 0; i < 10; i++) {
            const row = document.createElement('div');
            row.classList.add('row');
            pageEditor.getElementById('page-editor-container').appendChild(row);
        }
    }

    // ฟังก์ชันแปลง PDF เป็น Word
    function convertToWord() {
        alert('Converting to Word...');
    }

    // ฟังก์ชันแปลง PDF เป็นภาพ
    function convertToImage() {
        alert('Converting to Image...');
    }

    document.getElementById('add-page').addEventListener('click', addRemovePage);
    document.getElementById('remove-page').addEventListener('click', addRemovePage);
    document.getElementById('add-image').addEventListener('click', addRemoveImage);
    document.getElementById('remove-image').addEventListener('click', addRemoveImage);
    document.getElementById('convert-to-word').addEventListener('click', convertToWord);
    document.getElementById('convert-to-image').addEventListener('click', convertToImage);

    // ฟังก์ชันเพิ่ม/ลบหน้า
    pageEditor.addEventListener('click', (e) => {
        if (e.target.classList.contains('cell')) {
            e.target.remove();
            addRemovePage();
        }
    });

    // ฟังก์ชันเพิ่ม/ลบภาพ
    imageManager.addEventListener('click', (e) => {
        if (e.target.classList.contains('row')) {
            e.target.remove();
            addRemoveImage();
        }
    });
}

init();
