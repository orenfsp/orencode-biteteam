import { esc } from "../format.js";
import { go } from "../router.js";

export function navigatorPage(app) {
  app.innerHTML = `
  <div style="min-height:100vh;background:#f8fafc;padding:30px 16px;font-family:inherit;color:#1e293b;">
    <div style="max-width:960px;margin:0 auto;">
      
      <!-- Top Bar -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="assets/logo.svg" alt="ФСП" style="height:44px;">
          <div>
            <b style="font-size:16px;color:#0f172a;">ФСП Оренбургской области</b>
            <div style="font-size:12px;color:#64748b;">Единая цифровая платформа вида спорта</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <a href="#/login" class="btn alt sm">Войти в кабинет</a>
          <a href="#/register" class="btn sm">Регистрация</a>
        </div>
      </div>

      <!-- Hero Banner -->
      <div class="card" style="background:linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);color:#fff;padding:40px 32px;margin-bottom:28px;border-radius:18px;">
        <span class="pill" style="background:rgba(255,255,255,0.2);color:#fff;margin-bottom:14px;display:inline-block;">🧭 Навигатор для новичка</span>
        <h1 style="font-size:32px;margin:10px 0 14px;color:#fff;">С чего начать в спортивном программировании?</h1>
        <p style="font-size:16px;line-height:1.6;color:#cbd5e1;max-width:760px;margin:0 0 24px;">
          Спортивное программирование — официальный признанный вид спорта в Российской Федерации (приказ Минспорта России № 584). 
          Здесь можно официально выполнять спортивные разряды (от 3 юношеского до Мастера спорта России), входить в состав сборной команды Оренбургской области и претендовать на Губернаторские премии.
        </p>
        <div style="display:flex;gap:14px;flex-wrap:wrap;">
          <a href="#/register" class="btn" style="background:#6366f1;color:#fff;border:none;">Зарегистрироваться на платформе</a>
          <a href="https://t.me/fsp123_bot" target="_blank" rel="noopener" class="btn light">Открыть Telegram-бота @fsp123_bot</a>
        </div>
      </div>

      <!-- Section: 6 Disciplines -->
      <div class="card" style="margin-bottom:28px;padding:32px;">
        <h2 style="font-size:22px;margin:0 0 6px;">6 официальных дисциплин вида спорта</h2>
        <p class="hint" style="margin-bottom:20px;">Платформа ведёт раздельный и сквозной учёт по всем шести аккредитованным дисциплинам:</p>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;">
          <div style="background:#f1f5f9;border-radius:12px;padding:18px;border:1px solid #e2e8f0;">
            <div style="font-size:24px;margin-bottom:8px;">🧩</div>
            <h3 style="margin:0 0 6px;font-size:16px;">Программирование алгоритмическое</h3>
            <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;">КОД: ALGO (ICPC-формат)</div>
            <p style="font-size:13px;line-height:1.45;color:#475569;margin:0;">
              Классическое олимпиадное программирование. Решение сложных алгоритмических задач и структур данных на скорость (C++, Python, Java).
            </p>
          </div>

          <div style="background:#f1f5f9;border-radius:12px;padding:18px;border:1px solid #e2e8f0;">
            <div style="font-size:24px;margin-bottom:8px;">🚀</div>
            <h3 style="margin:0 0 6px;font-size:16px;">Программирование продуктовое</h3>
            <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;">КОД: PROD (Хакатоны)</div>
            <p style="font-size:13px;line-height:1.45;color:#475569;margin:0;">
              Командная разработка законченных цифровых продуктов, веб-сервисов, мобильных платформ и корпоративных решений за ограниченное время.
            </p>
          </div>

          <div style="background:#f1f5f9;border-radius:12px;padding:18px;border:1px solid #e2e8f0;">
            <div style="font-size:24px;margin-bottom:8px;">🛡️</div>
            <h3 style="margin:0 0 6px;font-size:16px;">Системы информационной безопасности</h3>
            <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;">КОД: SEC (CTF)</div>
            <p style="font-size:13px;line-height:1.45;color:#475569;margin:0;">
              Анализ защищенности программных комплексов, поиск уязвимостей, reverse engineering, криптография и отражение атак в формате CTF.
            </p>
          </div>

          <div style="background:#f1f5f9;border-radius:12px;padding:18px;border:1px solid #e2e8f0;">
            <div style="font-size:24px;margin-bottom:8px;">🧠</div>
            <h3 style="margin:0 0 6px;font-size:16px;">Системы искусственного интеллекта</h3>
            <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;">КОД: AI (Data Science)</div>
            <p style="font-size:13px;line-height:1.45;color:#475569;margin:0;">
              Машинное обучение, обучение глубоких нейросетей, компьютерное зрение (CV), обработка естественного языка (NLP) и предиктивная аналитика.
            </p>
          </div>

          <div style="background:#f1f5f9;border-radius:12px;padding:18px;border:1px solid #e2e8f0;">
            <div style="font-size:24px;margin-bottom:8px;">🤖</div>
            <h3 style="margin:0 0 6px;font-size:16px;">Программирование робототехники</h3>
            <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;">КОД: ROBO (Мехатроника)</div>
            <p style="font-size:13px;line-height:1.45;color:#475569;margin:0;">
              Разработка управляющих алгоритмов для автономных робототехнических комплексов, микроконтроллеров и промышленных манипуляторов.
            </p>
          </div>

          <div style="background:#f1f5f9;border-radius:12px;padding:18px;border:1px solid #e2e8f0;">
            <div style="font-size:24px;margin-bottom:8px;">🛸</div>
            <h3 style="margin:0 0 6px;font-size:16px;">Беспилотные авиационные системы</h3>
            <div style="font-size:11px;font-weight:700;color:#6366f1;margin-bottom:8px;">КОД: DRONE (БАС)</div>
            <p style="font-size:13px;line-height:1.45;color:#475569;margin:0;">
              Программирование автопилотов БПЛА, алгоритмы компьютерного зрения для ориентирования в пространстве, автономные миссии и роевой интеллект.
            </p>
          </div>
        </div>
      </div>

      <!-- Section: Steps to Master of Sports -->
      <div class="card" style="margin-bottom:28px;padding:32px;">
        <h2 style="font-size:22px;margin:0 0 8px;">Путь спортсмена: от новичка до Мастера спорта</h2>
        <p class="hint" style="margin-bottom:24px;">Как построить спортивную карьеру в спортивном программировании Оренбургской области:</p>

        <div style="display:flex;flex-direction:column;gap:18px;">
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:#e0e7ff;color:#4338ca;font-weight:800;font-size:18px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">1</div>
            <div>
              <b style="font-size:16px;">Регистрация и выбор роли</b>
              <p style="margin:4px 0 0;font-size:14px;color:#475569;">
                Зарегистрируйтесь на платформе, указав роль «Спортсмен». После одобрения роли администратором вам откроется доступ к календарю, подаче заявок и рейтингу.
              </p>
            </div>
          </div>

          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:#e0e7ff;color:#4338ca;font-weight:800;font-size:18px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">2</div>
            <div>
              <b style="font-size:16px;">Антидопинговый сертификат РУСАДА</b>
              <p style="margin:4px 0 0;font-size:14px;color:#475569;">
                Официальные соревнования требуют прохождения бесплатного онлайн-курса на <a href="https://rusada.ru" target="_blank" rel="noopener" style="color:#6366f1;font-weight:600;">rusada.ru</a>. Отметьте дату прохождения в личном кабинете.
              </p>
            </div>
          </div>

          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:#e0e7ff;color:#4338ca;font-weight:800;font-size:18px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">3</div>
            <div>
              <b style="font-size:16px;">Первые турниры и юношеские разряды</b>
              <p style="margin:4px 0 0;font-size:14px;color:#475569;">
                Участвуйте в муниципальных и областных первенствах. По итогам протокола платформа проверяет соответствие нормам ЕВСК и позволяет подать заявку на 3, 2 или 1 юношеский разряд.
              </p>
            </div>
          </div>

          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:#e0e7ff;color:#4338ca;font-weight:800;font-size:18px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">4</div>
            <div>
              <b style="font-size:16px;">Взрослые разряды, КМС и Мастер спорта России (МС)</b>
              <p style="margin:4px 0 0;font-size:14px;color:#475569;">
                Высокие места на Чемпионатах области, ПФО и всероссийских соревнованиях дают право на присвоение 1 спортивного разряда, Кандидата в мастера спорта (КМС) и Мастера спорта.
              </p>
            </div>
          </div>

          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div style="background:#e0e7ff;color:#4338ca;font-weight:800;font-size:18px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">5</div>
            <div>
              <b style="font-size:16px;">Сборная региона и премии Губернатора</b>
              <p style="margin:4px 0 0;font-size:14px;color:#475569;">
                Лидеры рейтинга сезона включаются в состав сборной команды Оренбургской области. Победители и призеры всероссийских турниров выдвигаются на ежегодные премии Губернатора (до 100 000 ₽ по Указу № 93-ук).
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Where to Train -->
      <div class="card" style="margin-bottom:32px;padding:32px;">
        <h2 style="font-size:22px;margin:0 0 10px;">Где заниматься в Оренбургской области?</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;">
          <div style="padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
            <b style="color:#0f172a;">Оренбургский государственный университет (ОГУ)</b>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">г. Оренбург, пр-т Победы, 13 (Институт математики и ИТ)</div>
            <div class="pill p-lav" style="margin-top:8px;">ALGO · PROD · AI · SEC</div>
          </div>
          <div style="padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
            <b style="color:#0f172a;">Центр цифрового образования «IT-куб»</b>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">г. Оренбург, ул. Салмышская / г. Орск</div>
            <div class="pill p-grn" style="margin-top:8px;">ROBO · DRONE · ALGO</div>
          </div>
          <div style="padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
            <b style="color:#0f172a;">Детский технопарк «Кванториум»</b>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">Оренбургская область, программы спортивной подготовки</div>
            <div class="pill p-lav" style="margin-top:8px;">DRONE · ROBO · AI</div>
          </div>
        </div>
      </div>

      <!-- Bottom Call to Action -->
      <div style="text-align:center;padding:24px 0 40px;">
        <h3 style="margin:0 0 14px;font-size:20px;">Готовы присоединиться к спортивному программированию?</h3>
        <a href="#/register" class="btn" style="padding:12px 28px;font-size:16px;">Создать профиль спортсмена</a>
        <div style="margin-top:14px;">
          <a href="#/login" class="link">Уже есть аккаунт? Войти в кабинет</a>
        </div>
      </div>

    </div>
  </div>`;
}
