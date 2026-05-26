import dns from 'dns';
import md5 from 'md5';
import { config } from 'dotenv';
import { disconnect } from 'mongoose';

import { mongooseConnect } from '../config/database.js';
import Account from '../models/account.model.js';
import Cart from '../models/cart.model.js';
import Chat from '../models/chat.model.js';
import Comment from '../models/comment.model.js';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import ProductCategory from '../models/product-category.model.js';
import Role from '../models/role.model.js';
import RoomChat from '../models/room-chat.model.js';
import SettingGeneral from '../models/setting-general.model.js';
import User from '../models/user.model.js';

config();

if (process.env.NODE_ENV === 'dev') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const ADMIN_EMAIL = 'dluu57328@gmail.com';
const ADMIN_PASSWORD = '123';
const USER_PASSWORD = '123';

const ADMIN_PERMISSIONS = [
    'products-category_view',
    'products-category_create',
    'products-category_edit',
    'products-category_delete',
    'products_view',
    'products_create',
    'products_edit',
    'products_delete',
    'roles_view',
    'roles_create',
    'roles_edit',
    'roles_delete',
    'roles_permissions',
    'accounts_view',
    'accounts_create',
    'accounts_edit',
    'accounts_delete',
    'users_view',
    'users_create',
    'users_edit',
    'users_delete',
    'comments_view',
    'comments_create',
    'comments_edit',
    'comments_delete',
    'setting'
];

const categoryColors = {
    Laptop: ['dbeafe', '111827'],
    'Điện thoại': ['dcfce7', '052e16'],
    'Máy tính bảng': ['fef3c7', '422006'],
    'Màn hình': ['e0f2fe', '082f49'],
    'Bàn phím': ['ede9fe', '2e1065'],
    Chuột: ['fae8ff', '4a044e'],
    'Tai nghe': ['fee2e2', '450a0a'],
    Loa: ['fce7f3', '500724'],
    'Thiết bị mạng': ['ccfbf1', '042f2e'],
    'Ổ cứng & lưu trữ': ['e2e8f0', '0f172a'],
    'Phụ kiện sạc': ['ffedd5', '431407'],
    'Camera & webcam': ['f1f5f9', '020617']
};

function placeholder(label, categoryTitle = 'Laptop') {
    const [background, text] = categoryColors[categoryTitle] || ['e5e7eb', '111827'];
    return `https://placehold.co/600x400/${background}/${text}?text=${encodeURIComponent(label)}`;
}

function category(title, position, description) {
    return {
        title,
        description,
        thumbnail: placeholder(title, title),
        public_id: '',
        status: 'active',
        position
    };
}

function product(title, categoryTitle, price, discountPercentage, stock, featured, position, description) {
    return {
        title,
        categoryTitle,
        description,
        price,
        discountPercentage,
        stock,
        thumbnail: placeholder(title, categoryTitle),
        public_id: '',
        status: 'active',
        featured,
        position
    };
}

function user(fullName, email, phone, address) {
    return {
        fullName,
        email,
        password: md5(USER_PASSWORD),
        address,
        phone,
        public_id: '',
        avatar: '/images/avatar.jpg',
        status: 'active',
        deleted: false,
        refreshToken: null,
        refreshTokenExpires: null
    };
}

const seedCategories = [
    category('Laptop', 12, 'Laptop văn phòng, gaming và ultrabook cho học tập, làm việc.'),
    category('Điện thoại', 11, 'Điện thoại thông minh từ các thương hiệu phổ biến.'),
    category('Máy tính bảng', 10, 'Tablet cho giải trí, học tập, ghi chú và làm việc di động.'),
    category('Màn hình', 9, 'Màn hình văn phòng, đồ họa và gaming tần số quét cao.'),
    category('Bàn phím', 8, 'Bàn phím cơ, bàn phím không dây và phụ kiện gõ phím.'),
    category('Chuột', 7, 'Chuột văn phòng, gaming và thiết bị điều khiển không dây.'),
    category('Tai nghe', 6, 'Tai nghe chống ồn, true wireless và gaming headset.'),
    category('Loa', 5, 'Loa Bluetooth, soundbar và loa để bàn.'),
    category('Thiết bị mạng', 4, 'Router, mesh Wi-Fi, switch và thiết bị mạng gia đình.'),
    category('Ổ cứng & lưu trữ', 3, 'SSD, HDD, thẻ nhớ và ổ lưu trữ di động.'),
    category('Phụ kiện sạc', 2, 'Củ sạc, cáp, dock sạc và pin dự phòng.'),
    category('Camera & webcam', 1, 'Webcam, camera an ninh và thiết bị họp trực tuyến.')
];

