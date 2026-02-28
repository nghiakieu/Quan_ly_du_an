import smtplib
from email.message import EmailMessage
from app.core.config import settings

def send_reset_password_email(email_to: str, reset_token: str) -> bool:
    """
    Send an email containing the password reset token.
    Uses SMTP settings from the application configuration.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("[Email] Email sending skipped - SMTP credentials not configured.")
        return False

    try:
        msg = EmailMessage()
        msg['Subject'] = 'Khôi phục Mật khẩu Quản lý Dự án'
        msg['From'] = settings.SMTP_USER
        msg['To'] = email_to

        content = f"""
        Xin chào,
        
        Chúng tôi nhận được yêu cầu khôi phục mật khẩu tài khoản của bạn trên hệ thống Quản lý Tiến độ Dự án.
        Mã số để khôi phục mật khẩu của bạn là: 

        {reset_token}
        
        Mã này có hiệu lực trong 15 phút. Vui lòng nhập mã này trên ứng dụng cùng với mật khẩu mới của bạn.
        Nếu bạn không yêu cầu thay đổi mật khẩu, vui lòng bỏ qua email này.

        Trân trọng,
        Hệ thống Quản lý Tiến độ Dự án
        """
        
        msg.set_content(content)

        # Assuming Gmail SMTP requires TLS
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            
        return True
    except Exception as e:
        print(f"[Email Error] Failed to send email to {email_to}: {e}")
        return False
