import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailService:
    """Service for sending branded transactional emails, verification codes, and news digests."""

    @staticmethod
    async def send_email(
        to_email: str,
        subject: str,
        text_content: str,
        html_content: str | None = None
    ) -> bool:
        """Sends email via SMTP or logs to console if SMTP is not configured."""
        is_smtp_configured = bool(settings.SMTP_HOST and settings.SMTP_USER)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject, "utf-8")
        from_name = settings.SMTP_FROM_NAME or "ФСП Оренбургской области"
        from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@fsp56.ru"
        msg["From"] = f"{Header(from_name, 'utf-8').encode()} <{from_email}>"
        msg["To"] = to_email

        # Attach plain text
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        if html_content:
            msg.attach(MIMEText(html_content, "html", "utf-8"))

        if is_smtp_configured and (settings.EMAIL_ENABLED or settings.SMTP_PASSWORD):
            try:
                import aiosmtplib

                await aiosmtplib.send(
                    msg,
                    hostname=settings.SMTP_HOST,
                    port=settings.SMTP_PORT,
                    username=settings.SMTP_USER,
                    password=settings.SMTP_PASSWORD,
                    use_tls=settings.SMTP_USE_SSL,
                    start_tls=settings.SMTP_USE_TLS,
                    timeout=10
                )
                logger.info(f"📧 [EMAIL SENT] Успешно отправлено письмо на {to_email}: «{subject}»")
                return True
            except Exception as e:
                logger.warning(f"⚠️ [SMTP ERROR] Ошибка отправки письма на {to_email}: {e}. Выводим в лог.")

        # Fallback / Dev mode logging
        print("=" * 70)
        print(f"📧 [EMAIL DELIVERY SIMULATION / DEV LOG]")
        print(f"  Кому:    {to_email}")
        print(f"  Тема:    {subject}")
        print(f"  Текст:\n{text_content.strip()}")
        print("=" * 70)
        logger.info(f"📧 [DEV EMAIL] To: {to_email} | Subject: {subject}")
        return True

    @classmethod
    async def send_verification_code_email(
        cls,
        to_email: str,
        code: str,
        purpose: str = "входа в систему",
        expires_minutes: int = 10
    ) -> bool:
        """Sends a 6-digit verification code with official FSP branding."""
        purpose_titles = {
            "login": "входа в личный кабинет",
            "registration": "подтверждения регистрации",
            "email_verify": "подтверждения адреса электронной почты",
            "reset_password": "восстановления пароля",
            "telegram_link": "привязки Telegram-аккаунта"
        }
        purpose_str = purpose_titles.get(purpose, purpose)

        subject = f"Код подтверждения: {code} — ФСП Оренбургской области"

        text_content = (
            f"Здравствуйте!\n\n"
            f"Ваш одноразовый проверочный код для {purpose_str}:\n\n"
            f"  >>>  {code}  <<<\n\n"
            f"Код действителен в течение {expires_minutes} минут.\n"
            f"Если вы не запрашивали данный код, проигнорируйте это письмо.\n\n"
            f"—\n"
            f"Единая цифровая платформа\n"
            f"Федерации спортивного программирования Оренбургской области\n"
            f"Сайт: {settings.BASE_URL}\n"
        )

        html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6fa; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
    .header {{ background: linear-gradient(135deg, #0d47a1 0%, #1976d2 100%); color: #ffffff; padding: 32px 28px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }}
    .header p {{ margin: 8px 0 0; font-size: 13px; opacity: 0.9; }}
    .content {{ padding: 32px 28px; }}
    .intro {{ font-size: 15px; line-height: 1.6; margin-bottom: 24px; color: #334155; }}
    .code-box {{ background: #f1f5f9; border: 2px dashed #0d47a1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
    .code {{ font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #0d47a1; font-family: 'Courier New', monospace; }}
    .expiry {{ font-size: 13px; color: #64748b; margin-top: 8px; }}
    .footer {{ background: #f8fafc; padding: 20px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
    .footer a {{ color: #1976d2; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Федерация спортивного программирования</h1>
      <p>Оренбургская область • Единая цифровая платформа</p>
    </div>
    <div class="content">
      <p class="intro">Здравствуйте! Вы запросили проверочный код для <b>{purpose_str}</b> на платформе ФСП Оренбургской области.</p>
      
      <div class="code-box">
        <div class="code">{code}</div>
        <div class="expiry">Срок действия кода: {expires_minutes} минут</div>
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
        Никому не сообщайте данный код. Сотрудники Федерации никогда не запрашивают код подтверждения по телефону или в мессенджерах.
      </p>
    </div>
    <div class="footer">
      <p>© 2026 РОО «Федерация спортивного программирования Оренбургской области»</p>
      <p><a href="{settings.BASE_URL}">Перейти на платформу</a> • Техническая поддержка</p>
    </div>
  </div>
</body>
</html>"""

        return await cls.send_email(to_email, subject, text_content, html_content)

    @classmethod
    async def send_notification_email(
        cls,
        to_email: str,
        title: str,
        body: str,
        link_url: str | None = None
    ) -> bool:
        """Sends an event notification email (status change, rank update, deadline alert)."""
        subject = f"{title} — ФСП Оренбургской области"

        text_content = (
            f"{title}\n\n"
            f"{body}\n\n"
            f"Подробнее в личном кабинете: {link_url or settings.BASE_URL}\n\n"
            f"—\nФедерация спортивного программирования Оренбургской области"
        )

        button_html = f"""
        <div style="text-align: center; margin: 28px 0;">
          <a href="{link_url or settings.BASE_URL}" style="background-color: #0d47a1; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Открыть личный кабинет
          </a>
        </div>
        """ if link_url or settings.BASE_URL else ""

        html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6fa; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
    .header {{ background: #0d47a1; color: #ffffff; padding: 26px 28px; text-align: left; }}
    .header h2 {{ margin: 0; font-size: 18px; font-weight: 700; }}
    .content {{ padding: 30px 28px; font-size: 15px; line-height: 1.6; color: #334155; }}
    .card {{ background: #f8fafc; border-left: 4px solid #0d47a1; padding: 16px 20px; border-radius: 4px; margin: 18px 0; }}
    .footer {{ background: #f8fafc; padding: 18px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>ФСП Оренбургской области</h2>
    </div>
    <div class="content">
      <h3 style="margin-top: 0; color: #0d47a1;">{title}</h3>
      <div class="card">
        {body.replace(chr(10), '<br/>')}
      </div>
      {button_html}
    </div>
    <div class="footer">
      <p>© 2026 Федерация спортивного программирования Оренбургской области</p>
    </div>
  </div>
</body>
</html>"""

        return await cls.send_email(to_email, subject, text_content, html_content)

    @classmethod
    async def send_news_email(
        cls,
        to_emails: list[str],
        title: str,
        content: str,
        tag: str = "Новости федерации",
        news_url: str | None = None
    ) -> int:
        """Broadcasts general news/announcement email to list of users."""
        if not to_emails:
            return 0

        subject = f"📰 {title} — Новости ФСП Оренбургской области"

        text_content = (
            f"НОВОСТИ ФЕДЕРАЦИИ СПОРТИВНОГО ПРОГРАММИРОВАНИЯ\n"
            f"Тег: {tag}\n\n"
            f"{title}\n\n"
            f"{content}\n\n"
            f"Подробнее на сайте: {news_url or settings.BASE_URL}\n\n"
            f"—\nРОО «ФСП Оренбургской области»"
        )

        html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6fa; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
    .header {{ background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%); color: #ffffff; padding: 30px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; }}
    .tag {{ display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; }}
    .content {{ padding: 32px 30px; font-size: 15px; line-height: 1.7; color: #334155; }}
    .news-title {{ font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; }}
    .footer {{ background: #f8fafc; padding: 20px 30px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
    .footer a {{ color: #1976d2; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ФСП Оренбургской области</h1>
      <span class="tag">{tag}</span>
    </div>
    <div class="content">
      <h2 class="news-title">{title}</h2>
      <p>{content.replace(chr(10), '<br/>')}</p>
      
      <div style="text-align: center; margin: 32px 0 10px;">
        <a href="{news_url or settings.BASE_URL}" style="background-color: #0d47a1; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
          Перейти на портал ФСП
        </a>
      </div>
    </div>
    <div class="footer">
      <p>© 2026 РОО «Федерация спортивного программирования Оренбургской области»</p>
      <p>Вы получили это письмо как зарегистрированный участник региональной платформы.</p>
    </div>
  </div>
</body>
</html>"""

        sent_count = 0
        for email in to_emails:
            if email and "@" in email:
                await cls.send_email(email, subject, text_content, html_content)
                sent_count += 1

        logger.info(f"📰 Разослано новостное письмо '{title}' на {sent_count} адресов.")
        return sent_count