const seedProducts = [
    product('MacBook Air M2 13 inch', 'Laptop', 26990000, 8, 18, '1', 80, 'Laptop mỏng nhẹ dùng chip Apple M2, phù hợp học tập và làm việc văn phòng.'),
    product('MacBook Pro 14 M3', 'Laptop', 43990000, 6, 12, '1', 79, 'Máy hiệu năng cao cho lập trình, thiết kế và dựng nội dung.'),
    product('Dell XPS 13 Plus', 'Laptop', 35990000, 10, 10, '1', 78, 'Ultrabook cao cấp với màn hình sắc nét và thiết kế gọn nhẹ.'),
    product('Lenovo ThinkPad X1 Carbon Gen 11', 'Laptop', 39990000, 9, 9, '0', 77, 'Laptop doanh nhân bền bỉ, bàn phím tốt và bảo mật mạnh.'),
    product('ASUS ROG Zephyrus G14', 'Laptop', 42990000, 11, 14, '1', 76, 'Laptop gaming nhỏ gọn, hiệu năng mạnh cho game và sáng tạo nội dung.'),
    product('Acer Aspire 5', 'Laptop', 14500000, 10, 25, '0', 75, 'Laptop phổ thông cân bằng hiệu năng và giá cho nhu cầu hằng ngày.'),
    product('HP Pavilion 14', 'Laptop', 16990000, 7, 21, '0', 74, 'Laptop văn phòng thiết kế thanh lịch, pin ổn và màn hình Full HD.'),
    product('MSI Modern 14', 'Laptop', 14990000, 12, 16, '0', 73, 'Laptop mỏng nhẹ cho sinh viên và nhân viên văn phòng.'),
    product('iPhone 15 128GB', 'Điện thoại', 21990000, 5, 32, '1', 72, 'Điện thoại Apple với camera tốt, hiệu năng ổn định và USB-C.'),
    product('iPhone 15 Pro 256GB', 'Điện thoại', 30990000, 4, 17, '1', 71, 'iPhone cao cấp dùng chip A17 Pro, khung titan và camera chuyên nghiệp.'),
    product('Samsung Galaxy S24', 'Điện thoại', 19990000, 9, 28, '1', 70, 'Flagship Android nhỏ gọn với màn hình đẹp và nhiều tính năng AI.'),
    product('Samsung Galaxy S24 Ultra', 'Điện thoại', 31990000, 8, 13, '1', 69, 'Điện thoại cao cấp với bút S Pen, camera zoom xa và pin lớn.'),
    product('Xiaomi 14', 'Điện thoại', 19990000, 10, 22, '0', 68, 'Smartphone Android hiệu năng cao, sạc nhanh và camera Leica.'),
    product('OPPO Reno11 F', 'Điện thoại', 8990000, 12, 35, '0', 67, 'Điện thoại tầm trung có thiết kế mỏng và camera chân dung đẹp.'),
    product('Google Pixel 8', 'Điện thoại', 17990000, 7, 11, '0', 66, 'Điện thoại Android thuần với camera xử lý ảnh tốt.'),
    product('Nothing Phone 2a', 'Điện thoại', 9990000, 6, 20, '0', 65, 'Điện thoại thiết kế khác biệt, hiệu năng tốt trong phân khúc.'),
    product('iPad Air M2 11 inch', 'Máy tính bảng', 16990000, 7, 19, '1', 64, 'Máy tính bảng mạnh mẽ cho ghi chú, học tập và chỉnh ảnh nhẹ.'),
    product('iPad Pro M4 11 inch', 'Máy tính bảng', 28990000, 5, 8, '1', 63, 'Tablet cao cấp màn hình đẹp, hiệu năng mạnh cho sáng tạo nội dung.'),
    product('Samsung Galaxy Tab S9', 'Máy tính bảng', 19990000, 9, 16, '1', 62, 'Tablet Android chống nước, màn AMOLED và bút S Pen đi kèm.'),
    product('Samsung Galaxy Tab A9 Plus', 'Máy tính bảng', 6990000, 10, 24, '0', 61, 'Máy tính bảng giải trí gia đình với màn hình lớn và loa tốt.'),
    product('Lenovo Tab P12', 'Máy tính bảng', 8990000, 8, 18, '0', 60, 'Tablet màn hình lớn phù hợp học online và xem nội dung.'),
    product('Xiaomi Pad 6', 'Máy tính bảng', 9490000, 12, 20, '0', 59, 'Máy tính bảng Android hiệu năng tốt, màn hình tần số quét cao.'),
    product('Microsoft Surface Pro 9', 'Máy tính bảng', 27990000, 11, 9, '0', 58, 'Thiết bị lai tablet và laptop chạy Windows linh hoạt.'),
    product('Huawei MatePad 11.5', 'Máy tính bảng', 7990000, 9, 15, '0', 57, 'Tablet mỏng nhẹ cho học tập, ghi chú và giải trí.'),
    product('LG UltraGear 27GP850', 'Màn hình', 8490000, 13, 18, '1', 56, 'Màn hình gaming 27 inch QHD, tần số quét cao và màu sắc tốt.'),
    product('Dell UltraSharp U2723QE', 'Màn hình', 13990000, 8, 12, '1', 55, 'Màn hình 4K cho văn phòng, thiết kế và kết nối USB-C tiện lợi.'),
    product('Samsung Odyssey G5 27 inch', 'Màn hình', 6990000, 15, 21, '0', 54, 'Màn hình cong QHD cho gaming và giải trí.'),
    product('ASUS ProArt PA278QV', 'Màn hình', 7990000, 10, 13, '0', 53, 'Màn hình hướng tới thiết kế đồ họa với màu sắc cân chỉnh tốt.'),
    product('AOC 24G2SP', 'Màn hình', 4490000, 14, 27, '0', 52, 'Màn hình gaming 24 inch Full HD, 165Hz, giá dễ tiếp cận.'),
    product('BenQ ScreenBar Halo', 'Màn hình', 3990000, 6, 22, '0', 51, 'Đèn màn hình giúp góc làm việc sáng đều, giảm chói.'),
    product('ViewSonic VX2758A-2K-PRO', 'Màn hình', 5990000, 12, 17, '0', 50, 'Màn hình QHD tần số quét cao cho game và công việc.'),
    product('Gigabyte M27Q', 'Màn hình', 7690000, 11, 15, '0', 49, 'Màn hình 27 inch QHD, phù hợp setup làm việc và chơi game.'),
    product('Keychron K2 Keyboard', 'Bàn phím', 2190000, 8, 40, '1', 48, 'Bàn phím cơ không dây layout gọn, phù hợp Mac và Windows.'),
    product('Keychron K8 Pro', 'Bàn phím', 2890000, 9, 26, '0', 47, 'Bàn phím cơ TKL có hot-swap, QMK/VIA và kết nối Bluetooth.'),
    product('Logitech MX Keys S', 'Bàn phím', 2690000, 7, 35, '1', 46, 'Bàn phím không dây yên tĩnh, gõ thoải mái cho văn phòng.'),
    product('Razer BlackWidow V4', 'Bàn phím', 3990000, 10, 18, '0', 45, 'Bàn phím gaming cơ có đèn RGB và switch phản hồi nhanh.'),
    product('Akko 5075B Plus', 'Bàn phím', 2290000, 12, 30, '0', 44, 'Bàn phím cơ layout 75%, pin tốt và nhiều tùy chọn switch.'),
    product('Leopold FC750R', 'Bàn phím', 3290000, 6, 14, '0', 43, 'Bàn phím cơ TKL chất lượng build tốt và cảm giác gõ ổn định.'),
    product('Corsair K70 RGB Pro', 'Bàn phím', 3690000, 9, 16, '0', 42, 'Bàn phím gaming fullsize với polling rate cao và RGB mạnh.'),
    product('Ducky One 3 Mini', 'Bàn phím', 2990000, 8, 19, '0', 41, 'Bàn phím cơ 60% nhỏ gọn, phù hợp setup tối giản.'),
    product('Logitech MX Master 3S', 'Chuột', 2490000, 5, 50, '1', 40, 'Chuột công thái học cao cấp, cuộn nhanh và làm việc đa thiết bị.'),
    product('Logitech G Pro X Superlight 2', 'Chuột', 3290000, 8, 24, '1', 39, 'Chuột gaming siêu nhẹ cho FPS, cảm biến chính xác.'),
    product('Razer Basilisk V3', 'Chuột', 1690000, 11, 31, '0', 38, 'Chuột gaming có nhiều nút tùy chỉnh và cuộn thông minh.'),
    product('Apple Magic Mouse', 'Chuột', 1990000, 5, 22, '0', 37, 'Chuột cảm ứng tối giản dành cho hệ sinh thái Apple.'),
    product('Microsoft Surface Arc Mouse', 'Chuột', 1890000, 9, 20, '0', 36, 'Chuột di động thiết kế gập phẳng, dễ mang theo.'),
    product('SteelSeries Aerox 3 Wireless', 'Chuột', 2190000, 12, 18, '0', 35, 'Chuột gaming không dây nhẹ, chống nước nhẹ và pin lâu.'),
    product('ASUS ROG Keris Wireless AimPoint', 'Chuột', 2490000, 10, 16, '0', 34, 'Chuột gaming không dây nhẹ, switch thay được và cảm biến tốt.'),
    product('Pulsar X2V2 Mini', 'Chuột', 2690000, 7, 14, '0', 33, 'Chuột gaming form đối xứng nhỏ gọn, trọng lượng nhẹ.'),
    product('Sony WH-1000XM5', 'Tai nghe', 8490000, 12, 18, '1', 32, 'Tai nghe chống ồn đầu bảng, âm thanh tốt và pin dài.'),
    product('AirPods Pro 2 USB-C', 'Tai nghe', 5990000, 6, 30, '1', 31, 'Tai nghe true wireless chống ồn, kết nối tốt với iPhone.'),
    product('Sony WF-1000XM5', 'Tai nghe', 6290000, 9, 17, '0', 30, 'Tai nghe true wireless cao cấp với chống ồn và âm thanh chi tiết.'),
    product('Samsung Galaxy Buds2 Pro', 'Tai nghe', 3990000, 14, 25, '0', 29, 'Tai nghe không dây nhỏ gọn, phù hợp điện thoại Samsung.'),
    product('Jabra Elite 8 Active', 'Tai nghe', 4590000, 10, 19, '0', 28, 'Tai nghe thể thao bền bỉ, chống nước và chống ồn chủ động.'),
    product('HyperX Cloud III Wireless', 'Tai nghe', 3490000, 8, 20, '0', 27, 'Tai nghe gaming không dây, đeo êm và micro rõ.'),
    product('Sennheiser Momentum 4', 'Tai nghe', 7990000, 11, 12, '0', 26, 'Tai nghe over-ear pin rất lâu, âm thanh cân bằng.'),
    product('Marshall Major IV', 'Tai nghe', 3690000, 9, 15, '0', 25, 'Tai nghe on-ear phong cách cổ điển, pin dài và âm ấm.'),
    product('JBL Charge 5', 'Loa', 3990000, 10, 26, '1', 24, 'Loa Bluetooth chống nước, âm lượng lớn và pin tốt.'),
    product('Marshall Emberton II', 'Loa', 4490000, 8, 16, '1', 23, 'Loa di động thiết kế cổ điển, âm thanh mạnh trong thân máy nhỏ.'),
    product('Sony SRS-XB100', 'Loa', 1290000, 12, 33, '0', 22, 'Loa Bluetooth nhỏ gọn, dễ mang theo và chống nước.'),
    product('Bose SoundLink Flex', 'Loa', 3990000, 7, 18, '0', 21, 'Loa Bluetooth cao cấp, âm thanh rõ và chống nước IP67.'),
    product('Harman Kardon Aura Studio 4', 'Loa', 6990000, 9, 10, '0', 20, 'Loa để bàn thiết kế đẹp, phù hợp phòng khách và phòng làm việc.'),
    product('Edifier MR4', 'Loa', 2490000, 6, 21, '0', 19, 'Loa kiểm âm nhỏ gọn cho bàn làm việc và nghe nhạc tại nhà.'),
    product('TP-Link Archer AX55', 'Thiết bị mạng', 2490000, 10, 28, '1', 18, 'Router Wi-Fi 6 ổn định cho căn hộ và gia đình nhiều thiết bị.'),
    product('ASUS RT-AX86U Pro', 'Thiết bị mạng', 5990000, 8, 12, '0', 17, 'Router Wi-Fi 6 hiệu năng cao cho gaming và nhà thông minh.'),
    product('UniFi U6 Lite', 'Thiết bị mạng', 2990000, 7, 18, '0', 16, 'Access point Wi-Fi 6 cho mạng gia đình hoặc văn phòng nhỏ.'),
    product('TP-Link Deco X50 2-Pack', 'Thiết bị mạng', 4990000, 11, 16, '0', 15, 'Bộ mesh Wi-Fi 6 phủ sóng rộng, dễ cấu hình.'),
    product('Mercusys MR80X', 'Thiết bị mạng', 1590000, 9, 24, '0', 14, 'Router Wi-Fi 6 giá tốt cho nhu cầu cơ bản.'),
    product('Switch TP-Link TL-SG108', 'Thiết bị mạng', 650000, 5, 40, '0', 13, 'Switch 8 cổng gigabit vỏ kim loại, phù hợp mở rộng mạng dây.'),
    product('Samsung 990 Pro 1TB', 'Ổ cứng & lưu trữ', 3190000, 12, 30, '1', 12, 'SSD NVMe tốc độ cao cho PC, laptop và máy trạm.'),
    product('WD Black SN850X 2TB', 'Ổ cứng & lưu trữ', 4990000, 10, 18, '0', 11, 'SSD NVMe hiệu năng cao cho game và dựng nội dung.'),
    product('SanDisk Extreme Portable SSD 1TB', 'Ổ cứng & lưu trữ', 3490000, 9, 22, '1', 10, 'Ổ SSD di động nhỏ gọn, chống sốc và truyền dữ liệu nhanh.'),
    product('Seagate Backup Plus 2TB', 'Ổ cứng & lưu trữ', 1990000, 7, 26, '0', 9, 'Ổ cứng di động dung lượng lớn cho sao lưu dữ liệu.'),
    product('Kingston DataTraveler Max 256GB', 'Ổ cứng & lưu trữ', 890000, 8, 35, '0', 8, 'USB tốc độ cao dùng cổng USB-C, gọn nhẹ.'),
    product('Samsung EVO Plus microSD 256GB', 'Ổ cứng & lưu trữ', 590000, 6, 50, '0', 7, 'Thẻ nhớ microSD cho điện thoại, camera và máy chơi game.'),
    product('Anker 737 Charger 120W', 'Phụ kiện sạc', 2490000, 9, 24, '1', 6, 'Củ sạc GaN công suất cao cho laptop, điện thoại và tablet.'),
    product('Apple 20W USB-C Power Adapter', 'Phụ kiện sạc', 590000, 5, 45, '0', 5, 'Củ sạc USB-C chính hãng phù hợp iPhone và iPad.'),
    product('Ugreen Nexode 65W GaN', 'Phụ kiện sạc', 890000, 12, 38, '0', 4, 'Củ sạc GaN nhỏ gọn, nhiều cổng cho thiết bị di động.'),
    product('Anker PowerCore 20000mAh', 'Phụ kiện sạc', 1290000, 10, 31, '0', 3, 'Pin dự phòng dung lượng cao, phù hợp đi làm và du lịch.'),
    product('Belkin BoostCharge Pro 3-in-1', 'Phụ kiện sạc', 3490000, 8, 12, '0', 2, 'Dock sạc không dây cho iPhone, Apple Watch và AirPods.'),
    product('Logitech Brio 4K', 'Camera & webcam', 4490000, 10, 15, '1', 1, 'Webcam 4K cho họp trực tuyến, stream và làm việc từ xa.'),
    product('Elgato Facecam MK.2', 'Camera & webcam', 3990000, 8, 10, '0', 0, 'Webcam chất lượng cao cho streamer và creator.'),
    product('Razer Kiyo Pro', 'Camera & webcam', 3290000, 11, 14, '0', -1, 'Webcam có cảm biến tốt trong điều kiện thiếu sáng.'),
    product('TP-Link Tapo C220', 'Camera & webcam', 890000, 7, 35, '0', -2, 'Camera an ninh trong nhà, quay quét và theo dõi qua ứng dụng.'),
    product('Eufy Indoor Cam 2K', 'Camera & webcam', 1190000, 9, 20, '0', -3, 'Camera trong nhà độ phân giải 2K, hỗ trợ phát hiện chuyển động.'),
    product('Insta360 Link', 'Camera & webcam', 7490000, 6, 8, '0', -4, 'Webcam 4K có gimbal AI tracking cho họp và livestream.')
];

