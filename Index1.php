<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>รายการไฟล์และโฟลเดอร์</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            color: #333;
            margin: 20px;
        }
        .container {
            max-width: 800px;
            margin: auto;
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #0056b3;
            text-align: center;
        }
        ul {
            list-style-type: none;
            padding: 0;
        }
        li {
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        li:last-child {
            border-bottom: none;
        }
        .file-icon, .folder-icon {
            margin-right: 10px;
            font-size: 1.2em;
        }
        .folder-icon {
            color: #f7d268;
        }
        .file-icon {
            color: #5bc0de;
        }
        a {
            text-decoration: none;
            color: #007bff;
            font-weight: bold;
        }
        a:hover {
            color: #0056b3;
            text-decoration: underline;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>รายการไฟล์และโฟลเดอร์ใน root directory</h1>
    <ul>
        <?php
        $directory = './'; // กำหนดไดเรกทอรีปัจจุบัน
        $items = scandir($directory);

        foreach ($items as $item) {
            // ละเว้น . และ .. ซึ่งหมายถึงไดเรกทอรีปัจจุบันและไดเรกทอรีแม่
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $directory . $item;
            $link_url = htmlspecialchars($item, ENT_QUOTES, 'UTF-8');
            $icon = '';
            
            // ตรวจสอบว่าเป็นไฟล์หรือโฟลเดอร์เพื่อแสดงไอคอนที่เหมาะสม
            if (is_dir($path)) {
                $icon = '<span class="folder-icon">&#x1F4C1;</span>'; // ไอคอนโฟลเดอร์
            } else {
                $icon = '<span class="file-icon">&#x1F4C4;</span>'; // ไอคอนไฟล์
            }

            echo "<li>$icon <a href=\"$link_url\">$item</a></li>";
        }
        ?>
    </ul>
</div>

</body>
</html>
