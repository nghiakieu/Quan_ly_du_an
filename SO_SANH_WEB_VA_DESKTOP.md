# CẬP NHẬT: TẠI SAO WEB APP LÀ LỰA CHỌN TỐI ƯU

> **Ghi chú**: Dựa trên yêu cầu mới nhất: "Không tương tác AutoCAD, chỉ truy xuất Excel, tập trung vào Báo cáo và Chia sẻ".

## 1. Thay đổi cốt lõi
Yếu tố "Rào cản lớn nhất" của Web App là **Tương tác AutoCAD** đã được loại bỏ. Điều này thay đổi hoàn toàn cục diện so sánh.

| Tiêu chí | 🖥️ Desktop App | 🌐 Web App (Kiến trúc mới) |
| :--- | :--- | :--- |
| **Chia sẻ thông tin** | ❌ **Rất khó**: Phải gửi file qua Zalo/Email. Người nhận phải cài phần mềm mới xem được. Dữ liệu không đồng bộ. | ✅ **Tuyệt vời**: Chỉ cần gửi 1 đường Link. Mọi người (Sếp, Kỹ sư, TVGS) đều xem được tức thì trên điện thoại/máy tính bảng. |
| **Cập nhật dữ liệu** | ⚠️ **Thủ công**: Mỗi người giữ 1 file Excel riêng. Khó tổng hợp báo cáo chung. | ✅ **Real-time**: Dữ liệu tập trung 1 chỗ. Khi Import Excel mới lên, tất cả biểu đồ của mọi người đều tự động cập nhật. |
| **Truy cập** | 🔒 Chỉ xem được trên máy tính cài sẵn phần mềm. | 🌍 Xem mọi lúc mọi nơi (Họp giao ban, Đi hiện trường, Ở nhà). |
| **Phát triển** | � Python GUI (Tkinter) khó làm giao diện đẹp, hiện đại. | 🚀 Web Technology (React/Next.js) cho giao diện cực đẹp, dashboard chuyên nghiệp, biểu đồ tương tác xịn xò. |

## 2. Kiến trúc Đề xuất (Modern Web Automation)

Để đáp ứng nhu cầu "Truy xuất Excel -> Báo cáo -> Chia sẻ", em đề xuất kiến trúc sau:

### Backend (Xử lý dữ liệu)
- **Công nghệ**: Python (FastAPI hoặc Django).
- **Lý do**: Tận dụng lại toàn bộ logic xử lý Excel (`pandas`, `openpyxl`) mà anh đã có. Python xử lý số liệu xây dựng là số 1.
- **Database**: PostgreSQL (hoặc SQLite cho bản nhẹ). Lưu trữ dữ liệu tập trung thay vì file rời rạc.

### Frontend (Giao diện người dùng)
- **Công nghệ**: ReactJS (hoặc Next.js).
- **Tính năng**:
    - **Dashboard**: Biểu đồ tròn (Tỷ lệ hoàn thành), Biểu đồ cột (Sản lượng theo tuần/tháng).
    - **Table View**: Xem chi tiết khối lượng, lọc theo Hạng mục/Trụ/Nhịp.
    - **Mobile View**: Tối ưu để xem trên điện thoại khi đi công trường.

## 3. Lộ trình Triển khai nhanh

1.  **Dùng lại Logic cũ**: Copy phần code đọc Excel từ App cũ sang Backend mới.
2.  **Dựng Database**: Thiết kế bảng để lưu trữ các đầu mục công việc (Trụ, Dầm, Bệ...).
3.  **Dựng Web**: Làm trang Dashboard đơn giản trước -> Upload Excel -> Hiển thị biểu đồ.
4.  **Deploy**: Đưa lên một server nhỏ (hoặc máy chủ nội bộ) để mọi người truy cập.

## Kết luận
Chuyển sang **Web App** là quyết định **CHÍNH XÁC** với nhu cầu hiện tại. Nó giải quyết triệt để bài toán "Chia sẻ" và "Theo dõi đánh giá" mà Desktop App đang gặp khó khăn.