const seedUsers = [
    user('Demo Customer', 'customer@example.com', '0900000001', '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh'),
    user('Sample Buyer', 'buyer@example.com', '0900000002', '45 Lê Lợi, Quận 1, TP. Hồ Chí Minh'),
    user('Nguyễn Minh Anh', 'minhanh@example.com', '0901000003', '18 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội'),
    user('Trần Quốc Huy', 'quochuy@example.com', '0901000004', '22 Nguyễn Văn Cừ, Long Biên, Hà Nội'),
    user('Lê Hoàng Nam', 'hoangnam@example.com', '0901000005', '35 Võ Văn Tần, Quận 3, TP. Hồ Chí Minh'),
    user('Phạm Thu Hà', 'thuha@example.com', '0901000006', '17 Phan Chu Trinh, Hải Châu, Đà Nẵng'),
    user('Võ Gia Bảo', 'giabao@example.com', '0901000007', '91 Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh'),
    user('Đặng Khánh Linh', 'khanhlinh@example.com', '0901000008', '54 Lạch Tray, Ngô Quyền, Hải Phòng'),
    user('Bùi Anh Khoa', 'anhkhoa@example.com', '0901000009', '10 Nguyễn Trãi, Thanh Xuân, Hà Nội'),
    user('Hoàng Mai Chi', 'maichi@example.com', '0901000010', '27 Nguyễn Thị Minh Khai, Quận 1, TP. Hồ Chí Minh'),
    user('Đỗ Nhật Minh', 'nhatminh@example.com', '0901000011', '62 Hai Bà Trưng, Hoàn Kiếm, Hà Nội'),
    user('Ngô Bảo Ngọc', 'baongoc@example.com', '0901000012', '40 Lý Thường Kiệt, Hải Châu, Đà Nẵng'),
    user('Trịnh Tuấn Kiệt', 'tuankiet@example.com', '0901000013', '73 Cách Mạng Tháng 8, Quận 10, TP. Hồ Chí Minh'),
    user('Phan Thanh Tâm', 'thanhtam@example.com', '0901000014', '88 Nguyễn Tri Phương, Quận 5, TP. Hồ Chí Minh'),
    user('Lưu Gia Hân', 'giahan@example.com', '0901000015', '19 Nguyễn Văn Linh, Hải Châu, Đà Nẵng'),
    user('Cao Đức Anh', 'ducanh@example.com', '0901000016', '51 Xuân Thủy, Cầu Giấy, Hà Nội'),
    user('Đinh Hải Yến', 'haiyen@example.com', '0901000017', '23 Trần Phú, Nha Trang, Khánh Hòa'),
    user('Tạ Minh Quân', 'minhquan@example.com', '0901000018', '15 Ba Tháng Hai, Ninh Kiều, Cần Thơ'),
    user('Vũ Phương Nhi', 'phuongnhi@example.com', '0901000019', '64 Pasteur, Quận 1, TP. Hồ Chí Minh'),
    user('Hồ Đức Mạnh', 'ducmanh@example.com', '0901000020', '72 Lê Duẩn, Hải Châu, Đà Nẵng')
];

