# Products Management

Ứng dụng quản lý và bán sản phẩm công nghệ được xây dựng bằng Node.js, Express, MongoDB và Pug. Dự án có giao diện khách hàng, trang quản trị, đăng nhập tài khoản, OAuth Google/GitHub, giỏ hàng, đặt hàng, đánh giá sản phẩm, chat realtime và upload ảnh qua Cloudinary.

## Mục Lục

- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt](#cài-đặt)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Chạy dự án](#chạy-dự-án)
- [Seed dữ liệu](#seed-dữ-liệu)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Các route chính](#các-route-chính)
- [Scripts](#scripts)
- [Deploy](#deploy)
- [Ghi chú bảo mật](#ghi-chú-bảo-mật)
- [License](#license)

## Tính Năng

### Khách hàng

- Xem danh sách sản phẩm, danh mục sản phẩm và chi tiết sản phẩm.
- Tìm kiếm sản phẩm.
- Đăng ký, đăng nhập, đăng xuất.
- Đăng nhập bằng Google và GitHub.
- Quên mật khẩu, xác thực OTP và đặt lại mật khẩu qua email.
- Cập nhật thông tin cá nhân và ảnh đại diện.
- Thêm, cập nhật, xóa sản phẩm trong giỏ hàng.
- Đặt hàng và xem trang đặt hàng thành công.
- Bình luận, đánh giá, sửa và xóa đánh giá sản phẩm.
- Chat realtime giữa người dùng bằng Socket.IO.

### Quản trị

- Đăng nhập quản trị.
- Dashboard và thống kê.
- Quản lý sản phẩm.
- Quản lý danh mục sản phẩm.
- Quản lý vai trò và phân quyền.
- Quản lý tài khoản quản trị.
- Quản lý người dùng.
- Quản lý bình luận.
- Quản lý thông tin website.
- Refresh token và kiểm tra trạng thái phiên đăng nhập.

## Công Nghệ Sử Dụng

- Runtime: Node.js
- Framework: Express.js
- Template engine: Pug
- Database: MongoDB, Mongoose
- Realtime: Socket.IO
- Authentication: Passport.js, JWT, express-session
- OAuth: Google OAuth 2.0, GitHub OAuth
- Upload ảnh: Multer, Cloudinary
- Email: Nodemailer
- Validation/Security: validator, xss, method-override
- Search: Fuse.js, diacritics

## Yêu Cầu Hệ Thống

- Node.js 18 trở lên
- npm
- MongoDB local hoặc MongoDB Atlas
- Tài khoản Cloudinary nếu dùng upload ảnh
- Gmail App Password nếu dùng chức năng gửi email

## Cài Đặt

Clone repository và cài dependencies:

```bash
git clone <repository-url>
cd products-management
npm install
```

## Cấu Hình Môi Trường

Tạo file `.env` ở thư mục gốc dự án:

```env
NODE_ENV=dev
PORT=3000
MONGGO_URL=mongodb+srv://<user>:<password>@<cluster>/<database>

ACCESS_TOKEN_SECRET=your-access-token-secret
REFRESH_TOKEN_SECRET=your-refresh-token-secret

CLOUD_NAME=your-cloudinary-cloud-name
CLOUD_KEY=your-cloudinary-api-key
CLOUD_SECRET=your-cloudinary-api-secret

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

VNPAY_TMN_CODE=your-vnpay-tmn-code
VNPAY_HASH_SECRET=your-vnpay-hash-secret
```

Ghi chú:

- `MONGGO_URL` là biến đang được code sử dụng để kết nối MongoDB.
- `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` chỉ cần cấu hình nếu dùng đăng nhập Google.
- `GITHUB_CLIENT_ID` và `GITHUB_CLIENT_SECRET` chỉ cần cấu hình nếu dùng đăng nhập GitHub.
- `EMAIL_USER` và `EMAIL_PASS` dùng cho chức năng quên mật khẩu.
- `CLOUD_NAME`, `CLOUD_KEY`, `CLOUD_SECRET` dùng cho chức năng upload ảnh lên Cloudinary.
- Không commit file `.env` lên Git.

## Chạy Dự Án

Chạy server ở môi trường development:

```bash
npm start
```

Sau khi server chạy, truy cập:

- Client: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`

Nếu thay đổi `PORT` trong `.env`, thay `3000` bằng port tương ứng.

## Seed Dữ Liệu

Tạo hoặc cập nhật tài khoản admin:

```bash
npm run seed:admin
```

Tài khoản admin mặc định của script này:

- Email: `dluu57328@gmail.com`
- Password: `@Luu123456`

Seed dữ liệu demo đầy đủ:

```bash
npm run seed:data
```

Script này tạo dữ liệu mẫu gồm danh mục, sản phẩm, người dùng, bình luận, giỏ hàng, đơn hàng và chat. Tài khoản demo sau khi chạy `seed:data`:

- Admin email: `dluu57328@gmail.com`
- Admin password: `123`
- Demo user email: `customer@example.com`
- Demo user password: `123`

Nên đổi thông tin tài khoản seed trước khi dùng ở môi trường production.

## Cấu Trúc Thư Mục

```text
products-management/
|-- config/              # Cấu hình database, passport, path hệ thống
|-- controllers/         # Controller cho admin và client
|-- helpers/             # Helper xử lý JWT, upload, email, phân trang, search...
|-- middlewares/         # Middleware xác thực, validate, thông tin user/cart/setting
|-- models/              # Mongoose models
|-- public/              # Static assets
|-- routes/              # Route admin và client
|-- scripts/             # Script seed dữ liệu
|-- socket/              # Socket.IO handlers
|-- validates/           # Validate request
|-- views/               # Pug templates
|-- index.js             # Entry point của ứng dụng
|-- package.json
`-- README.md
```

## Các Route Chính

### Client

- `GET /` - Trang chủ.
- `GET /products` - Danh sách sản phẩm.
- `GET /products/detail/:slugProduct` - Chi tiết sản phẩm.
- `GET /products/:slugCategory` - Sản phẩm theo danh mục.
- `GET /search` - Tìm kiếm sản phẩm.
- `GET /cart` - Giỏ hàng.
- `POST /cart/add/:productId` - Thêm sản phẩm vào giỏ hàng.
- `GET /checkout` - Trang thanh toán.
- `POST /checkout/order` - Tạo đơn hàng.
- `GET /user/register` - Đăng ký.
- `GET /user/login` - Đăng nhập.
- `GET /user/auth/google` - Đăng nhập Google.
- `GET /user/auth/github` - Đăng nhập GitHub.
- `GET /chat` - Chat realtime.

### Admin

- `GET /admin` - Trang đăng nhập admin.
- `GET /admin/dashboard` - Dashboard.
- `GET /admin/products` - Quản lý sản phẩm.
- `GET /admin/products-category` - Quản lý danh mục.
- `GET /admin/roles` - Quản lý vai trò.
- `GET /admin/accounts` - Quản lý tài khoản admin.
- `GET /admin/users` - Quản lý người dùng.
- `GET /admin/comments` - Quản lý bình luận.
- `GET /admin/setting/general` - Cấu hình website.

## Scripts

```bash
npm start
```

Chạy server bằng Nodemon.

```bash
npm run seed:admin
```

Tạo hoặc cập nhật tài khoản admin mặc định.

```bash
npm run seed:data
```

Tạo dữ liệu demo đầy đủ.

```bash
npm test
```

Hiện tại dự án chưa cấu hình test runner.

## Deploy

Dự án có sẵn file cấu hình:

- `render.yaml` cho Render.
- `vercel.json` cho Vercel.

Khi deploy, cần cấu hình đầy đủ biến môi trường trên nền tảng deploy:

- `NODE_ENV`
- `PORT`
- `MONGGO_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CLOUD_NAME`
- `CLOUD_KEY`
- `CLOUD_SECRET`
- `EMAIL_USER`
- `EMAIL_PASS`
- Các biến OAuth nếu dùng Google/GitHub.

Với môi trường production, đặt:

```env
NODE_ENV=production
```

Nếu dùng `render.yaml`, kiểm tra lại tên biến JWT trước khi deploy. Code hiện đọc `ACCESS_TOKEN_SECRET` và `REFRESH_TOKEN_SECRET`.

## Ghi Chú Bảo Mật

- Không commit `.env`, token, mật khẩu, API key hoặc thông tin tài khoản thật.
- Đổi tài khoản admin mặc định sau khi seed dữ liệu.
- Dùng secret mạnh cho `ACCESS_TOKEN_SECRET` và `REFRESH_TOKEN_SECRET`.
- Dùng Gmail App Password thay vì mật khẩu Gmail thật.
- Giới hạn quyền truy cập Cloudinary API key theo nhu cầu thực tế.
- Kiểm tra lại callback URL của Google/GitHub OAuth khi deploy production.

## License

ISC