const reviewSamples = [
    { content: 'Đóng gói cẩn thận, sản phẩm đúng mô tả và dùng ổn định.', rating: 5 },
    { content: 'Hiệu năng tốt trong tầm giá, giao hàng nhanh.', rating: 5 },
    { content: 'Thiết kế đẹp, hoàn thiện chắc chắn, rất đáng mua.', rating: 5 },
    { content: 'Sản phẩm hoạt động tốt, cần thêm thời gian để đánh giá pin.', rating: 4 },
    { content: 'Giá hợp lý, chất lượng đúng kỳ vọng.', rating: 4 },
    { content: 'Dùng cho công việc hằng ngày rất ổn, chưa gặp lỗi.', rating: 4 },
    { content: 'Màu sắc và ngoại hình đẹp hơn hình minh họa.', rating: 5 },
    { content: 'Cấu hình ổn, phù hợp nhu cầu học tập và làm việc.', rating: 4 },
    { content: 'Phụ kiện đi kèm đầy đủ, bảo hành rõ ràng.', rating: 4 },
    { content: 'Trải nghiệm tốt, shop tư vấn nhanh và rõ.', rating: 5 },
    { content: 'Sản phẩm tốt nhưng hộp hơi móp nhẹ khi nhận.', rating: 4 },
    { content: 'Chất lượng ổn, mức giảm giá khá hấp dẫn.', rating: 4 },
    { content: 'Dễ cài đặt, dùng vài ngày thấy ổn định.', rating: 5 },
    { content: 'Tổng thể hài lòng, phù hợp với mô tả trên website.', rating: 4 },
    { content: 'Mua làm quà, người nhận rất thích.', rating: 5 },
    { content: 'Tính năng đủ dùng, giao diện và trải nghiệm tốt.', rating: 4 }
];

async function upsertByQuery(Model, query, data) {
    const record = await Model.findOne(query);

    if (!record) {
        return Model.create(data);
    }

    Object.assign(record, data);
    return record.save();
}

async function ensureAdminAccount() {
    const role = await upsertByQuery(
        Role,
        { title: 'Admin' },
        {
            title: 'Admin',
            description: 'Full access admin role',
            permissions: ADMIN_PERMISSIONS,
            deleted: false,
            deleteAt: undefined
        }
    );

    return upsertByQuery(
        Account,
        { email: ADMIN_EMAIL },
        {
            fullName: 'Admin',
            email: ADMIN_EMAIL,
            password: md5(ADMIN_PASSWORD),
            phone: '',
            avatar: '',
            public_id: '',
            role_id: role.id,
            status: 'active',
            deleted: false,
            deleteAt: undefined,
            refreshToken: null,
            refreshTokenExpires: null
        }
    );
}

async function seedSetting() {
    const data = {
        webSiteName: 'TechStore Demo',
        logo: '/images/avatar.jpg',
        public_id: '',
        phone: '0909 000 888',
        email: 'support@techstore-demo.vn',
        address: 'Quận 1, TP. Hồ Chí Minh',
        copyRight: 'Copyright 2026 TechStore Demo'
    };

    const setting = await SettingGeneral.findOne({});

    if (!setting) {
        return SettingGeneral.create(data);
    }

    Object.assign(setting, data);
    return setting.save();
}

async function seedProductCategories() {
    const categories = {};

    for (const item of seedCategories) {
        const categoryData = {
            ...item,
            parent_id: '',
            deleted: false,
            deleteAt: undefined
        };

        const categoryRecord = await upsertByQuery(ProductCategory, { title: item.title }, categoryData);
        categories[item.title] = categoryRecord;
    }

    return categories;
}

async function seedProductItems(categories, adminAccount) {
    const products = {};

    for (const item of seedProducts) {
        const { categoryTitle, ...productData } = item;
        const categoryRecord = categories[categoryTitle];

        if (!categoryRecord) {
            throw new Error(`Missing seed category for product "${productData.title}": ${categoryTitle}`);
        }

        const productRecord = await upsertByQuery(
            Product,
            { title: productData.title },
            {
                ...productData,
                product_category_id: categoryRecord.id,
                createBy: {
                    account_id: adminAccount.id,
                    createAt: new Date()
                },
                deleted: false,
                deletedBy: undefined,
                updatedBy: []
            }
        );

        products[item.title] = productRecord;
    }

    return products;
}

async function seedClientUsers() {
    const users = {};

    for (const item of seedUsers) {
        const userRecord = await upsertByQuery(
            User,
            { email: item.email },
            {
                ...item,
                friendList: [],
                acceptFriend: [],
                requestFriend: [],
                deleteAt: undefined
            }
        );

        users[item.email] = userRecord;
    }

    return users;
}

async function seedComments(users, products) {
    const userList = Object.values(users);
    const productList = Object.values(products);
    const commentCount = Math.min(80, productList.length);

    for (let index = 0; index < commentCount; index += 1) {
        const currentUser = userList[index % userList.length];
        const currentProduct = productList[index];
        const review = reviewSamples[index % reviewSamples.length];

        await upsertByQuery(
            Comment,
            {
                content: review.content,
                user_id: currentUser.id,
                product_id: currentProduct.id
            },
            {
                content: review.content,
                user_id: currentUser.id,
                product_id: currentProduct.id,
                parent_id: '',
                rating: review.rating,
                status: 'active',
                deleted: false,
                deletedBy: undefined,
                updatedBy: []
            }
        );
    }
}

function pickProducts(productList, startIndex, quantity) {
    const selected = [];

    for (let index = 0; index < quantity; index += 1) {
        selected.push(productList[(startIndex + index) % productList.length]);
    }

    return selected;
}

async function seedCartAndOrder(users, products) {
    const userList = Object.values(users);
    const productList = Object.values(products);
    const carts = [];

    for (let index = 0; index < 10; index += 1) {
        const currentUser = userList[index];
        const selectedProducts = pickProducts(productList, index * 3, 3);

        const cartRecord = await upsertByQuery(
            Cart,
            { user_id: currentUser.id },
            {
                user_id: currentUser.id,
                products: selectedProducts.map((item, productIndex) => ({
                    product_id: item.id,
                    quantity: productIndex + 1
                }))
            }
        );

        carts.push({ cart: cartRecord, user: currentUser });
    }

    for (let index = 0; index < 15; index += 1) {
        const { cart, user: orderUser } = carts[index % carts.length];
        const selectedProducts = pickProducts(productList, 20 + index * 2, 2 + (index % 2));
        const orderProducts = selectedProducts.map((item, productIndex) => ({
            product_id: item.id,
            price: item.price,
            discountPercentage: item.discountPercentage,
            quantity: productIndex + 1
        }));

        await upsertByQuery(
            Order,
            {
                cart_id: cart.id,
                'products.0.product_id': orderProducts[0].product_id
            },
            {
                cart_id: cart.id,
                userInfo: {
                    fullname: orderUser.fullName,
                    phone: orderUser.phone,
                    address: orderUser.address
                },
                products: orderProducts
            }
        );
    }
}

async function seedChat(users) {
    const userList = Object.values(users);
    const roomPairs = [
        [0, 1],
        [2, 3],
        [4, 5],
        [6, 7],
        [8, 9],
        [10, 11]
    ];
    const messageSamples = [
        'Bạn đã xem mẫu laptop mới chưa?',
        'Mình đang cân nhắc thêm màn hình 27 inch.',
        'Shop giao khá nhanh, sản phẩm đóng gói ổn.',
        'Tai nghe chống ồn dùng làm việc rất tiện.',
        'Nếu có khuyến mãi thêm mình sẽ đặt tiếp.'
    ];
    const friendMap = new Map(userList.map(item => [item.id, []]));

    for (const [roomIndex, pair] of roomPairs.entries()) {
        const firstUser = userList[pair[0]];
        const secondUser = userList[pair[1]];
        const roomTitle = `Seed chat ${roomIndex + 1}: ${firstUser.fullName} và ${secondUser.fullName}`;

        const roomRecord = await upsertByQuery(
            RoomChat,
            { title: roomTitle },
            {
                title: roomTitle,
                avatar: '',
                typeRoom: 'friend',
                status: 'active',
                users: [
                    {
                        user_id: firstUser.id,
                        role: 'superAdmin'
                    },
                    {
                        user_id: secondUser.id,
                        role: 'superAdmin'
                    }
                ],
                deleted: false,
                deletedAt: undefined
            }
        );

        friendMap.get(firstUser.id).push({
            user_id: secondUser.id,
            room_chat_id: roomRecord.id
        });
        friendMap.get(secondUser.id).push({
            user_id: firstUser.id,
            room_chat_id: roomRecord.id
        });

        for (let messageIndex = 0; messageIndex < messageSamples.length; messageIndex += 1) {
            const sender = messageIndex % 2 === 0 ? firstUser : secondUser;
            const receiver = sender.id === firstUser.id ? secondUser : firstUser;
            const content = messageSamples[messageIndex];

            await upsertByQuery(
                Chat,
                {
                    room_chat_id: roomRecord.id,
                    user_id: sender.id,
                    content
                },
                {
                    room_chat_id: roomRecord.id,
                    user_id: sender.id,
                    content,
                    images: [],
                    deleted: false,
                    deletedAt: undefined,
                    seenBy: [
                        {
                            user_id: receiver.id,
                            seenAt: new Date()
                        }
                    ],
                    reactions: [],
                    replyTo: undefined,
                    edited: false,
                    editHistory: [],
                    pinned: false,
                    pinnedAt: undefined,
                    pinnedBy: undefined
                }
            );
        }
    }

    for (const currentUser of userList) {
        await User.updateOne(
            { _id: currentUser._id },
            {
                friendList: friendMap.get(currentUser.id) || [],
                acceptFriend: [],
                requestFriend: []
            }
        );
    }
}

async function seedData() {
    const connected = await mongooseConnect();
    if (!connected) {
        process.exitCode = 1;
        return;
    }

    const adminAccount = await ensureAdminAccount();
    await seedSetting();
    const categories = await seedProductCategories();
    const products = await seedProductItems(categories, adminAccount);
    const users = await seedClientUsers();

    await seedComments(users, products);
    await seedCartAndOrder(users, products);
    await seedChat(users);

    console.log('Data seed completed.');
    console.log(`Categories: ${seedCategories.length}`);
    console.log(`Products: ${seedProducts.length}`);
    console.log(`Users: ${seedUsers.length}`);
    console.log('Admin email:', ADMIN_EMAIL);
    console.log('Admin password:', ADMIN_PASSWORD);
    console.log('Demo user email: customer@example.com');
    console.log('Demo user password:', USER_PASSWORD);
}

try {
    await seedData();
} catch (error) {
    console.error('Data seed failed:');
    console.error(error);
    process.exitCode = 1;
} finally {
    await disconnect();
}
